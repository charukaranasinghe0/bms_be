import { PrismaClient, CookCategory, ChefOrderStatus, LoyaltyTxType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const SALT_ROUNDS = 10;
const SIX_MONTHS_AGO = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
const NOW = new Date();
const TODAY_START = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate(from: Date, to: Date): Date {
  return faker.date.between({ from, to });
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 1. Clean Slate ───────────────────────────────────────────────────────────

async function cleanDatabase() {
  console.log('🧹 Cleaning database...');
  // Delete in FK-safe order (children first)
  await prisma.chefOrder.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.loyaltyPointTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.chef.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.loyaltySettings.deleteMany();
  await prisma.loyaltyTier.deleteMany();
  console.log('✅ Database cleaned');
}

// ─── 2. Loyalty Config ────────────────────────────────────────────────────────

async function seedLoyaltyConfig() {
  console.log('🏅 Seeding loyalty config...');

  await prisma.loyaltySettings.create({
    data: {
      pointsPerCurrencyUnit: 1.0,   // 1 point per $1 spent
      redemptionThreshold: 100,      // 100 points = 1 redemption block
      redemptionValue: 5.0,          // each block = $5 off
      currencyCode: 'USD',
      currencySymbol: '$',
    },
  });

  // Tiers: Dough (0-499) → Pastry (500-1999) → Artisan (2000+)
  await prisma.loyaltyTier.createMany({
    data: [
      {
        name: 'Dough',
        minPoints: 0,
        maxPoints: 499,
        pointMultiplier: 1.0,
        perksConfig: { freeItem: false, priorityService: false },
        sortOrder: 1,
        isActive: true,
      },
      {
        name: 'Pastry',
        minPoints: 500,
        maxPoints: 1999,
        pointMultiplier: 1.25,
        perksConfig: { freeItem: true, freeItemThreshold: 10, priorityService: false },
        sortOrder: 2,
        isActive: true,
      },
      {
        name: 'Artisan',
        minPoints: 2000,
        maxPoints: null,
        pointMultiplier: 1.5,
        perksConfig: { freeItem: true, freeItemThreshold: 5, priorityService: true, birthdayBonus: true },
        sortOrder: 3,
        isActive: true,
      },
    ],
  });

  console.log('✅ Loyalty config seeded');
}

// ─── 3. Staff & Users ─────────────────────────────────────────────────────────

async function seedStaff() {
  console.log('👤 Seeding staff...');

  const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  await prisma.user.create({
    data: { username: 'admin', password: adminHash, role: 'ADMIN' },
  });

  // 5 cashiers
  const cashierHash = await bcrypt.hash('cashier123', SALT_ROUNDS);
  const cashierNames = ['cashier', 'cashier_sara', 'cashier_mike', 'cashier_lena', 'cashier_tom'];
  await prisma.user.createMany({
    data: cashierNames.map((username) => ({
      username,
      password: cashierHash,
      role: 'CASHIER',
    })),
  });

  // 10 chefs across categories
  const chefHash = await bcrypt.hash('chef123', SALT_ROUNDS);
  const chefDefs: { username: string; cookCategory: CookCategory }[] = [
    { username: 'chef_antoine',  cookCategory: CookCategory.PASTRY   },
    { username: 'chef_layla',    cookCategory: CookCategory.PASTRY   },
    { username: 'chef_marcus',   cookCategory: CookCategory.BREAD    },
    { username: 'chef_priya',    cookCategory: CookCategory.BREAD    },
    { username: 'chef_tomas',    cookCategory: CookCategory.HOT_FOOD },
    { username: 'chef_nina',     cookCategory: CookCategory.PASTRY   },
    { username: 'chef_carlos',   cookCategory: CookCategory.BREAD    },
    { username: 'chef_yuki',     cookCategory: CookCategory.HOT_FOOD },
    { username: 'chef_fatima',   cookCategory: CookCategory.PASTRY   },
    { username: 'chef_dmitri',   cookCategory: CookCategory.HOT_FOOD },
  ];

  await prisma.user.createMany({
    data: chefDefs.map(({ username, cookCategory }) => ({
      username,
      password: chefHash,
      role: 'CHEF',
      cookCategory,
    })),
  });

  // Chef display records (for kitchen board)
  await prisma.chef.createMany({
    data: chefDefs.map(({ username }) => ({
      name: username.replace('chef_', 'Chef ').replace('_', ' '),
      status: pick(['AVAILABLE', 'AVAILABLE', 'BUSY']),
    })),
  });

  console.log('✅ Staff seeded (1 admin, 5 cashiers, 10 chefs)');
}

// ─── 4. Products ──────────────────────────────────────────────────────────────

type ProductSeed = {
  name: string;
  description: string;
  sku: string;
  price: number;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  requiresCooking: boolean;
  cookCategory: CookCategory | null;
};

async function seedProducts(): Promise<ProductSeed[]> {
  console.log('🥐 Seeding products...');

  const products: ProductSeed[] = [
    // BREADS
    { name: 'Sourdough Loaf',        description: 'Classic long-fermented sourdough with crispy crust',         sku: 'BRD-001', price: 8.50,  unit: 'loaf',   stockQty: 40,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Baguette',              description: 'Traditional French baguette, baked fresh daily',             sku: 'BRD-002', price: 2.75,  unit: 'piece',  stockQty: 60,  lowStockThreshold: 15, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Cheese Brioche',        description: 'Buttery brioche enriched with aged cheddar',                 sku: 'BRD-003', price: 5.50,  unit: 'piece',  stockQty: 25,  lowStockThreshold: 8,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Multigrain Loaf',       description: 'Hearty loaf packed with seeds and whole grains',             sku: 'BRD-004', price: 9.00,  unit: 'loaf',   stockQty: 30,  lowStockThreshold: 8,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Rye Bread',             description: 'Dense, tangy rye with caraway seeds',                        sku: 'BRD-005', price: 7.50,  unit: 'loaf',   stockQty: 20,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Focaccia',              description: 'Olive oil-drenched focaccia with rosemary and sea salt',     sku: 'BRD-006', price: 6.00,  unit: 'piece',  stockQty: 18,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Ciabatta Roll',         description: 'Light, airy ciabatta roll perfect for sandwiches',           sku: 'BRD-007', price: 2.25,  unit: 'piece',  stockQty: 50,  lowStockThreshold: 12, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Pretzel Bun',           description: 'Soft pretzel bun with coarse salt topping',                  sku: 'BRD-008', price: 2.50,  unit: 'piece',  stockQty: 35,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Whole Wheat Loaf',      description: 'Nutritious whole wheat sandwich loaf',                       sku: 'BRD-009', price: 7.00,  unit: 'loaf',   stockQty: 28,  lowStockThreshold: 8,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    { name: 'Pita Bread (6-pack)',   description: 'Soft pita rounds, ideal for dipping or wrapping',            sku: 'BRD-010', price: 4.50,  unit: 'pack',   stockQty: 22,  lowStockThreshold: 6,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.BREAD    },
    // PASTRIES
    { name: 'Croissant',             description: 'Flaky, buttery croissant made with laminated dough',         sku: 'PST-001', price: 3.50,  unit: 'piece',  stockQty: 80,  lowStockThreshold: 20, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Chocolate Éclair',      description: 'Choux pastry filled with chocolate cream, glazed on top',   sku: 'PST-002', price: 4.25,  unit: 'piece',  stockQty: 45,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Cinnamon Roll',         description: 'Soft roll swirled with cinnamon sugar, cream cheese icing',  sku: 'PST-003', price: 3.75,  unit: 'piece',  stockQty: 55,  lowStockThreshold: 15, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Almond Danish',         description: 'Flaky Danish pastry with almond frangipane filling',         sku: 'PST-004', price: 4.00,  unit: 'piece',  stockQty: 40,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Walnut Tart',           description: 'Buttery tart shell filled with caramelised walnut cream',    sku: 'PST-005', price: 6.00,  unit: 'piece',  stockQty: 20,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Seasonal Cake Slice',   description: 'Rotating seasonal layer cake — ask staff for today\'s flavour', sku: 'PST-006', price: 7.50, unit: 'slice', stockQty: 30, lowStockThreshold: 8, isAvailable: true, requiresCooking: true, cookCategory: CookCategory.PASTRY   },
    { name: 'Blueberry Muffin',      description: 'Moist muffin bursting with fresh blueberries',               sku: 'PST-007', price: 2.99,  unit: 'piece',  stockQty: 70,  lowStockThreshold: 20, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Lemon Tart',            description: 'Crisp pastry shell with silky lemon curd and meringue',      sku: 'PST-008', price: 5.50,  unit: 'piece',  stockQty: 25,  lowStockThreshold: 6,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Pain au Chocolat',      description: 'Croissant dough wrapped around dark chocolate batons',       sku: 'PST-009', price: 3.75,  unit: 'piece',  stockQty: 50,  lowStockThreshold: 12, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Strawberry Tart',       description: 'Vanilla custard tart topped with glazed fresh strawberries', sku: 'PST-010', price: 6.50,  unit: 'piece',  stockQty: 18,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Kouign-Amann',          description: 'Breton caramelised butter cake with crispy sugar crust',     sku: 'PST-011', price: 5.00,  unit: 'piece',  stockQty: 15,  lowStockThreshold: 4,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Canelé',                description: 'Bordeaux specialty — caramelised shell, custardy interior',  sku: 'PST-012', price: 2.50,  unit: 'piece',  stockQty: 40,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    // CAKES
    { name: 'Chocolate Fudge Cake',  description: 'Rich triple-layer chocolate cake with ganache frosting',     sku: 'CAK-001', price: 42.00, unit: 'whole',  stockQty: 5,   lowStockThreshold: 2,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Vanilla Sponge Cake',   description: 'Light vanilla sponge with buttercream and jam',              sku: 'CAK-002', price: 38.00, unit: 'whole',  stockQty: 5,   lowStockThreshold: 2,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Red Velvet Cake',       description: 'Classic red velvet with cream cheese frosting',              sku: 'CAK-003', price: 45.00, unit: 'whole',  stockQty: 4,   lowStockThreshold: 2,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Carrot Cake',           description: 'Spiced carrot cake with walnuts and cream cheese icing',     sku: 'CAK-004', price: 40.00, unit: 'whole',  stockQty: 4,   lowStockThreshold: 2,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    { name: 'Cheesecake Slice',      description: 'New York-style baked cheesecake on a graham cracker base',   sku: 'CAK-005', price: 6.50,  unit: 'slice',  stockQty: 24,  lowStockThreshold: 6,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.PASTRY   },
    // HOT FOOD
    { name: 'Quiche Lorraine',       description: 'Classic French quiche with bacon, gruyère, and cream',       sku: 'HOT-001', price: 8.00,  unit: 'slice',  stockQty: 20,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Spinach & Feta Pie',    description: 'Flaky filo pastry filled with spinach and feta cheese',      sku: 'HOT-002', price: 7.50,  unit: 'piece',  stockQty: 18,  lowStockThreshold: 5,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Sausage Roll',          description: 'Pork sausage wrapped in golden puff pastry',                 sku: 'HOT-003', price: 4.50,  unit: 'piece',  stockQty: 35,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Chicken Pot Pie',       description: 'Creamy chicken and vegetable filling in a shortcrust case',  sku: 'HOT-004', price: 9.50,  unit: 'piece',  stockQty: 15,  lowStockThreshold: 4,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Mushroom Tart',         description: 'Caramelised mushroom and thyme tart on puff pastry',         sku: 'HOT-005', price: 7.00,  unit: 'piece',  stockQty: 16,  lowStockThreshold: 4,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Beef Empanada',         description: 'Spiced ground beef in a hand-crimped pastry shell',          sku: 'HOT-006', price: 5.00,  unit: 'piece',  stockQty: 30,  lowStockThreshold: 8,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Cheese & Ham Croissant',description: 'Toasted croissant filled with ham and melted cheese',        sku: 'HOT-007', price: 6.00,  unit: 'piece',  stockQty: 25,  lowStockThreshold: 8,  isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    { name: 'Tomato Soup (cup)',      description: 'House-made roasted tomato soup served with a bread roll',    sku: 'HOT-008', price: 5.50,  unit: 'cup',    stockQty: 40,  lowStockThreshold: 10, isAvailable: true,  requiresCooking: true,  cookCategory: CookCategory.HOT_FOOD },
    // BEVERAGES
    { name: 'Espresso',              description: 'Single-origin espresso shot',                                sku: 'BEV-001', price: 2.50,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Flat White',            description: 'Double ristretto with velvety steamed milk',                 sku: 'BEV-002', price: 4.00,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Cappuccino',            description: 'Equal parts espresso, steamed milk, and foam',               sku: 'BEV-003', price: 4.25,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Latte',                 description: 'Espresso with a generous pour of steamed milk',              sku: 'BEV-004', price: 4.50,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Hot Chocolate',         description: 'Rich Belgian hot chocolate with whipped cream',              sku: 'BEV-005', price: 4.75,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Fresh Orange Juice',    description: 'Cold-pressed fresh orange juice',                            sku: 'BEV-006', price: 4.00,  unit: 'glass',  stockQty: 60,  lowStockThreshold: 15, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Iced Latte',            description: 'Chilled espresso over ice with cold milk',                   sku: 'BEV-007', price: 5.00,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Chai Latte',            description: 'Spiced chai concentrate with steamed oat milk',              sku: 'BEV-008', price: 4.75,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Sparkling Water',       description: 'Chilled sparkling mineral water (330ml)',                    sku: 'BEV-009', price: 2.00,  unit: 'bottle', stockQty: 120, lowStockThreshold: 30, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
    { name: 'Matcha Latte',          description: 'Ceremonial grade matcha with steamed milk',                  sku: 'BEV-010', price: 5.25,  unit: 'cup',    stockQty: 999, lowStockThreshold: 50, isAvailable: true,  requiresCooking: false, cookCategory: null                  },
  ];

  await prisma.product.createMany({ data: products as any[] });

  const created = await prisma.product.findMany();
  console.log(`✅ ${created.length} products seeded`);
  return products;
}

// ─── 5. Customers ─────────────────────────────────────────────────────────────

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  currentPoints: number;
  lifetimePoints: number;
  tierName: string;
  createdAt: Date;
};

async function seedCustomers(): Promise<CustomerRow[]> {
  console.log('👥 Seeding 300 customers...');

  // Tier distribution: 60% Dough, 30% Pastry, 10% Artisan
  // Dough:   lifetime 0–499
  // Pastry:  lifetime 500–1999
  // Artisan: lifetime 2000–5000
  const TOTAL = 300;
  const tierBuckets = [
    { tierName: 'Dough',   count: Math.round(TOTAL * 0.60), minLT: 0,    maxLT: 499  },
    { tierName: 'Pastry',  count: Math.round(TOTAL * 0.30), minLT: 500,  maxLT: 1999 },
    { tierName: 'Artisan', count: TOTAL - Math.round(TOTAL * 0.60) - Math.round(TOTAL * 0.30), minLT: 2000, maxLT: 5000 },
  ];

  const usedPhones = new Set<string>();
  const usedEmails = new Set<string>();
  const customers: CustomerRow[] = [];

  for (const bucket of tierBuckets) {
    for (let i = 0; i < bucket.count; i++) {
      const lifetimePoints = randBetween(bucket.minLT, bucket.maxLT);
      // currentPoints = some portion of lifetime (they may have redeemed some)
      const redeemed = Math.floor(lifetimePoints * faker.number.float({ min: 0, max: 0.4 }));
      const currentPoints = lifetimePoints - redeemed;

      let phone: string;
      do { phone = faker.phone.number({ style: 'international' }).slice(0, 20); } while (usedPhones.has(phone));
      usedPhones.add(phone);

      let email: string;
      do { email = faker.internet.email().toLowerCase(); } while (usedEmails.has(email));
      usedEmails.add(email);

      customers.push({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email,
        phone,
        currentPoints,
        lifetimePoints,
        tierName: bucket.tierName,
        createdAt: randDate(SIX_MONTHS_AGO, NOW),
      });
    }
  }

  await prisma.customer.createMany({ data: customers as any[] });
  console.log(`✅ ${customers.length} customers seeded`);
  return customers;
}

// ─── 6. Orders + OrderItems + LoyaltyTxs + ChefOrders ────────────────────────

async function seedOrdersAndLoyalty(customers: CustomerRow[]) {
  console.log('🛒 Seeding 1000+ orders (this may take a moment)...');

  const products = await prisma.product.findMany();
  const availableProducts = products.filter((p) => p.isAvailable);
  const cookingProducts = availableProducts.filter((p) => p.requiresCooking);

  const paymentMethods = ['CASH', 'CARD', 'MOBILE_PAY'];

  // We'll accumulate loyalty tx data per customer to reconcile at the end
  const loyaltyTxBatch: {
    id: string;
    customerId: string;
    type: LoyaltyTxType;
    points: number;
    orderId: string | null;
    note: string | null;
    createdAt: Date;
  }[] = [];

  // Track running loyalty balance per customer (for mathematical consistency)
  const runningBalance: Record<string, number> = {};
  for (const c of customers) {
    runningBalance[c.id] = 0;
  }

  // ── Historical orders: 1000 spread over last 6 months ──
  const HISTORICAL_COUNT = 1000;
  const BATCH_SIZE = 50;

  let totalOrders = 0;

  for (let batch = 0; batch < Math.ceil(HISTORICAL_COUNT / BATCH_SIZE); batch++) {
    const batchSize = Math.min(BATCH_SIZE, HISTORICAL_COUNT - batch * BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < batchSize; i++) {
        const customer = pick(customers);
        const orderDate = randDate(SIX_MONTHS_AGO, new Date(TODAY_START.getTime() - 60 * 60 * 1000)); // before today

        // 2–5 items per order
        const itemCount = randBetween(2, 5);
        const selectedProducts = faker.helpers.arrayElements(availableProducts, itemCount);

        let subtotal = 0;
        const itemsData: { productId: string; quantity: number; price: number; assignedChefId: string | null }[] = [];

        for (const prod of selectedProducts) {
          const qty = randBetween(1, 3);
          subtotal += prod.price * qty;
          itemsData.push({ productId: prod.id, quantity: qty, price: prod.price, assignedChefId: null });
        }

        const discount = Math.random() < 0.1 ? parseFloat((subtotal * 0.1).toFixed(2)) : 0;
        const total = parseFloat((subtotal - discount).toFixed(2));

        // Create order
        const order = await tx.order.create({
          data: {
            customerId: customer.id,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount,
            total,
            paymentMethod: pick(paymentMethods),
            status: 'PAID',
            createdAt: orderDate,
            items: {
              create: itemsData,
            },
          },
          include: { items: true },
        });

        // Loyalty: 1 point per $1 spent (floor)
        const pointsEarned = Math.floor(total);
        runningBalance[customer.id] += pointsEarned;

        loyaltyTxBatch.push({
          id: faker.string.uuid(),
          customerId: customer.id,
          type: LoyaltyTxType.EARNED,
          points: pointsEarned,
          orderId: order.id,
          note: null,
          createdAt: orderDate,
        });

        // ChefOrders for items that require cooking (historical = DONE)
        for (const item of order.items) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod?.requiresCooking && prod.cookCategory) {
            const acceptedAt = new Date(orderDate.getTime() + randBetween(1, 5) * 60 * 1000);
            const completedAt = new Date(acceptedAt.getTime() + randBetween(5, 25) * 60 * 1000);
            await tx.chefOrder.create({
              data: {
                orderId: order.id,
                orderItemId: item.id,
                productId: prod.id,
                cookCategory: prod.cookCategory,
                status: ChefOrderStatus.DONE,
                acceptedAt,
                completedAt,
                createdAt: orderDate,
              },
            });
          }
        }

        totalOrders++;
      }
    });

    if ((batch + 1) % 5 === 0) {
      console.log(`  → ${totalOrders} historical orders created...`);
    }
  }

  // ── Today's live orders: 8 orders with PENDING/IN_PROGRESS chef tasks ──
  console.log('  → Creating today\'s live kitchen orders...');
  for (let i = 0; i < 8; i++) {
    const customer = pick(customers);
    const orderDate = new Date(TODAY_START.getTime() + randBetween(1, 6) * 60 * 60 * 1000);
    const liveProducts = faker.helpers.arrayElements(cookingProducts, randBetween(1, 3));

    let subtotal = 0;
    const itemsData: { productId: string; quantity: number; price: number; assignedChefId: string | null }[] = [];
    for (const prod of liveProducts) {
      const qty = randBetween(1, 2);
      subtotal += prod.price * qty;
      itemsData.push({ productId: prod.id, quantity: qty, price: prod.price, assignedChefId: null });
    }
    const total = parseFloat(subtotal.toFixed(2));

    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        subtotal: total,
        discount: 0,
        total,
        paymentMethod: pick(paymentMethods),
        status: 'PAID',
        createdAt: orderDate,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    const pointsEarned = Math.floor(total);
    runningBalance[customer.id] += pointsEarned;
    loyaltyTxBatch.push({
      id: faker.string.uuid(),
      customerId: customer.id,
      type: LoyaltyTxType.EARNED,
      points: pointsEarned,
      orderId: order.id,
      note: null,
      createdAt: orderDate,
    });

    // Live chef orders: mix of PENDING and IN_PROGRESS
    for (const item of order.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod?.requiresCooking && prod.cookCategory) {
        const liveStatus = i < 4 ? ChefOrderStatus.PENDING : ChefOrderStatus.IN_PROGRESS;
        const acceptedAt = liveStatus === ChefOrderStatus.IN_PROGRESS
          ? new Date(orderDate.getTime() + randBetween(1, 3) * 60 * 1000)
          : null;
        await prisma.chefOrder.create({
          data: {
            orderId: order.id,
            orderItemId: item.id,
            productId: prod.id,
            cookCategory: prod.cookCategory,
            status: liveStatus,
            acceptedAt,
            completedAt: null,
            createdAt: orderDate,
          },
        });
      }
    }

    totalOrders++;
  }

  // ── Insert loyalty transactions in bulk ──
  console.log(`  → Writing ${loyaltyTxBatch.length} loyalty transactions...`);
  const TX_CHUNK = 500;
  for (let i = 0; i < loyaltyTxBatch.length; i += TX_CHUNK) {
    await prisma.loyaltyPointTransaction.createMany({
      data: loyaltyTxBatch.slice(i, i + TX_CHUNK),
    });
  }

  // ── Add redemption transactions for customers who have redeemed ──
  const redemptionTxs: typeof loyaltyTxBatch = [];
  for (const customer of customers) {
    const redeemed = customer.lifetimePoints - customer.currentPoints;
    if (redeemed > 0) {
      // Spread redemptions across their history
      const redemptionCount = Math.ceil(redeemed / 100);
      let remaining = redeemed;
      for (let r = 0; r < redemptionCount && remaining > 0; r++) {
        const pts = Math.min(100, remaining);
        remaining -= pts;
        redemptionTxs.push({
          id: faker.string.uuid(),
          customerId: customer.id,
          type: LoyaltyTxType.REDEEMED,
          points: -pts,
          orderId: null,
          note: 'Points redeemed for discount',
          createdAt: randDate(SIX_MONTHS_AGO, NOW),
        });
      }
    }
  }

  for (let i = 0; i < redemptionTxs.length; i += TX_CHUNK) {
    await prisma.loyaltyPointTransaction.createMany({
      data: redemptionTxs.slice(i, i + TX_CHUNK),
    });
  }

  console.log(`✅ ${totalOrders} orders seeded, ${loyaltyTxBatch.length + redemptionTxs.length} loyalty transactions written`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting large-scale bakery seed...\n');

  await cleanDatabase();
  await seedLoyaltyConfig();
  await seedStaff();
  await seedProducts();
  const customers = await seedCustomers();
  await seedOrdersAndLoyalty(customers);

  console.log('\n🎉 Seed complete! Database is ready for demo.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
