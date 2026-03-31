import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);
const SALT_ROUNDS = 10;

async function main() {
  // ── Existing: admin user ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: passwordHash, role: 'ADMIN' },
    create: { username: 'admin', password: passwordHash, role: 'ADMIN' },
  });

  // ── Seed: cashier user ────────────────────────────────────────────────────
  const cashierHash = await bcrypt.hash('cashier123', SALT_ROUNDS);
  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: { password: cashierHash, role: 'CASHIER' },
    create: { username: 'cashier', password: cashierHash, role: 'CASHIER' },
  });

  // ── Seed: Products (10 items, mix of available/unavailable) ───────────────
  const products = [
    { name: 'Croissant',           price: 3.50,  isAvailable: true,  requiresCooking: false, cookCategory: null,        imageUrl: null },
    { name: 'Sourdough Loaf',      price: 8.00,  isAvailable: true,  requiresCooking: true,  cookCategory: 'BREAD',     imageUrl: null },
    { name: 'Chocolate Éclair',    price: 4.25,  isAvailable: true,  requiresCooking: true,  cookCategory: 'PASTRY',    imageUrl: null },
    { name: 'Cinnamon Roll',       price: 3.75,  isAvailable: true,  requiresCooking: true,  cookCategory: 'PASTRY',    imageUrl: null },
    { name: 'Blueberry Muffin',    price: 2.99,  isAvailable: true,  requiresCooking: false, cookCategory: null,        imageUrl: null },
    { name: 'Baguette',            price: 2.50,  isAvailable: true,  requiresCooking: true,  cookCategory: 'BREAD',     imageUrl: null },
    { name: 'Almond Danish',       price: 4.00,  isAvailable: true,  requiresCooking: true,  cookCategory: 'PASTRY',    imageUrl: null },
    { name: 'Cheese Brioche',      price: 5.50,  isAvailable: false, requiresCooking: true,  cookCategory: 'BREAD',     imageUrl: null },
    { name: 'Walnut Tart',         price: 6.00,  isAvailable: false, requiresCooking: true,  cookCategory: 'PASTRY',    imageUrl: null },
    { name: 'Seasonal Cake Slice', price: 7.50,  isAvailable: false, requiresCooking: true,  cookCategory: 'PASTRY',    imageUrl: null },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p as any });
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: { requiresCooking: p.requiresCooking, cookCategory: p.cookCategory as any },
      });
    }
  }

  // ── Seed: Chefs (5 chefs, mix of AVAILABLE/BUSY) ──────────────────────────
  const chefs = [
    { name: 'Chef Antoine',  status: 'AVAILABLE' },
    { name: 'Chef Layla',    status: 'AVAILABLE' },
    { name: 'Chef Marcus',   status: 'BUSY'      },
    { name: 'Chef Priya',    status: 'AVAILABLE' },
    { name: 'Chef Tomás',    status: 'BUSY'      },
  ];

  for (const c of chefs) {
    const existing = await prisma.chef.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.chef.create({ data: c });
    }
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

