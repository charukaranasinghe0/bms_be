/**
 * Property-based tests for the Loyalty / Tier system.
 *
 * These tests use pure functions from loyalty.service.ts so no DB is needed.
 * Run with: npx jest loyalty.property.spec --runInBand
 */

import {
  resolveTier,
  calculateEarnedPoints,
  TIER_CONFIG,
  REDEEM_THRESHOLD,
  REDEEM_DISCOUNT_VALUE,
  BASE_POINTS_PER_DOLLAR,
} from './loyalty.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate N random integers in [min, max] */
function randomInts(n: number, min: number, max: number): number[] {
  return Array.from({ length: n }, () =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  );
}

function randomFloats(n: number, min: number, max: number): number[] {
  return Array.from({ length: n }, () => Math.random() * (max - min) + min);
}

// ── Tier resolution properties ────────────────────────────────────────────────

describe('resolveTier — tier boundaries', () => {
  test('lifetime 0–199 always resolves to DOUGH', () => {
    randomInts(200, 0, 199).forEach((pts) => {
      expect(resolveTier(pts)).toBe('DOUGH');
    });
  });

  test('lifetime 200–499 always resolves to PASTRY', () => {
    randomInts(200, 200, 499).forEach((pts) => {
      expect(resolveTier(pts)).toBe('PASTRY');
    });
  });

  test('lifetime 500+ always resolves to ARTISAN', () => {
    randomInts(200, 500, 5000).forEach((pts) => {
      expect(resolveTier(pts)).toBe('ARTISAN');
    });
  });

  test('tier is monotonically non-decreasing as lifetime points increase', () => {
    const tierOrder = { DOUGH: 0, PASTRY: 1, ARTISAN: 2 };
    const points = [0, 50, 199, 200, 300, 499, 500, 1000, 9999];
    for (let i = 1; i < points.length; i++) {
      const prev = tierOrder[resolveTier(points[i - 1])];
      const curr = tierOrder[resolveTier(points[i])];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

// ── Multiplier math properties ────────────────────────────────────────────────

describe('calculateEarnedPoints — multiplier correctness', () => {
  test('DOUGH tier: earned = floor(amount * 1.0)', () => {
    randomFloats(100, 1, 199).forEach((amount) => {
      const lifetimePts = randomInts(1, 0, 199)[0];
      const earned = calculateEarnedPoints(amount, lifetimePts);
      const expected = Math.floor(amount * BASE_POINTS_PER_DOLLAR * TIER_CONFIG.DOUGH.multiplier);
      expect(earned).toBe(expected);
    });
  });

  test('PASTRY tier: earned = floor(amount * 1.5)', () => {
    randomFloats(100, 1, 500).forEach((amount) => {
      const lifetimePts = randomInts(1, 200, 499)[0];
      const earned = calculateEarnedPoints(amount, lifetimePts);
      const expected = Math.floor(amount * BASE_POINTS_PER_DOLLAR * TIER_CONFIG.PASTRY.multiplier);
      expect(earned).toBe(expected);
    });
  });

  test('ARTISAN tier: earned = floor(amount * 2.0)', () => {
    randomFloats(100, 1, 1000).forEach((amount) => {
      const lifetimePts = randomInts(1, 500, 5000)[0];
      const earned = calculateEarnedPoints(amount, lifetimePts);
      const expected = Math.floor(amount * BASE_POINTS_PER_DOLLAR * TIER_CONFIG.ARTISAN.multiplier);
      expect(earned).toBe(expected);
    });
  });

  test('earned points are always non-negative integers', () => {
    randomFloats(200, 0, 10000).forEach((amount) => {
      const lifetimePts = randomInts(1, 0, 10000)[0];
      const earned = calculateEarnedPoints(amount, lifetimePts);
      expect(earned).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(earned)).toBe(true);
    });
  });

  test('higher tier always earns >= lower tier for same spend', () => {
    randomFloats(100, 1, 500).forEach((amount) => {
      const dough   = calculateEarnedPoints(amount, 0);
      const pastry  = calculateEarnedPoints(amount, 200);
      const artisan = calculateEarnedPoints(amount, 500);
      expect(pastry).toBeGreaterThanOrEqual(dough);
      expect(artisan).toBeGreaterThanOrEqual(pastry);
    });
  });
});

// ── Redemption safety properties ──────────────────────────────────────────────

describe('redemption logic — cannot go negative', () => {
  /**
   * Simulate the redemption calculation (pure, no DB).
   * Returns newBalance or throws if insufficient.
   */
  function simulateRedeem(currentPoints: number): { newBalance: number; discount: number } {
    if (currentPoints < REDEEM_THRESHOLD) {
      throw new Error('Insufficient points');
    }
    const blocks     = Math.floor(currentPoints / REDEEM_THRESHOLD);
    const deducted   = blocks * REDEEM_THRESHOLD;
    const discount   = blocks * REDEEM_DISCOUNT_VALUE;
    const newBalance = currentPoints - deducted;
    return { newBalance, discount };
  }

  test('balance never goes negative after redemption', () => {
    randomInts(200, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      const { newBalance } = simulateRedeem(pts);
      expect(newBalance).toBeGreaterThanOrEqual(0);
    });
  });

  test('redemption throws when points < threshold', () => {
    randomInts(100, 0, REDEEM_THRESHOLD - 1).forEach((pts) => {
      expect(() => simulateRedeem(pts)).toThrow('Insufficient points');
    });
  });

  test('discount is always a positive multiple of REDEEM_DISCOUNT_VALUE', () => {
    randomInts(100, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      const { discount } = simulateRedeem(pts);
      expect(discount).toBeGreaterThan(0);
      expect(discount % REDEEM_DISCOUNT_VALUE).toBe(0);
    });
  });

  test('remainder after redemption is always < REDEEM_THRESHOLD', () => {
    randomInts(100, REDEEM_THRESHOLD, 5000).forEach((pts) => {
      const { newBalance } = simulateRedeem(pts);
      expect(newBalance).toBeLessThan(REDEEM_THRESHOLD);
    });
  });
});

// ── Tier upgrade invariant ────────────────────────────────────────────────────

describe('tier upgrade invariant', () => {
  test('adding points never decreases tier', () => {
    const tierOrder = { DOUGH: 0, PASTRY: 1, ARTISAN: 2 };
    randomInts(200, 0, 2000).forEach((lifetime) => {
      const before = tierOrder[resolveTier(lifetime)];
      const after  = tierOrder[resolveTier(lifetime + randomInts(1, 1, 100)[0])];
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  test('ARTISAN freeCoffee flag is only true for ARTISAN tier', () => {
    (['DOUGH', 'PASTRY', 'ARTISAN'] as const).forEach((tier) => {
      if (tier === 'ARTISAN') {
        expect(TIER_CONFIG[tier].freeCoffee).toBe(true);
      } else {
        expect(TIER_CONFIG[tier].freeCoffee).toBe(false);
      }
    });
  });
});
