import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KitchenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active chef orders for the kitchen display.
   * Includes assigned chef name by joining OrderItem → Chef.
   * No auth required — kitchen screen is a trusted internal device.
   */
  async getActiveOrders() {
    const orders = await this.prisma.chefOrder.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            cookCategory: true,
            imageUrl: true,
            requiresCooking: true,
          },
        },
        order: {
          select: {
            id: true,
            createdAt: true,
            paymentMethod: true,
            customer: { select: { name: true, phone: true } },
          },
        },
        orderItem: {
          select: {
            quantity: true,
            assignedChefId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Resolve chef names for all assigned chefs in one query
    const chefIds = [
      ...new Set(
        orders
          .map((o) => o.orderItem.assignedChefId)
          .filter((id): id is string => !!id),
      ),
    ];

    const chefs =
      chefIds.length > 0
        ? await this.prisma.chef.findMany({
            where: { id: { in: chefIds } },
            select: { id: true, name: true },
          })
        : [];

    const chefMap = new Map(chefs.map((c) => [c.id, c.name]));

    return orders.map((o) => ({
      ...o,
      assignedChefName: o.orderItem.assignedChefId
        ? (chefMap.get(o.orderItem.assignedChefId) ?? null)
        : null,
    }));
  }

  /**
   * Get all chefs with their current workload for the kitchen roster panel.
   * No auth required.
   */
  async getKitchenChefs() {
    const chefs = await this.prisma.chef.findMany({
      orderBy: { name: 'asc' },
    });

    // Count active orders per chef
    const activeOrders = await this.prisma.chefOrder.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        orderItem: { select: { assignedChefId: true } },
        product: { select: { name: true } },
      },
    });

    const workloadMap = new Map<string, { count: number; items: string[] }>();
    for (const order of activeOrders) {
      const chefId = order.orderItem.assignedChefId;
      if (!chefId) continue;
      const existing = workloadMap.get(chefId) ?? { count: 0, items: [] };
      workloadMap.set(chefId, {
        count: existing.count + 1,
        items: [...existing.items, order.product.name],
      });
    }

    return chefs.map((chef) => ({
      id: chef.id,
      name: chef.name,
      status: chef.status,
      activeOrders: workloadMap.get(chef.id)?.count ?? 0,
      currentItems: workloadMap.get(chef.id)?.items ?? [],
    }));
  }

  /**
   * Get stats for the kitchen header display.
   */
  async getStats() {
    const [pending, inProgress, done] = await Promise.all([
      this.prisma.chefOrder.count({ where: { status: 'PENDING' } }),
      this.prisma.chefOrder.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.chefOrder.count({ where: { status: 'DONE' } }),
    ]);
    return { pending, inProgress, done, total: pending + inProgress + done };
  }

  /**
   * Get products that require cooking — for kitchen reference panel.
   */
  async getKitchenProducts() {
    return this.prisma.product.findMany({
      where: { requiresCooking: true },
      select: {
        id: true,
        name: true,
        cookCategory: true,
        isAvailable: true,
        imageUrl: true,
        requiresCooking: true,
      },
      orderBy: { cookCategory: 'asc' },
    });
  }

  /**
   * Chef accepts an order — PENDING → IN_PROGRESS.
   */
  async acceptOrder(chefOrderId: string) {
    const chefOrder = await this.prisma.chefOrder.findUnique({
      where: { id: chefOrderId },
    });
    if (!chefOrder) throw new NotFoundException('Chef order not found');
    if (chefOrder.status !== 'PENDING') {
      return chefOrder; // idempotent
    }

    return this.prisma.chefOrder.update({
      where: { id: chefOrderId },
      data: { status: 'IN_PROGRESS', acceptedAt: new Date() },
      include: {
        product: { select: { name: true, cookCategory: true } },
        order: { select: { id: true, customer: { select: { name: true } } } },
        orderItem: { select: { quantity: true, assignedChefId: true } },
      },
    });
  }

  /**
   * Chef marks order as done — IN_PROGRESS → DONE.
   * POS notification panel will show "Ready to collect".
   */
  async markDone(chefOrderId: string) {
    const chefOrder = await this.prisma.chefOrder.findUnique({
      where: { id: chefOrderId },
    });
    if (!chefOrder) throw new NotFoundException('Chef order not found');
    if (chefOrder.status === 'DONE') {
      return chefOrder; // idempotent
    }

    return this.prisma.chefOrder.update({
      where: { id: chefOrderId },
      data: { status: 'DONE', completedAt: new Date() },
      include: {
        product: { select: { name: true, cookCategory: true } },
        order: { select: { id: true, customer: { select: { name: true } } } },
        orderItem: { select: { quantity: true, assignedChefId: true } },
      },
    });
  }
}
