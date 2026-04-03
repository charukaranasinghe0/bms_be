import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateLoyaltyConfigDto } from './dto/loyalty.dto';

// Default config used when no row exists yet
const DEFAULT_CONFIG = {
  currencyCode: 'LKR',
  currencySymbol: 'Rs',
  pointsPerAmount: 1,
  amountPerPoints: 100,
  redeemThreshold: 100,
  redeemDiscount: 20,
  regularThreshold: 50,
  loyalThreshold: 200,
  vipThreshold: 500,
};

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Loyalty Config ─────────────────────────────────────────────────────────

  async getConfig() {
    const config = await this.prisma.loyaltyConfig.findFirst();
    return config ?? { id: 'default', ...DEFAULT_CONFIG, updatedAt: new Date(), updatedBy: null };
  }

  async updateConfig(dto: UpdateLoyaltyConfigDto, updatedBy: string) {
    const existing = await this.prisma.loyaltyConfig.findFirst();
    if (existing) {
      return this.prisma.loyaltyConfig.update({
        where: { id: existing.id },
        data: { ...dto, updatedBy },
      });
    }
    return this.prisma.loyaltyConfig.create({
      data: { ...DEFAULT_CONFIG, ...dto, updatedBy },
    });
  }

  // ── Customer type resolution ───────────────────────────────────────────────

  resolveCustomerType(points: number, config: typeof DEFAULT_CONFIG): string {
    if (points >= config.vipThreshold) return 'VIP';
    if (points >= config.loyalThreshold) return 'LOYAL';
    if (points >= config.regularThreshold) return 'REGULAR';
    return 'NEW';
  }

  // ── Points calculation ─────────────────────────────────────────────────────

  calculatePointsEarned(orderTotal: number, config: typeof DEFAULT_CONFIG): number {
    return Math.floor((orderTotal / config.amountPerPoints) * config.pointsPerAmount);
  }

  calculateLoyaltyDiscount(points: number, config: typeof DEFAULT_CONFIG): number {
    const redemptions = Math.floor(points / config.redeemThreshold);
    return redemptions * config.redeemDiscount;
  }

  // ── Award points after order ───────────────────────────────────────────────

  async awardPointsForOrder(customerId: string, orderTotal: number) {
    const config = await this.getConfig();
    const earned = this.calculatePointsEarned(orderTotal, config as typeof DEFAULT_CONFIG);
    if (earned <= 0) return;

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    const newPoints = customer.loyaltyPoints + earned;
    const newType = this.resolveCustomerType(newPoints, config as typeof DEFAULT_CONFIG);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newPoints, customerType: newType },
    });
  }

  // ── Redeem points (deduct after discount applied) ──────────────────────────

  async redeemPoints(customerId: string) {
    const config = await this.getConfig();
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const redemptions = Math.floor(customer.loyaltyPoints / config.redeemThreshold);
    if (redemptions === 0) return { deducted: 0, discount: 0 };

    const deducted = redemptions * config.redeemThreshold;
    const discount = redemptions * config.redeemDiscount;
    const newPoints = customer.loyaltyPoints - deducted;
    const newType = this.resolveCustomerType(newPoints, config as typeof DEFAULT_CONFIG);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newPoints, customerType: newType },
    });

    return { deducted, discount };
  }

  // ── Manual points adjustment (admin) ──────────────────────────────────────

  async adjustPoints(customerId: string, points: number) {
    const config = await this.getConfig();
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const newPoints = Math.max(0, customer.loyaltyPoints + points);
    const newType = this.resolveCustomerType(newPoints, config as typeof DEFAULT_CONFIG);

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newPoints, customerType: newType },
    });
  }

  // ── Full customer profile ──────────────────────────────────────────────────

  async getProfile(customerId: string) {
    const [customer, config] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              items: {
                include: { product: { select: { name: true } } },
              },
            },
          },
        },
      }),
      this.getConfig(),
    ]);

    if (!customer) throw new NotFoundException('Customer not found');

    const loyaltyDiscount = this.calculateLoyaltyDiscount(
      customer.loyaltyPoints,
      config as typeof DEFAULT_CONFIG,
    );

    const totalSpent = customer.orders.reduce((s, o) => s + o.total, 0);

    return {
      ...customer,
      loyaltyDiscount,
      totalSpent,
      totalOrders: customer.orders.length,
      config,
    };
  }

  async getProfileByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.getProfile(customer.id);
  }

  // ── POS lookup — lightweight with loyalty info ─────────────────────────────

  async getPosCustomerInfo(phone: string) {
    const [customer, config] = await Promise.all([
      this.prisma.customer.findUnique({ where: { phone } }),
      this.getConfig(),
    ]);

    if (!customer) return { exists: false };

    const loyaltyDiscount = this.calculateLoyaltyDiscount(
      customer.loyaltyPoints,
      config as typeof DEFAULT_CONFIG,
    );

    return {
      exists: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyaltyPoints: customer.loyaltyPoints,
        customerType: customer.customerType,
        loyaltyDiscount,
        createdAt: customer.createdAt,
      },
    };
  }
}
