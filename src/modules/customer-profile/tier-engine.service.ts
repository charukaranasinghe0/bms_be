import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoyaltyTier, LoyaltySettings } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TierDto {
  name: string;
  minPoints: number;
  maxPoints: number | null;
  pointMultiplier: number;
  perksConfig: Record<string, unknown>;
}

export interface EvaluatedTier {
  tierId: string;
  tierName: string;
  multiplier: number;
  perksConfig: Record<string, unknown>;
  toNextTier: number | null;   // null = already at top
  nextTierName: string | null;
  nextTierMin: number | null;
}

// ── In-process cache ──────────────────────────────────────────────────────────
// Tiers change rarely; cache for 60 s to avoid a DB hit on every POS calculation.

interface TierCache {
  tiers: LoyaltyTier[];
  settings: LoyaltySettings;
  cachedAt: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class TierEngineService implements OnModuleInit {
  private cache: TierCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  // ── Cache helpers ─────────────────────────────────────────────────────────

  invalidateCache() {
    this.cache = null;
  }

  async getActiveTiers(): Promise<LoyaltyTier[]> {
    if (this.cache && Date.now() - this.cache.cachedAt < CACHE_TTL_MS) {
      return this.cache.tiers;
    }
    await this.refreshCache();
    return this.cache!.tiers;
  }

  async getSettings(): Promise<LoyaltySettings> {
    if (this.cache && Date.now() - this.cache.cachedAt < CACHE_TTL_MS) {
      return this.cache.settings;
    }
    await this.refreshCache();
    return this.cache!.settings;
  }

  private async refreshCache() {
    const [tiers, settings] = await Promise.all([
      this.prisma.loyaltyTier.findMany({
        where: { isActive: true },
        orderBy: { minPoints: 'asc' },
      }),
      this.prisma.loyaltySettings.findFirst(),
    ]);

    if (!settings) throw new Error('LoyaltySettings not seeded');

    this.cache = { tiers, settings, cachedAt: Date.now() };
  }

  // ── Default seed (idempotent) ─────────────────────────────────────────────

  async ensureDefaults() {
    const count = await this.prisma.loyaltyTier.count();
    if (count > 0) return;

    await this.prisma.$transaction([
      this.prisma.loyaltySettings.create({
        data: {
          pointsPerCurrencyUnit: 1,
          redemptionThreshold: 50,
          redemptionValue: 5,
          currencyCode: 'USD',
          currencySymbol: '$',
        },
      }),
      this.prisma.loyaltyTier.createMany({
        data: [
          { name: 'Dough',   minPoints: 0,   maxPoints: 199, pointMultiplier: 1.0, sortOrder: 1, perksConfig: {} },
          { name: 'Pastry',  minPoints: 200, maxPoints: 499, pointMultiplier: 1.5, sortOrder: 2, perksConfig: {} },
          { name: 'Artisan', minPoints: 500, maxPoints: null, pointMultiplier: 2.0, sortOrder: 3,
            perksConfig: { free_coffee: true, birthday_discount: 10 } },
        ],
      }),
    ]);
  }

  // ── Core evaluator ────────────────────────────────────────────────────────
  // O(n) scan over sorted tiers — n is tiny (typically 3-10).

  async evaluateCustomerTier(lifetimePoints: number): Promise<EvaluatedTier> {
    const tiers = await this.getActiveTiers(); // sorted asc by minPoints

    let matched: LoyaltyTier | null = null;

    for (const tier of tiers) {
      const withinMax = tier.maxPoints === null || lifetimePoints <= tier.maxPoints;
      if (lifetimePoints >= tier.minPoints && withinMax) {
        matched = tier;
        break;
      }
    }

    // Fallback: if somehow no tier matches (gap in rules), use the lowest tier
    if (!matched) matched = tiers[0];
    if (!matched) throw new Error('No active loyalty tiers configured');

    const currentIdx = tiers.findIndex((t) => t.id === matched!.id);
    const nextTier   = tiers[currentIdx + 1] ?? null;

    return {
      tierId:       matched.id,
      tierName:     matched.name,
      multiplier:   Number(matched.pointMultiplier),
      perksConfig:  matched.perksConfig as Record<string, unknown>,
      toNextTier:   nextTier ? Math.max(0, nextTier.minPoints - lifetimePoints) : null,
      nextTierName: nextTier?.name ?? null,
      nextTierMin:  nextTier?.minPoints ?? null,
    };
  }

  // ── Range validator ───────────────────────────────────────────────────────
  // Validates that the full set of tiers (after applying the proposed change)
  // forms a perfectly continuous, non-overlapping range starting at 0.

  validateContinuousRanges(
    tiers: { name: string; minPoints: number; maxPoints: number | null }[],
    excludeId?: string,
  ) {
    if (tiers.length === 0) return; // no tiers = valid (empty state)

    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);

    // 1. Must start at 0
    if (sorted[0].minPoints !== 0) {
      throw new BadRequestException(
        `Tier ranges must start at 0. The lowest tier starts at ${sorted[0].minPoints}.`,
      );
    }

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next    = sorted[i + 1];

      // 2. Only the last tier may have null maxPoints
      if (current.maxPoints === null && next !== undefined) {
        throw new BadRequestException(
          `Only the highest tier may have an open-ended range (maxPoints = null). ` +
          `"${current.name}" has null maxPoints but is not the last tier.`,
        );
      }

      // 3. maxPoints must be >= minPoints
      if (current.maxPoints !== null && current.maxPoints < current.minPoints) {
        throw new BadRequestException(
          `Tier "${current.name}": maxPoints (${current.maxPoints}) must be >= minPoints (${current.minPoints}).`,
        );
      }

      if (next) {
        // 4. No gaps: next.minPoints must equal current.maxPoints + 1
        if (current.maxPoints !== null && next.minPoints !== current.maxPoints + 1) {
          throw new BadRequestException(
            `Gap detected between "${current.name}" (max ${current.maxPoints}) ` +
            `and "${next.name}" (min ${next.minPoints}). ` +
            `Expected next tier to start at ${current.maxPoints + 1}.`,
          );
        }

        // 5. No overlaps: next.minPoints must be > current.maxPoints
        if (current.maxPoints !== null && next.minPoints <= current.maxPoints) {
          throw new BadRequestException(
            `Overlap detected: "${current.name}" ends at ${current.maxPoints} ` +
            `but "${next.name}" starts at ${next.minPoints}.`,
          );
        }
      }
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async listTiers() {
    return this.prisma.loyaltyTier.findMany({ orderBy: { minPoints: 'asc' } });
  }

  async createTier(dto: TierDto) {
    // Check name uniqueness
    const existing = await this.prisma.loyaltyTier.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`A tier named "${dto.name}" already exists.`);

    // Fetch current active tiers + simulate adding the new one
    const current = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      select: { name: true, minPoints: true, maxPoints: true },
    });

    const proposed = [
      ...current,
      { name: dto.name, minPoints: dto.minPoints, maxPoints: dto.maxPoints },
    ];

    this.validateContinuousRanges(proposed);

    const maxSort = current.length > 0
      ? Math.max(...(await this.prisma.loyaltyTier.findMany({ select: { sortOrder: true } })).map((t) => t.sortOrder))
      : 0;

    const tier = await this.prisma.loyaltyTier.create({
      data: {
        name:            dto.name,
        minPoints:       dto.minPoints,
        maxPoints:       dto.maxPoints,
        pointMultiplier: dto.pointMultiplier,
        perksConfig:     dto.perksConfig as object,
        sortOrder:       maxSort + 1,
      },
    });

    this.invalidateCache();
    return tier;
  }

  async updateTier(id: string, dto: Partial<TierDto>) {
    const existing = await this.prisma.loyaltyTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tier not found');

    // Name uniqueness check (if renaming)
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.loyaltyTier.findUnique({ where: { name: dto.name } });
      if (conflict) throw new ConflictException(`A tier named "${dto.name}" already exists.`);
    }

    // Simulate the update in the full tier set and validate ranges
    const allTiers = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, minPoints: true, maxPoints: true },
    });

    const proposed = allTiers.map((t) =>
      t.id === id
        ? {
            name:      dto.name      ?? t.name,
            minPoints: dto.minPoints ?? t.minPoints,
            maxPoints: dto.maxPoints !== undefined ? dto.maxPoints : t.maxPoints,
          }
        : { name: t.name, minPoints: t.minPoints, maxPoints: t.maxPoints },
    );

    this.validateContinuousRanges(proposed);

    const updated = await this.prisma.loyaltyTier.update({
      where: { id },
      data: {
        ...(dto.name            !== undefined && { name: dto.name }),
        ...(dto.minPoints       !== undefined && { minPoints: dto.minPoints }),
        ...(dto.maxPoints       !== undefined && { maxPoints: dto.maxPoints }),
        ...(dto.pointMultiplier !== undefined && { pointMultiplier: dto.pointMultiplier }),
        ...(dto.perksConfig     !== undefined && { perksConfig: dto.perksConfig as object }),
      },
    });

    this.invalidateCache();

    // Recalculate all customers whose tierName matches the old name
    if (dto.name && dto.name !== existing.name) {
      await this.prisma.customer.updateMany({
        where: { tierName: existing.name },
        data:  { tierName: dto.name },
      });
    }

    return updated;
  }

  async deleteTier(id: string) {
    const tier = await this.prisma.loyaltyTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Tier not found');

    const activeTiers = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, minPoints: true, maxPoints: true },
    });

    if (activeTiers.length <= 1) {
      throw new BadRequestException('Cannot delete the last active tier. At least one tier must exist.');
    }

    // Validate that the remaining tiers still form a valid range
    const remaining = activeTiers.filter((t) => t.id !== id);
    try {
      this.validateContinuousRanges(remaining);
    } catch {
      throw new BadRequestException(
        `Deleting "${tier.name}" would create a gap or overlap in the tier ranges. ` +
        `Adjust adjacent tier boundaries first.`,
      );
    }

    await this.prisma.loyaltyTier.delete({ where: { id } });
    this.invalidateCache();

    // ── Safe fallback: recalculate all affected customers ─────────────────
    // Customers who were in the deleted tier get re-evaluated against remaining rules.
    const affectedCustomers = await this.prisma.customer.findMany({
      where: { tierName: tier.name },
      select: { id: true, lifetimePoints: true },
    });

    if (affectedCustomers.length > 0) {
      const freshTiers = await this.prisma.loyaltyTier.findMany({
        where: { isActive: true },
        orderBy: { minPoints: 'asc' },
      });

      const updates = affectedCustomers.map((c) => {
        const newTier = this.evaluateTierFromList(c.lifetimePoints, freshTiers);
        return this.prisma.customer.update({
          where: { id: c.id },
          data:  { tierName: newTier.tierName },
        });
      });

      await this.prisma.$transaction(updates);
    }

    return { deleted: tier.name, affectedCustomers: affectedCustomers.length };
  }

  // ── Synchronous evaluator (used internally with a pre-fetched list) ───────

  evaluateTierFromList(
    lifetimePoints: number,
    tiers: Pick<LoyaltyTier, 'id' | 'name' | 'minPoints' | 'maxPoints' | 'pointMultiplier' | 'perksConfig'>[],
  ): EvaluatedTier {
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    let matched = sorted[0]; // default to lowest

    for (const tier of sorted) {
      const withinMax = tier.maxPoints === null || lifetimePoints <= tier.maxPoints;
      if (lifetimePoints >= tier.minPoints && withinMax) {
        matched = tier;
        break;
      }
    }

    const currentIdx = sorted.findIndex((t) => t.id === matched.id);
    const nextTier   = sorted[currentIdx + 1] ?? null;

    return {
      tierId:       matched.id,
      tierName:     matched.name,
      multiplier:   Number(matched.pointMultiplier),
      perksConfig:  matched.perksConfig as Record<string, unknown>,
      toNextTier:   nextTier ? Math.max(0, nextTier.minPoints - lifetimePoints) : null,
      nextTierName: nextTier?.name ?? null,
      nextTierMin:  nextTier?.minPoints ?? null,
    };
  }

  // ── Settings CRUD ─────────────────────────────────────────────────────────

  async getSettingsOrThrow(): Promise<LoyaltySettings> {
    const s = await this.prisma.loyaltySettings.findFirst();
    if (!s) throw new NotFoundException('Loyalty settings not found');
    return s;
  }

  async updateSettings(data: Partial<{
    pointsPerCurrencyUnit: number;
    redemptionThreshold: number;
    redemptionValue: number;
    currencyCode: string;
    currencySymbol: string;
  }>) {
    const existing = await this.prisma.loyaltySettings.findFirst();
    if (!existing) throw new NotFoundException('Loyalty settings not found');

    const updated = await this.prisma.loyaltySettings.update({
      where: { id: existing.id },
      data,
    });

    this.invalidateCache();
    return updated;
  }

  // ── Bulk recalculate all customers (admin utility) ────────────────────────

  async recalculateAllCustomerTiers() {
    const [customers, tiers] = await Promise.all([
      this.prisma.customer.findMany({ select: { id: true, lifetimePoints: true } }),
      this.prisma.loyaltyTier.findMany({ where: { isActive: true }, orderBy: { minPoints: 'asc' } }),
    ]);

    const updates = customers.map((c) => {
      const evaluated = this.evaluateTierFromList(c.lifetimePoints, tiers);
      return this.prisma.customer.update({
        where: { id: c.id },
        data:  { tierName: evaluated.tierName },
      });
    });

    await this.prisma.$transaction(updates);
    return { recalculated: customers.length };
  }
}
