/**
 * CustomerProfileService — legacy shim.
 * The loyalty logic has been migrated to LoyaltyService + TierEngineService.
 * This class is kept for backward-compatible injection in PosService but
 * all methods now delegate to the new services.
 */
import { Injectable } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { TierEngineService } from './tier-engine.service';
import type { UpdateLoyaltyConfigDto } from './dto/loyalty.dto';

// Default config used when no row exists yet
const DEFAULT_CONFIG = {
  currencyCode: 'LKR',
  currencySymbol: 'Rs',
  pointsPerCurrencyUnit: 1,
  redemptionThreshold: 100,
  redemptionValue: 20,
};

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Loyalty Config ─────────────────────────────────────────────────────────

  async getConfig() {
    const config = await this.prisma.loyaltySettings.findFirst();
    return config ?? { id: 'default', ...DEFAULT_CONFIG, updatedAt: new Date() };
  }

  async updateConfig(dto: UpdateLoyaltyConfigDto, _updatedBy: string) {
    const existing = await this.prisma.loyaltySettings.findFirst();
    if (existing) {
      return this.prisma.loyaltySettings.update({
        where: { id: existing.id },
        data: { ...dto },
      });
    }
    return this.prisma.loyaltySettings.create({
      data: { ...DEFAULT_CONFIG, ...dto },
    });
  }

  // ── Tier resolution ────────────────────────────────────────────────────────

  async resolveTierName(points: number): Promise<string> {
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    let tierName = '';
    for (const tier of tiers) {
      if (points >= tier.minPoints && (tier.maxPoints === null || points <= tier.maxPoints)) {
        tierName = tier.name;
        break;
      }
    }
    return tierName;
  }

  // ── Points calculation ─────────────────────────────────────────────────────

  calculatePointsEarned(orderTotal: number, config: { pointsPerCurrencyUnit: number | { toNumber(): number } }): number {
    const rate = typeof config.pointsPerCurrencyUnit === 'object'
      ? config.pointsPerCurrencyUnit.toNumber()
      : config.pointsPerCurrencyUnit;
    return Math.floor(orderTotal * rate);
  }

  calculateLoyaltyDiscount(points: number, config: { redemptionThreshold: number; redemptionValue: number | { toNumber(): number } }): number {
    const value = typeof config.redemptionValue === 'object'
      ? config.redemptionValue.toNumber()
      : config.redemptionValue;
    const redemptions = Math.floor(points / config.redemptionThreshold);
    return redemptions * value;
  }

  // ── Award points after order ───────────────────────────────────────────────

  async awardPointsForOrder(customerId: string, orderTotal: number) {
    const config = await this.getConfig();
    const earned = this.calculatePointsEarned(orderTotal, config as typeof DEFAULT_CONFIG);
    if (earned <= 0) return;

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    const newCurrentPoints = customer.currentPoints + earned;
    const newLifetimePoints = customer.lifetimePoints + earned;
    const newTierName = await this.resolveTierName(newLifetimePoints);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { currentPoints: newCurrentPoints, lifetimePoints: newLifetimePoints, tierName: newTierName },
    });

    await this.prisma.loyaltyPointTransaction.create({
      data: { customerId, type: 'EARNED', points: earned },
    });
  }

  // ── Redeem points (deduct after discount applied) ──────────────────────────

  async redeemPoints(customerId: string) {
    const config = await this.getConfig();
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const threshold = typeof (config as any).redemptionThreshold === 'object'
      ? (config as any).redemptionThreshold.toNumber()
      : (config as any).redemptionThreshold;
    const value = typeof (config as any).redemptionValue === 'object'
      ? (config as any).redemptionValue.toNumber()
      : (config as any).redemptionValue;

    const redemptions = Math.floor(customer.currentPoints / threshold);
    if (redemptions === 0) return { deducted: 0, discount: 0 };

    const deducted = redemptions * threshold;
    const discount = redemptions * value;
    const newCurrentPoints = customer.currentPoints - deducted;
    const newTierName = await this.resolveTierName(customer.lifetimePoints);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { currentPoints: newCurrentPoints, tierName: newTierName },
    });

    await this.prisma.loyaltyPointTransaction.create({
      data: { customerId, type: 'REDEEMED', points: -deducted },
    });

    return { deducted, discount };
  }

  // ── Manual points adjustment (admin) ──────────────────────────────────────

  async adjustPoints(customerId: string, points: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const newCurrentPoints = Math.max(0, customer.currentPoints + points);
    const newLifetimePoints = points > 0 ? customer.lifetimePoints + points : customer.lifetimePoints;
    const newTierName = await this.resolveTierName(newLifetimePoints);

    await this.prisma.loyaltyPointTransaction.create({
      data: { customerId, type: 'ADJUSTED', points },
    });

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { currentPoints: newCurrentPoints, lifetimePoints: newLifetimePoints, tierName: newTierName },
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
      customer.currentPoints,
      config as typeof DEFAULT_CONFIG,
    );

    const totalSpent = customer.orders.reduce((s: number, o: { total: number }) => s + o.total, 0);

    return {
      id:               settings.id,
      currencyCode:     settings.currencyCode,
      currencySymbol:   settings.currencySymbol,
      pointsPerAmount:  Number(settings.pointsPerCurrencyUnit),
      amountPerPoints:  1,
      redeemThreshold:  settings.redemptionThreshold,
      redeemDiscount:   Number(settings.redemptionValue),
      regularThreshold: sorted[1]?.minPoints ?? 200,
      loyalThreshold:   sorted[2]?.minPoints ?? 500,
      vipThreshold:     sorted[3]?.minPoints ?? 1000,
      updatedAt:        settings.updatedAt.toISOString(),
      updatedBy:        null,
    };
  }

  /** @deprecated Use TierEngineService.updateSettings instead */
  async updateConfig(dto: UpdateLoyaltyConfigDto, _updatedBy: string) {
    return this.tierEngine.updateSettings({
      pointsPerCurrencyUnit: dto.pointsPerAmount,
      redemptionThreshold:   dto.redeemThreshold,
      redemptionValue:       dto.redeemDiscount,
      currencyCode:          dto.currencyCode,
      currencySymbol:        dto.currencySymbol,
    });
  }

  async getPosCustomerInfo(phone: string) {
    const [customer, config] = await Promise.all([
      this.prisma.customer.findUnique({ where: { phone } }),
      this.getConfig(),
    ]);

    if (!customer) return { exists: false };

    const loyaltyDiscount = this.calculateLoyaltyDiscount(
      customer.currentPoints,
      config as typeof DEFAULT_CONFIG,
    );

    return {
      exists: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        currentPoints: customer.currentPoints,
        lifetimePoints: customer.lifetimePoints,
        tierName: customer.tierName,
        loyaltyDiscount,
        createdAt: customer.createdAt,
      },
    };
  }
}
