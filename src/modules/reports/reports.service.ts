import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(from?: string, to?: string) {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, cookCategory: true } } } },
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalDiscount = orders.reduce((s, o) => s + o.discount, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by payment method
    const revenueByPayment = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.paymentMethod] = (acc[o.paymentMethod] ?? 0) + o.total;
      return acc;
    }, {});

    // Orders by status
    const ordersByStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    // Top products by quantity sold
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const name = item.product?.name ?? item.productId;
        const existing = productSales.get(item.productId) ?? { name, qty: 0, revenue: 0 };
        productSales.set(item.productId, {
          name,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.price * item.quantity,
        });
      }
    }
    const topProducts = [...productSales.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // Daily revenue (last 30 days or filtered range)
    const dailyRevenue = orders.reduce<Record<string, number>>((acc, o) => {
      const day = new Date(o.createdAt).toISOString().slice(0, 10);
      acc[day] = (acc[day] ?? 0) + o.total;
      return acc;
    }, {});

    const dailyRevenueArr = Object.entries(dailyRevenue)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      revenueByPayment,
      ordersByStatus,
      topProducts,
      dailyRevenue: dailyRevenueArr,
    };
  }
}
