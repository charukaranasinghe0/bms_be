import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PosCustomerRepository } from '../repositories/customer.repository';
import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../repositories/order.repository';
import { ChefsService } from '../../chefs/chefs.service';
import { NotificationService } from './notification.service';
import { KitchenGateway } from '../../kitchen/kitchen.gateway';
import { InventoryService } from '../../inventory/inventory.service';
import { CustomerProfileService } from '../../customer-profile/customer-profile.service';
import { PromotionsService } from '../../promotions/promotions.service';
import { CreateOrderDto } from '../dto/create-order.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerRepo: PosCustomerRepository,
    private readonly productRepo: ProductRepository,
    private readonly orderRepo: OrderRepository,
    private readonly chefsService: ChefsService,
    private readonly notificationService: NotificationService,
    private readonly kitchenGateway: KitchenGateway,
    private readonly inventoryService: InventoryService,
    private readonly customerProfileService: CustomerProfileService,
    private readonly promotionsService: PromotionsService,
  ) {}

  // ── Customer lookup ────────────────────────────────────────────────────────
  async lookupCustomerByPhone(phone: string) {
    return this.customerProfileService.getPosCustomerInfo(phone);
  }

  // ── Product catalog ────────────────────────────────────────────────────────
  async getProducts() {
    const products = await this.productRepo.findAllAvailable();
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl ?? null,
      isAvailable: p.isAvailable,
      requiresCooking: p.requiresCooking,
      cookCategory: p.cookCategory ?? null,
    }));
  }

  // ── Chef list (read-only) ──────────────────────────────────────────────────
  async getChefs() {
    return this.chefsService.listAvailable();
  }

  // ── Chef order management ──────────────────────────────────────────────────

  async getPendingChefOrders() {
    // Returns items still being cooked (chef hasn't marked done yet)
    return this.prisma.chefOrder.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        product: { select: { name: true, cookCategory: true } },
        order: {
          select: {
            id: true,
            createdAt: true,
            customer: { select: { name: true, phone: true } },
          },
        },
        orderItem: { select: { quantity: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getReadyChefOrders() {
    // Returns items chef has marked as cooked — waiting for cashier to acknowledge
    return this.prisma.chefOrder.findMany({
      where: { status: 'DONE' },
      include: {
        product: { select: { name: true, cookCategory: true } },
        order: {
          select: {
            id: true,
            createdAt: true,
            customer: { select: { name: true, phone: true } },
          },
        },
        orderItem: { select: { quantity: true } },
      },
      orderBy: { completedAt: 'asc' },
    });
  }

  // Chef marks item as cooked → status becomes DONE → POS sees it as "Ready"
  async markChefOrderCooked(chefOrderId: string) {
    const chefOrder = await this.prisma.chefOrder.findUnique({
      where: { id: chefOrderId },
    });
    if (!chefOrder) throw new NotFoundException('Chef order not found');

    return this.prisma.chefOrder.update({
      where: { id: chefOrderId },
      data: { status: 'DONE', completedAt: new Date() },
      include: {
        product: { select: { name: true } },
        order: { select: { id: true } },
      },
    });
  }

  // Cashier acknowledges ready item → removes from notification → chef becomes AVAILABLE
  async completeChefOrder(chefOrderId: string) {
    const chefOrder = await this.prisma.chefOrder.findUnique({
      where: { id: chefOrderId },
      include: {
        order: {
          include: {
            chefOrders: true,
            customer: { select: { name: true, phone: true, email: true } },
          },
        },
      },
    });

    if (!chefOrder) throw new NotFoundException('Chef order not found');

    // Set chef back to AVAILABLE
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: chefOrder.orderItemId },
      select: { assignedChefId: true },
    });

    if (orderItem?.assignedChefId) {
      await this.prisma.chef.update({
        where: { id: orderItem.assignedChefId },
        data: { status: 'AVAILABLE' },
      });
    }

    // Check if ALL chef orders for this order are DONE
    const allDone = chefOrder.order.chefOrders.every(
      (co) => co.id === chefOrderId || co.status === 'DONE',
    );

    // Send customer notification if all items ready
    if (allDone) {
      void this.notificationService.sendReadyNotification({
        customer: chefOrder.order.customer,
        orderId: chefOrder.orderId,
      });
    }

    // Mark as acknowledged — delete so it disappears from notification bar
    await this.prisma.chefOrder.delete({ where: { id: chefOrderId } });

    // Broadcast removal to kitchen screens
    this.kitchenGateway.emitOrderRemoved(chefOrderId);

    // Broadcast updated chef status
    if (orderItem?.assignedChefId) {
      const updatedChef = await this.prisma.chef.findUnique({ where: { id: orderItem.assignedChefId } });
      if (updatedChef) this.kitchenGateway.emitChefUpdated(updatedChef);
    }

    return { acknowledged: true, chefOrderId };
  }

  // ── Order creation ─────────────────────────────────────────────────────────
  async createOrder(dto: CreateOrderDto) {
    // 1. Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // 2. Fetch all products in one query
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productRepo.findManyByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Validate each item + collect chef assignments needed
    const resolvedItems: {
      productId: string;
      quantity: number;
      price: number;
      assignedChefId?: string;
    }[] = [];

    const chefAssignments: { chefId: string; productName: string }[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isAvailable && !item.assignedChefId) {
        throw new UnprocessableEntityException(
          `Product "${product.name}" is unavailable. Assign an available chef to include it in the order.`,
        );
      }

      if (item.assignedChefId) {
        chefAssignments.push({
          chefId: item.assignedChefId,
          productName: product.name,
        });
      }

      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        assignedChefId: item.assignedChefId,
      });
    }

    // 4. Validate chef availability + mark them BUSY (throws if any chef is BUSY)
    await this.chefsService.assignChefsForOrder(chefAssignments);

    // 5. Calculate totals
    const subtotal = resolvedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const discountPercent = dto.discount ?? 0;
    const discountAmount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2));
    const loyaltyDiscountAmount = parseFloat((dto.loyaltyDiscount ?? 0).toFixed(2));

    // 5a. Apply active promotions
    const productMap3 = new Map(products.map((p) => [p.id, p]));
    const itemsWithCategory = resolvedItems.map((i) => ({
      ...i,
      cookCategory: productMap3.get(i.productId)?.cookCategory ?? null,
    }));
    const { appliedPromotions, totalPromotionDiscount } =
      await this.promotionsService.applyPromotions(itemsWithCategory, subtotal);

    const total = parseFloat(
      (subtotal - discountAmount - loyaltyDiscountAmount - totalPromotionDiscount).toFixed(2),
    );

    // 6. Handle payment (CARD stub — not yet implemented)
    const txRef =
      dto.paymentMethod === 'CARD'
        ? `TXN-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`
        : undefined;

    // 7. Persist order + ChefOrder records for assigned items
    const order = await this.orderRepo.create({
      customerId: dto.customerId,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat((discountAmount + loyaltyDiscountAmount + totalPromotionDiscount).toFixed(2)),
      total: Math.max(0, total),
      paymentMethod: dto.paymentMethod,
      status: 'PAID',
      txRef,
      items: resolvedItems,
    });

    // Create ChefOrder entries for items that have a chef assigned
    const chefOrderItems = order.items.filter(
      (item) => (item as { assignedChefId?: string }).assignedChefId,
    );

    if (chefOrderItems.length > 0) {
      const productMap2 = new Map(
        (await this.productRepo.findManyByIds(
          chefOrderItems.map((i) => i.productId),
        )).map((p) => [p.id, p]),
      );

      await this.prisma.chefOrder.createMany({
        data: chefOrderItems.map((item) => {
          const product = productMap2.get(item.productId);
          return {
            orderId: order.id,
            orderItemId: item.id,
            productId: item.productId,
            cookCategory: product?.cookCategory ?? 'PASTRY',
            status: 'PENDING' as const,
          };
        }),
      });

      // Broadcast new orders to kitchen screens in real-time
      const newChefOrders = await this.prisma.chefOrder.findMany({
        where: { orderId: order.id },
        include: {
          product: { select: { name: true, cookCategory: true, imageUrl: true, requiresCooking: true } },
          order: {
            select: {
              id: true, createdAt: true, paymentMethod: true,
              customer: { select: { name: true, phone: true } },
            },
          },
          orderItem: { select: { quantity: true, assignedChefId: true } },
        },
      });

      // Resolve chef names and emit each new order
      const chefIds = [...new Set(newChefOrders.map(o => o.orderItem.assignedChefId).filter((id): id is string => !!id))];
      const chefs = chefIds.length > 0 ? await this.prisma.chef.findMany({ where: { id: { in: chefIds } }, select: { id: true, name: true } }) : [];
      const chefMap = new Map(chefs.map(c => [c.id, c.name]));

      for (const co of newChefOrders) {
        this.kitchenGateway.emitNewOrder({
          ...co,
          assignedChefName: co.orderItem.assignedChefId ? (chefMap.get(co.orderItem.assignedChefId) ?? null) : null,
        });
      }
    }

    // ── Deduct inventory ingredients + sync product availability ──────────
    const changedProducts = await this.inventoryService.deductOrderIngredients(
      resolvedItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    );

    for (const p of changedProducts) {
      this.kitchenGateway.emitProductUpdated(p);
    }

    // ── Award loyalty points ───────────────────────────────────────────────
    void this.customerProfileService.awardPointsForOrder(dto.customerId, order.total);

    // ── Redeem points if loyalty discount was used ─────────────────────────
    if (loyaltyDiscountAmount > 0) {
      void this.customerProfileService.redeemPoints(dto.customerId);
    }

    return { ...order, appliedPromotions };
  }
}
