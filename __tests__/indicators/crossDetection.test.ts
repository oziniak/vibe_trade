import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '@/engine/evaluator';
import { computeSMA } from '@/indicators/sma';
import type { Candle } from '@/types/results';
import type { Condition, Operand, IndicatorSpec } from '@/types/strategy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkCandle(c: number, date: string): Candle {
  return { t: date, o: c, h: c, l: c, c, v: 1000 };
}

function indOp(spec: IndicatorSpec): Operand {
  return { kind: 'indicator', indicator: spec };
}

function crossCondition(
  leftSpec: IndicatorSpec,
  op: 'crosses_above' | 'crosses_below',
  rightSpec: IndicatorSpec,
): Condition {
  return {
    id: 'cross-test',
    label: `cross test`,
    scope: 'candle',
    left: indOp(leftSpec),
    op,
    right: indOp(rightSpec),
  };
}

// ---------------------------------------------------------------------------
// Test 1: SMA(5) crosses above SMA(20) at a known index
// ---------------------------------------------------------------------------

describe('SMA(5) crosses above SMA(20)', () => {
  // Construct 25 candles with closing prices that cause SMA(5) to cross above SMA(20).
  //
  // Strategy: start with declining prices so SMA(5) < SMA(20), then inject a sharp
  // rise so SMA(5) overtakes SMA(20) at a known crossover point.
  //
  // Phase 1 (index 0-19): stable low prices around 100
  // Phase 2 (index 20-24): sharp rise to 200+
  //
  // SMA(5) reacts faster to the rise, crossing above the slower SMA(20).

  const closingPrices = [
    100, 101, 99, 100, 98,  // 0-4
    97, 96, 95, 94, 93,     // 5-9
    92, 91, 90, 89, 88,     // 10-14
    87, 86, 85, 84, 83,     // 15-19  — long downtrend, SMA(5) < SMA(20)
    120, 140, 160, 180, 200, // 20-24  — sharp reversal
  ];

  const candles = closingPrices.map((c, i) => mkCandle(c, `2024-01-${String(i + 1).padStart(2, '0')}`));

  const sma5 = computeSMA(closingPrices, 5);
  const sma20 = computeSMA(closingPrices, 20);

  const cache: Record<string, (number | null)[]> = {
    sma_5: sma5,
    sma_20: sma20,
  };

  const cond = crossCondition(
    { type: 'sma', period: 5 },
    'crosses_above',
    { type: 'sma', period: 20 },
  );

  it('SMA(5) is below SMA(20) before the crossover', () => {
    // At index 19 (last of downtrend), SMA(5) should be below SMA(20)
    const sma5at19 = sma5[19];
    const sma20at19 = sma20[19];
    expect(sma5at19).not.toBeNull();
    expect(sma20at19).not.toBeNull();
    expect(sma5at19!).toBeLessThan(sma20at19!);
  });

  it('crosses_above fires at the crossover index', () => {
    // Find the first index where SMA(5) > SMA(20) and at i-1 SMA(5) <= SMA(20)
    let crossIndex = -1;
    for (let i = 20; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null && sma5[i - 1] !== null && sma20[i - 1] !== null) {
        if (sma5[i - 1]! <= sma20[i - 1]! && sma5[i]! > sma20[i]!) {
          crossIndex = i;
          break;
        }
      }
    }
    expect(crossIndex).toBeGreaterThan(19);

    // evaluateCondition should return true at crossIndex
    expect(evaluateCondition(cond, crossIndex, candles, cache, null)).toBe(true);
  });

  it('crosses_above does not fire at indices before the crossover', () => {
    // Check indices 19 and 20 (before cross completes) — should not fire
    for (let i = 19; i <= 19; i++) {
      if (sma5[i] !== null && sma20[i] !== null) {
        expect(evaluateCondition(cond, i, candles, cache, null)).toBe(false);
      }
    }
  });

  it('crosses_above does not fire after the crossover (already above)', () => {
    // Find the cross index first
    let crossIndex = -1;
    for (let i = 20; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null && sma5[i - 1] !== null && sma20[i - 1] !== null) {
        if (sma5[i - 1]! <= sma20[i - 1]! && sma5[i]! > sma20[i]!) {
          crossIndex = i;
          break;
        }
      }
    }

    // After crossIndex, SMA(5) stays above SMA(20) — should not fire again
    for (let i = crossIndex + 1; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null) {
        expect(evaluateCondition(cond, i, candles, cache, null)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: Crossing does not fire when lines are parallel
// ---------------------------------------------------------------------------

describe('crosses_above does not fire when lines are parallel', () => {
  // Both SMAs track parallel: SMA(5) always below SMA(20), no crossing
  const closingPrices = [
    100, 100, 100, 100, 100, // 0-4
    100, 100, 100, 100, 100, // 5-9
    100, 100, 100, 100, 100, // 10-14
    100, 100, 100, 100, 100, // 15-19
    100, 100, 100, 100, 100, // 20-24
  ];

  const candles = closingPrices.map((c, i) => mkCandle(c, `2024-01-${String(i + 1).padStart(2, '0')}`));

  const sma5 = computeSMA(closingPrices, 5);
  const sma20 = computeSMA(closingPrices, 20);

  const cache: Record<string, (number | null)[]> = {
    sma_5: sma5,
    sma_20: sma20,
  };

  it('no crosses_above fires on flat data', () => {
    const cond = crossCondition(
      { type: 'sma', period: 5 },
      'crosses_above',
      { type: 'sma', period: 20 },
    );

    for (let i = 0; i < closingPrices.length; i++) {
      expect(evaluateCondition(cond, i, candles, cache, null)).toBe(false);
    }
  });

  it('no crosses_below fires on flat data', () => {
    const cond = crossCondition(
      { type: 'sma', period: 5 },
      'crosses_below',
      { type: 'sma', period: 20 },
    );

    for (let i = 0; i < closingPrices.length; i++) {
      expect(evaluateCondition(cond, i, candles, cache, null)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Crossing does not fire when already above (no actual cross)
// ---------------------------------------------------------------------------

describe('crosses_above does not fire when already above', () => {
  // SMA(5) is consistently above SMA(20) throughout — never crosses
  // Rising prices where short SMA stays above long SMA
  const closingPrices = [
    // Ascending: SMA(5) will always be >= SMA(20) once warmed up
    50, 52, 54, 56, 58,   // 0-4
    60, 62, 64, 66, 68,   // 5-9
    70, 72, 74, 76, 78,   // 10-14
    80, 82, 84, 86, 88,   // 15-19
    90, 92, 94, 96, 98,   // 20-24
  ];

  const candles = closingPrices.map((c, i) => mkCandle(c, `2024-01-${String(i + 1).padStart(2, '0')}`));

  const sma5 = computeSMA(closingPrices, 5);
  const sma20 = computeSMA(closingPrices, 20);

  const cache: Record<string, (number | null)[]> = {
    sma_5: sma5,
    sma_20: sma20,
  };

  it('SMA(5) is above SMA(20) for all valid indices', () => {
    // After warmup for SMA(20) at index 19, check that SMA(5) > SMA(20)
    for (let i = 19; i < closingPrices.length; i++) {
      expect(sma5[i]).not.toBeNull();
      expect(sma20[i]).not.toBeNull();
      expect(sma5[i]!).toBeGreaterThan(sma20[i]!);
    }
  });

  it('crosses_above never fires because SMA(5) was always above', () => {
    const cond = crossCondition(
      { type: 'sma', period: 5 },
      'crosses_above',
      { type: 'sma', period: 20 },
    );

    for (let i = 0; i < closingPrices.length; i++) {
      expect(evaluateCondition(cond, i, candles, cache, null)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: crosses_below works symmetrically
// ---------------------------------------------------------------------------

describe('crosses_below works symmetrically', () => {
  // Construct data where SMA(5) crosses below SMA(20).
  // Start with rising prices (SMA(5) > SMA(20)), then sharp drop.

  const closingPrices = [
    200, 199, 201, 200, 202, // 0-4
    203, 204, 205, 206, 207, // 5-9
    208, 209, 210, 211, 212, // 10-14
    213, 214, 215, 216, 217, // 15-19  — uptrend, SMA(5) > SMA(20)
    180, 160, 140, 120, 100, // 20-24  — sharp drop
  ];

  const candles = closingPrices.map((c, i) => mkCandle(c, `2024-01-${String(i + 1).padStart(2, '0')}`));

  const sma5 = computeSMA(closingPrices, 5);
  const sma20 = computeSMA(closingPrices, 20);

  const cache: Record<string, (number | null)[]> = {
    sma_5: sma5,
    sma_20: sma20,
  };

  const condBelow = crossCondition(
    { type: 'sma', period: 5 },
    'crosses_below',
    { type: 'sma', period: 20 },
  );

  const condAbove = crossCondition(
    { type: 'sma', period: 5 },
    'crosses_above',
    { type: 'sma', period: 20 },
  );

  it('SMA(5) is above SMA(20) before the drop', () => {
    const s5 = sma5[19];
    const s20 = sma20[19];
    expect(s5).not.toBeNull();
    expect(s20).not.toBeNull();
    expect(s5!).toBeGreaterThan(s20!);
  });

  it('crosses_below fires at the crossover index', () => {
    let crossIndex = -1;
    for (let i = 20; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null && sma5[i - 1] !== null && sma20[i - 1] !== null) {
        if (sma5[i - 1]! >= sma20[i - 1]! && sma5[i]! < sma20[i]!) {
          crossIndex = i;
          break;
        }
      }
    }
    expect(crossIndex).toBeGreaterThan(19);
    expect(evaluateCondition(condBelow, crossIndex, candles, cache, null)).toBe(true);
  });

  it('crosses_above does NOT fire during the drop', () => {
    for (let i = 20; i < closingPrices.length; i++) {
      expect(evaluateCondition(condAbove, i, candles, cache, null)).toBe(false);
    }
  });

  it('crosses_below does not fire after already below', () => {
    // Find cross index
    let crossIndex = -1;
    for (let i = 20; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null && sma5[i - 1] !== null && sma20[i - 1] !== null) {
        if (sma5[i - 1]! >= sma20[i - 1]! && sma5[i]! < sma20[i]!) {
          crossIndex = i;
          break;
        }
      }
    }

    // After cross, should not fire again
    for (let i = crossIndex + 1; i < closingPrices.length; i++) {
      if (sma5[i] !== null && sma20[i] !== null) {
        expect(evaluateCondition(condBelow, i, candles, cache, null)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test 5: Edge case — crossing at exact equality (touching)
// ---------------------------------------------------------------------------

describe('crossing edge case: touching at equality', () => {
  // Manually constructed data where values touch (equal) then diverge.
  // crosses_above: prev left <= prev right AND current left > current right
  // If prev is exactly equal and current goes above, it should fire.

  const cache: Record<string, (number | null)[]> = {
    sma_5: [10, 20, 30, 30, 35],
    sma_20: [15, 25, 30, 35, 30],
  };

  const candles = Array.from({ length: 5 }, (_, i) =>
    mkCandle(100 + i, `2024-01-${String(i + 1).padStart(2, '0')}`),
  );

  it('crosses_above fires when prev values are exactly equal and current goes above', () => {
    // At i=4: prev sma5=30, prev sma20=35 => 30 <= 35 true, curr sma5=35, curr sma20=30 => 35 > 30 true => fires
    const cond = crossCondition(
      { type: 'sma', period: 5 },
      'crosses_above',
      { type: 'sma', period: 20 },
    );
    expect(evaluateCondition(cond, 4, candles, cache, null)).toBe(true);
  });

  it('crosses_below fires when prev values are exactly equal and current goes below', () => {
    // At i=3: prev sma5=30, prev sma20=30 => 30 >= 30 true, curr sma5=30, curr sma20=35 => 30 < 35 true => fires
    const cond = crossCondition(
      { type: 'sma', period: 5 },
      'crosses_below',
      { type: 'sma', period: 20 },
    );
    expect(evaluateCondition(cond, 3, candles, cache, null)).toBe(true);
  });
});
