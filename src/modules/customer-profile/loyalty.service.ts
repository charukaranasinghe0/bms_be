import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TierEngineService } from './tier-engine.service';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tierEngine: TierEngineService,
  ) {}

  // ── Add points after a purchase ───────────────────────────────────────────
  async addPoints(customerId: string, amountSpent: number, orderId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const settings = await this.tierEngine.getSettings();
    const multiplierResult = await this.tierEngine.evaluateCustomerTier(customer.lifetimePoints);
    const earned = Math.floor(
      amountSpent * Number(settings.pointsPerCurrencyUnit) * multiplierResult.multiplier,
    );

    if (earned <= 0) return customer;

    const newLifetime = customer.lifetimePoints + earned;
    const newCurrent  = customer.currentPoints  + earned;
    const newTierEval = await this.tierEngine.evaluateCustomerTier(newLifetime);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          currentPoints:  newCurrent,
          lifetimePoints: newLifetime,
          tierName:       newTierEval.tierName,
        },
      });

      await tx.loyaltyPointTransaction.create({
        data: {
          customerId,
          type:    'EARNED',
          points:  earned,
          orderId,
          note:    `Earned ${earned} pts on ${newTierEval.tierName} tier (${newTierEval.multiplier}×)`,
        },
      });

      return updated;
    });
  }

  // ── Redeem points at checkout ─────────────────────────────────────────────
  async redeemPoints(customerId: string, orderId?: string) {
    const [customer, settings] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.tierEngine.getSettings(),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');

    const threshold = settings.redemptionThreshold;
    const value     = Number(settings.redemptionValue);

    if (customer.currentPoints < threshold) {
      throw new BadRequestException(
        `Need at least ${threshold} points to redeem. Current balance: ${customer.currentPoints}`,
      );
    }

    const blocks   = Math.floor(customer.currentPoints / threshold);
    const deducted = blocks * threshold;
    const discount = blocks * value;

    return this.prisma.$transaction(async (tx) => {
      const newCurrent = customer.currentPoints - deducted;
      if (newCurrent < 0) throw new BadRequestException('Insufficient points after concurrent update');

      const updated = await tx.customer.update({
        where: { id: customerId },
        data:  { currentPoints: newCurrent },
      });

      await tx.loyaltyPointTransaction.create({
        data: {
          customerId,
          type:    'REDEEMED',
          points:  -deducted,
          orderId: orderId ?? null,
          note:    `Redeemed ${deducted} pts for ${discount} discount`,
        },
      });

      return { customer: updated, deducted, discount };
    });
  }

  // ── Manual admin adjustment ───────────────────────────────────────────────
  async adjustPoints(customerId: string, delta: number, note?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const newCurrent  = Math.max(0, customer.currentPoints  + delta);
    const newLifetime = delta > 0 ? customer.lifetimePoints + delta : customer.lifetimePoints;
    const newTierEval = await this.tierEngine.evaluateCustomerTier(newLifetime);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data:  { currentPoints: newCurrent, lifetimePoints: newLifetime, tierName: newTierEval.tierName },
      });

      await tx.loyaltyPointTransaction.create({
        data: {
          customerId,
          type:   'ADJUSTED',
          points: delta,
          note:   note ?? `Manual adjustment: ${delta > 0 ? '+' : ''}${delta}`,
        },
      });

      return updated;
    });
  }

  // ── Transaction history ───────────────────────────────────────────────────
  async getTransactions(customerId: string, skip = 0, take = 20) {
    const [txs, total] = await Promise.all([
      this.prisma.loyaltyPointTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.loyaltyPointTransaction.count({ where: { customerId } }),
    ]);
    return { transactions: txs, total };
  }

  async getPosCustomerInfo(phone: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) return { exists: false as const };

    const [tierEval, settings] = await Promise.all([
      this.tierEngine.evaluateCustomerTier(customer.lifetimePoints),
      this.tierEngine.getSettings(),
    ]);

    const redeemableBlocks = Math.floor(customer.currentPoints / settings.redemptionThreshold);
    const loyaltyDiscount  = redeemableBlocks * Number(settings.redemptionValue);

    return {
      exists: true as const,
      data: {
        id:             customer.id,
        name:           customer.name,
        phone:          customer.phone,
        email:          customer.email,
        loyaltyPoints:  customer.currentPoints,
        customerType:   tierEval.tierName,
        loyaltyDiscount,
        createdAt:      customer.createdAt,
      },
    };
  }

  // ── Full customer loyalty profile ─────────────────────────────────────────
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.buildProfileResponse(customer);
  }

  async getProfileByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.buildProfileResponse(customer);
  }

  async buildProfileResponse(customer: {
    id: string; name: string; email: string | null; phone: string;
    currentPoints: number; lifetimePoints: number; tierName: string; createdAt: Date;
    orders: { id: string; total: number; discount: number; paymentMethod: string; status: string; createdAt: Date;
      items: { quantity: number; price: number; product: { name: string } }[] }[];
  }) {
    const [tierEval, settings] = await Promise.all([
      this.tierEngine.evaluateCustomerTier(customer.lifetimePoints),
      this.tierEngine.getSettings(),
    ]);

    const threshold = settings.redemptionThreshold;
    const value     = Number(settings.redemptionValue);
    const redeemableBlocks  = Math.floor(customer.currentPoints / threshold);
    const availableDiscount = redeemableBlocks * value;

    return {
      ...customer,
      tierName:          tierEval.tierName,
      tierLabel:         tierEval.tierName,
      tierMultiplier:    tierEval.multiplier,
      perksConfig:       tierEval.perksConfig,
      freeCoffee:        !!(tierEval.perksConfig?.free_coffee),
      toNextTier:        tierEval.toNextTier,
      nextTier:          tierEval.nextTierName,
      nextTierMin:       tierEval.nextTierMin,
      redeemableBlocks,
      availableDiscount,
      loyaltyPoints:     customer.currentPoints,
      customerType:      tierEval.tierName,
      loyaltyDiscount:   availableDiscount,
      totalSpent:        customer.orders.reduce((s, o) => s + o.total, 0),
      totalOrders:       customer.orders.length,
    };
  }
}
