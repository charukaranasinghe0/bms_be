/**
 * Property-based tests for the Loyalty / Tier system.
 *
 * Tests use evaluateTierFromList (pure, synchronous) from TierEngineService
 * and inline redemption math — no DB or NestJS DI needed.
 *
 * Run with: npx jest loyalty.property.spec --runInBand
 */

/// <reference types="jest" />

import { TierEngineService } from './tier-engine.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal tier list matching the default seed: DOUGH / PASTRY / ARTISAN */
const TIERS = [
  { id: 't1', name: 'DOUGH',   minPoints: 0,   maxPoints: 199,  pointMultiplier: 1.0 as unknown as import('@prisma/client').Prisma.Decimal, perksConfig: { free_coffee: false } },
  { id: 't2', name: 'PASTRY',  minPoints: 200,  maxPoints: 499,  pointMultiplier: 1.5 as unknown as import('@prisma/client').Prisma.Decimal, perksConfig: { free_coffee: false } },
  { id: 't3', name: 'ARTISAN', minPoints: 500,  maxPoints: null, pointMultiplier: 2.0 as unknown as import('@prisma/client').Prisma.Decimal, perksConfig: { free_coffee: true  } },
];

const BASE_POINTS_PER_CURRENCY_UNIT = 1; // matches default LoyaltySettings seed
const REDEEM_THRESHOLD  = 100;           // matches default LoyaltySettings seed
const REDEEM_VALUE      = 20;            // matches default LoyaltySettings seed

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomInts(n: number, min: number, max: number): number[] {
  return Array.from({ length: n }, () =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  );
}

function randomFloats(n: number, min: number, max: number): number[] {
  return Array.from({ length: n }, () => Math.random() * (max - min) + min);
}

/** Pure points-earned calculation (mirrors LoyaltyService.addPoints math) */
function calcEarned(amountSpent: number, lifetimePoints: number): number {
  const tier = evaluateTier(lifetimePoints);
  return Math.floor(amountSpent * BASE_POINTS_PER_CURRENCY_UNIT * tier.multiplier);
}

/** Thin wrapper around the synchronous evaluator */
function evaluateTier(lifetimePoints: number) {
  // Access the static method directly without instantiating the full service
  return TierEngineService.prototype.evaluateTierFromList.call(null, lifetimePoints, TIERS);
}

/** Pure redemption simulation */
function simulateRedeem(currentPoints: number): { newBalance: number; discount: number; deducted: number } {
  if (currentPoints < REDEEM_THRESHOLD) throw new Error('Insufficient points');
  const blocks     = Math.floor(currentPoints / REDEEM_THRESHOLD);
  const deducted   = blocks * REDEEM_THRESHOLD;
  const discount   = blocks * REDEEM_VALUE;
  const newBalance = currentPoints - deducted;
  return { newBalance, discount, deducted };
}

// ── Tier resolution properties ────────────────────────────────────────────────

describe('evaluateTierFromList — tier boundaries', () => {
  test('0–199 lifetime points always resolves to DOUGH', () => {
    randomInts(200, 0, 199).forEach((pts) => {
      expect(evaluateTier(pts).tierName).toBe('DOUGH');
    });
  });

  test('200–499 lifetime points always resolves to PASTRY', () => {
    randomInts(200, 200, 499).forEach((pts) => {
      expect(evaluateTier(pts).tierName).toBe('PASTRY');
    });
  });

  test('500+ lifetime points always resolves to ARTISAN', () => {
    randomInts(200, 500, 5000).forEach((pts) => {
      expect(evaluateTier(pts).tierName).toBe('ARTISAN');
    });
  });

  test('tier is monotonically non-decreasing as lifetime points increase', () => {
    const order: Record<string, number> = { DOUGH: 0, PASTRY: 1, ARTISAN: 2 };
    const points = [0, 50, 199, 200, 300, 499, 500, 1000, 9999];
    for (let i = 1; i < points.length; i++) {
      const prev = order[evaluateTier(points[i - 1]).tierName];
      const curr = order[evaluateTier(points[i]).tierName];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  test('multiplier is always a positive number', () => {
    randomInts(200, 0, 5000).forEach((pts) => {
      expect(evaluateTier(pts).multiplier).toBeGreaterThan(0);
    });
  });

  test('ARTISAN freeCoffee perk is true only for ARTISAN tier', () => {
    expect(evaluateTier(0).perksConfig?.free_coffee).toBeFalsy();
    expect(evaluateTier(200).perksConfig?.free_coffee).toBeFalsy();
    expect(evaluateTier(500).perksConfig?.free_coffee).toBe(true);
  });
});

// ── Points earned properties ──────────────────────────────────────────────────

describe('calcEarned — multiplier correctness', () => {
  test('DOUGH tier: earned = floor(amount × 1.0)', () => {
    randomFloats(100, 1, 199).forEach((amount) => {
      const pts = randomInts(1, 0, 199)[0];
      expect(calcEarned(amount, pts)).toBe(Math.floor(amount * 1.0));
    });
  });

  test('PASTRY tier: earned = floor(amount × 1.5)', () => {
    randomFloats(100, 1, 500).forEach((amount) => {
      const pts = randomInts(1, 200, 499)[0];
      expect(calcEarned(amount, pts)).toBe(Math.floor(amount * 1.5));
    });
  });

  test('ARTISAN tier: earned = floor(amount × 2.0)', () => {
    randomFloats(100, 1, 1000).forEach((amount) => {
      const pts = randomInts(1, 500, 5000)[0];
      expect(calcEarned(amount, pts)).toBe(Math.floor(amount * 2.0));
    });
  });

  test('earned points are always non-negative integers', () => {
    randomFloats(200, 0, 10000).forEach((amount) => {
      const pts = randomInts(1, 0, 10000)[0];
      const earned = calcEarned(amount, pts);
      expect(earned).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(earned)).toBe(true);
    });
  });

  test('higher tier always earns >= lower tier for same spend', () => {
    randomFloats(100, 1, 500).forEach((amount) => {
      const dough   = calcEarned(amount, 0);
      const pastry  = calcEarned(amount, 200);
      const artisan = calcEarned(amount, 500);
      expect(pastry).toBeGreaterThanOrEqual(dough);
      expect(artisan).toBeGreaterThanOrEqual(pastry);
    });
  });
});

// ── Redemption safety properties ──────────────────────────────────────────────

describe('simulateRedeem — redemption invariants', () => {
  test('balance never goes negative after redemption', () => {
    randomInts(200, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      expect(simulateRedeem(pts).newBalance).toBeGreaterThanOrEqual(0);
    });
  });

  test('throws when points < threshold', () => {
    randomInts(100, 0, REDEEM_THRESHOLD - 1).forEach((pts) => {
      expect(() => simulateRedeem(pts)).toThrow('Insufficient points');
    });
  });

  test('discount is always a positive multiple of REDEEM_VALUE', () => {
    randomInts(100, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      const { discount } = simulateRedeem(pts);
      expect(discount).toBeGreaterThan(0);
      expect(discount % REDEEM_VALUE).toBe(0);
    });
  });

  test('remainder after redemption is always < REDEEM_THRESHOLD', () => {
    randomInts(100, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      expect(simulateRedeem(pts).newBalance).toBeLessThan(REDEEM_THRESHOLD);
    });
  });

  test('deducted + newBalance === original points', () => {
    randomInts(100, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      const { deducted, newBalance } = simulateRedeem(pts);
      expect(deducted + newBalance).toBe(pts);
    });
  });
});

// ── Tier upgrade invariant ────────────────────────────────────────────────────

describe('tier upgrade invariant', () => {
  test('adding points never decreases tier', () => {
    const order: Record<string, number> = { DOUGH: 0, PASTRY: 1, ARTISAN: 2 };
    randomInts(200, 0, 2000).forEach((lifetime) => {
      const before = order[evaluateTier(lifetime).tierName];
      const after  = order[evaluateTier(lifetime + randomInts(1, 1, 100)[0]).tierName];
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  test('toNextTier is null at the top tier', () => {
    randomInts(50, 500, 5000).forEach((pts) => {
      expect(evaluateTier(pts).toNextTier).toBeNull();
    });
  });

  test('toNextTier is positive for non-top tiers', () => {
    randomInts(50, 0, 498).forEach((pts) => {
      const result = evaluateTier(pts);
      expect(result.toNextTier).not.toBeNull();
      expect(result.toNextTier!).toBeGreaterThan(0);
    });
  });
});

// ── validateContinuousRanges properties ──────────────────────────────────────

describe('validateContinuousRanges — range validation', () => {
  // Instantiate just enough to call the synchronous validator
  const svc = Object.create(TierEngineService.prototype) as TierEngineService;

  test('valid continuous ranges pass without throwing', () => {
    expect(() =>
      svc.validateContinuousRanges([
        { name: 'A', minPoints: 0,   maxPoints: 99  },
        { name: 'B', minPoints: 100, maxPoints: 199 },
        { name: 'C', minPoints: 200, maxPoints: null },
      ]),
    ).not.toThrow();
  });

  test('throws when ranges do not start at 0', () => {
    expect(() =>
      svc.validateContinuousRanges([
        { name: 'A', minPoints: 10, maxPoints: 99 },
        { name: 'B', minPoints: 100, maxPoints: null },
      ]),
    ).toThrow();
  });

  test('throws when there is a gap between tiers', () => {
    expect(() =>
      svc.validateContinuousRanges([
        { name: 'A', minPoints: 0,   maxPoints: 99  },
        { name: 'B', minPoints: 101, maxPoints: null }, // gap at 100
      ]),
    ).toThrow();
  });

  test('throws when there is an overlap between tiers', () => {
    expect(() =>
      svc.validateContinuousRanges([
        { name: 'A', minPoints: 0,  maxPoints: 100 },
        { name: 'B', minPoints: 99, maxPoints: null }, // overlaps A
      ]),
    ).toThrow();
  });

  test('empty tier list passes (valid empty state)', () => {
    expect(() => svc.validateContinuousRanges([])).not.toThrow();
  });
});
