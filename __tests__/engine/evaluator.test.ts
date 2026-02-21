import { describe, it, expect } from 'vitest';
import {
  indicatorKey,
  resolveOperand,
  evaluateCondition,
  evaluateGroup,
} from '@/engine/evaluator';
import type { OpenPosition } from '@/engine/evaluator';
import type { Candle } from '@/types/results';
import type { Condition, ConditionGroup, Operand, IndicatorSpec } from '@/types/strategy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal candle for testing */
function mkCandle(o: number, h: number, l: number, c: number, v: number, date = '2024-01-01'): Candle {
  return { t: date, o, h, l, c, v };
}

/** Shorthand: 5 test candles with known OHLCV */
const testCandles: Candle[] = [
  mkCandle(100, 110, 90, 105, 1000, '2024-01-01'),
  mkCandle(105, 115, 95, 110, 1100, '2024-01-02'),
  mkCandle(110, 120, 100, 108, 1200, '2024-01-03'),
  mkCandle(108, 118, 98, 115, 1300, '2024-01-04'),
  mkCandle(115, 125, 105, 120, 1400, '2024-01-05'),
];

/** Number operand helper */
function numOp(value: number): Operand {
  return { kind: 'number', value };
}

/** Indicator operand helper */
function indOp(spec: IndicatorSpec): Operand {
  return { kind: 'indicator', indicator: spec };
}

// ---------------------------------------------------------------------------
// indicatorKey
// ---------------------------------------------------------------------------

describe('indicatorKey', () => {
  it('creates key for simple indicator', () => {
    expect(indicatorKey({ type: 'sma', period: 50 })).toBe('sma_50');
  });

  it('creates key for MACD with all params', () => {
    expect(indicatorKey({ type: 'macd_line', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }))
      .toBe('macd_line_12_26_9');
  });

  it('creates key for Bollinger with stdDev', () => {
    expect(indicatorKey({ type: 'bb_upper', period: 20, stdDev: 2 }))
      .toBe('bb_upper_20_2');
  });

  it('creates key for indicator with source', () => {
    expect(indicatorKey({ type: 'sma', period: 14, source: 'high' }))
      .toBe('sma_14_high');
  });

  it('creates key for bare indicator type (no params)', () => {
    expect(indicatorKey({ type: 'price_close' })).toBe('price_close');
  });
});

// ---------------------------------------------------------------------------
// resolveOperand — number operands
// ---------------------------------------------------------------------------

describe('resolveOperand with number operands', () => {
  it('returns the literal value regardless of candle index', () => {
    const op = numOp(42);
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(42);
    expect(resolveOperand(op, 3, testCandles, {}, null)).toBe(42);
  });

  it('returns zero for a zero literal', () => {
    expect(resolveOperand(numOp(0), 0, testCandles, {}, null)).toBe(0);
  });

  it('returns negative number', () => {
    expect(resolveOperand(numOp(-5.5), 0, testCandles, {}, null)).toBe(-5.5);
  });
});

// ---------------------------------------------------------------------------
// resolveOperand — price operands
// ---------------------------------------------------------------------------

describe('resolveOperand with price operands', () => {
  it('price_close returns candle close', () => {
    const op = indOp({ type: 'price_close' });
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(105);
    expect(resolveOperand(op, 4, testCandles, {}, null)).toBe(120);
  });

  it('price_open returns candle open', () => {
    const op = indOp({ type: 'price_open' });
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(100);
    expect(resolveOperand(op, 2, testCandles, {}, null)).toBe(110);
  });

  it('price_high returns candle high', () => {
    const op = indOp({ type: 'price_high' });
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(110);
    expect(resolveOperand(op, 3, testCandles, {}, null)).toBe(118);
  });

  it('price_low returns candle low', () => {
    const op = indOp({ type: 'price_low' });
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(90);
    expect(resolveOperand(op, 1, testCandles, {}, null)).toBe(95);
  });

  it('volume returns candle volume', () => {
    const op = indOp({ type: 'volume' });
    expect(resolveOperand(op, 0, testCandles, {}, null)).toBe(1000);
    expect(resolveOperand(op, 4, testCandles, {}, null)).toBe(1400);
  });
});

// ---------------------------------------------------------------------------
// resolveOperand — cached indicator values
// ---------------------------------------------------------------------------

describe('resolveOperand with cached indicator values', () => {
  const cache: Record<string, (number | null)[]> = {
    sma_5: [null, null, null, null, 108],
    rsi_14: [null, null, null, null, 65.3],
    ema_20: [null, null, 50.5, 51.2, 52.0],
  };

  it('returns cached SMA value at valid index', () => {
    const op = indOp({ type: 'sma', period: 5 });
    expect(resolveOperand(op, 4, testCandles, cache, null)).toBe(108);
  });

  it('returns null during warmup period', () => {
    const op = indOp({ type: 'sma', period: 5 });
    expect(resolveOperand(op, 2, testCandles, cache, null)).toBeNull();
  });

  it('returns null for missing indicator in cache', () => {
    const op = indOp({ type: 'sma', period: 10 });
    expect(resolveOperand(op, 4, testCandles, cache, null)).toBeNull();
  });

  it('returns cached RSI value', () => {
    const op = indOp({ type: 'rsi', period: 14 });
    expect(resolveOperand(op, 4, testCandles, cache, null)).toBe(65.3);
  });

  it('returns cached EMA value at non-null index', () => {
    const op = indOp({ type: 'ema', period: 20 });
    expect(resolveOperand(op, 3, testCandles, cache, null)).toBe(51.2);
  });
});

// ---------------------------------------------------------------------------
// resolveOperand — position-scope (pnl_pct, bars_in_trade)
// ---------------------------------------------------------------------------

describe('resolveOperand with position-scope indicators', () => {
  const position: OpenPosition = { entryPrice: 100, entryIndex: 1 };

  it('pnl_pct computes percentage gain', () => {
    const op = indOp({ type: 'pnl_pct' });
    // candle[3].c = 115, entry = 100 => (115-100)/100 * 100 = 15%
    expect(resolveOperand(op, 3, testCandles, {}, position)).toBe(15);
  });

  it('pnl_pct computes percentage loss', () => {
    const op = indOp({ type: 'pnl_pct' });
    // Use candle[0].c = 105, entry = 100 => 5%
    // For a loss scenario, create a position with higher entry price
    const lossPos: OpenPosition = { entryPrice: 120, entryIndex: 0 };
    // candle[2].c = 108, entry = 120 => (108-120)/120 * 100 = -10%
    expect(resolveOperand(op, 2, testCandles, {}, lossPos)).toBe(-10);
  });

  it('pnl_pct returns null when no position', () => {
    const op = indOp({ type: 'pnl_pct' });
    expect(resolveOperand(op, 3, testCandles, {}, null)).toBeNull();
  });

  it('bars_in_trade returns correct bar count', () => {
    const op = indOp({ type: 'bars_in_trade' });
    // i=3, entryIndex=1 => 2 bars
    expect(resolveOperand(op, 3, testCandles, {}, position)).toBe(2);
  });

  it('bars_in_trade returns 0 at entry index', () => {
    const op = indOp({ type: 'bars_in_trade' });
    expect(resolveOperand(op, 1, testCandles, {}, position)).toBe(0);
  });

  it('bars_in_trade returns null when no position', () => {
    const op = indOp({ type: 'bars_in_trade' });
    expect(resolveOperand(op, 3, testCandles, {}, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — comparison operators
// ---------------------------------------------------------------------------

describe('evaluateCondition comparison operators', () => {
  function mkCondition(
    left: Operand,
    op: Condition['op'],
    right: Operand,
    scope: 'candle' | 'position' = 'candle',
  ): Condition {
    return { id: 'test', label: 'test', scope, left, op, right };
  }

  it('lt: 105 < 110 is true', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'lt',
      numOp(110),
    );
    // candle[0].c = 105
    expect(evaluateCondition(cond, 0, testCandles, {}, null)).toBe(true);
  });

  it('lt: 110 < 110 is false', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'lt',
      numOp(110),
    );
    // candle[1].c = 110
    expect(evaluateCondition(cond, 1, testCandles, {}, null)).toBe(false);
  });

  it('lte: 110 <= 110 is true', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'lte',
      numOp(110),
    );
    expect(evaluateCondition(cond, 1, testCandles, {}, null)).toBe(true);
  });

  it('gt: 120 > 115 is true', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'gt',
      numOp(115),
    );
    // candle[4].c = 120
    expect(evaluateCondition(cond, 4, testCandles, {}, null)).toBe(true);
  });

  it('gt: 115 > 115 is false', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'gt',
      numOp(115),
    );
    // candle[3].c = 115
    expect(evaluateCondition(cond, 3, testCandles, {}, null)).toBe(false);
  });

  it('gte: 115 >= 115 is true', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'gte',
      numOp(115),
    );
    expect(evaluateCondition(cond, 3, testCandles, {}, null)).toBe(true);
  });

  it('eq: 105 === 105 is true', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'eq',
      numOp(105),
    );
    expect(evaluateCondition(cond, 0, testCandles, {}, null)).toBe(true);
  });

  it('eq: 105 === 110 is false', () => {
    const cond = mkCondition(
      indOp({ type: 'price_close' }),
      'eq',
      numOp(110),
    );
    expect(evaluateCondition(cond, 0, testCandles, {}, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — null values
// ---------------------------------------------------------------------------

describe('evaluateCondition with null values', () => {
  function mkCondition(left: Operand, op: Condition['op'], right: Operand): Condition {
    return { id: 'test', label: 'test', scope: 'candle', left, op, right };
  }

  const cache: Record<string, (number | null)[]> = {
    sma_50: [null, null, null, null, null],
  };

  it('returns false when left operand is null (warmup)', () => {
    const cond = mkCondition(
      indOp({ type: 'sma', period: 50 }),
      'gt',
      numOp(100),
    );
    expect(evaluateCondition(cond, 0, testCandles, cache, null)).toBe(false);
  });

  it('returns false when right operand is null (warmup)', () => {
    const cond = mkCondition(
      numOp(100),
      'gt',
      indOp({ type: 'sma', period: 50 }),
    );
    expect(evaluateCondition(cond, 0, testCandles, cache, null)).toBe(false);
  });

  it('returns false when indicator is not in cache at all', () => {
    const cond = mkCondition(
      indOp({ type: 'ema', period: 200 }),
      'gt',
      numOp(100),
    );
    expect(evaluateCondition(cond, 0, testCandles, {}, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — crosses_above and crosses_below
// ---------------------------------------------------------------------------

describe('evaluateCondition crosses_above and crosses_below', () => {
  function mkCondition(left: Operand, op: Condition['op'], right: Operand): Condition {
    return { id: 'test', label: 'test', scope: 'candle', left, op, right };
  }

  // Construct indicator cache where fast SMA crosses above slow SMA at index 3
  //   fast: [10, 20, 25, 35, 40]
  //   slow: [15, 25, 30, 30, 28]
  // At i=2: fast=25 <= slow=30
  // At i=3: fast=35 > slow=30  => crosses_above fires
  const cache: Record<string, (number | null)[]> = {
    sma_5: [10, 20, 25, 35, 40],
    sma_20: [15, 25, 30, 30, 28],
  };

  it('crosses_above detects crossing at the right index', () => {
    const cond = mkCondition(
      indOp({ type: 'sma', period: 5 }),
      'crosses_above',
      indOp({ type: 'sma', period: 20 }),
    );
    expect(evaluateCondition(cond, 3, testCandles, cache, null)).toBe(true);
  });

  it('crosses_above does not fire when already above', () => {
    const cond = mkCondition(
      indOp({ type: 'sma', period: 5 }),
      'crosses_above',
      indOp({ type: 'sma', period: 20 }),
    );
    // At i=4: prev(fast=35) > prev(slow=30), so prevLeft > prevRight => not a cross
    expect(evaluateCondition(cond, 4, testCandles, cache, null)).toBe(false);
  });

  it('crosses_above returns false at index 0 (no previous candle)', () => {
    const cond = mkCondition(
      indOp({ type: 'sma', period: 5 }),
      'crosses_above',
      indOp({ type: 'sma', period: 20 }),
    );
    expect(evaluateCondition(cond, 0, testCandles, cache, null)).toBe(false);
  });

  it('crosses_above returns false when values are equal (no actual cross)', () => {
    // At i=1: prev fast=10 <= prev slow=15 (yes), but current fast=20 <= slow=25 (not above)
    const cond = mkCondition(
      indOp({ type: 'sma', period: 5 }),
      'crosses_above',
      indOp({ type: 'sma', period: 20 }),
    );
    expect(evaluateCondition(cond, 1, testCandles, cache, null)).toBe(false);
  });

  // crosses_below: construct data where fast drops below slow at index 2
  //   fast: [50, 40, 25, 20, 15]
  //   slow: [30, 30, 30, 30, 30]
  // At i=1: fast=40 >= slow=30
  // At i=2: fast=25 < slow=30  => crosses_below fires
  const cacheBelow: Record<string, (number | null)[]> = {
    ema_5: [50, 40, 25, 20, 15],
    ema_20: [30, 30, 30, 30, 30],
  };

  it('crosses_below detects crossing at the right index', () => {
    const cond = mkCondition(
      indOp({ type: 'ema', period: 5 }),
      'crosses_below',
      indOp({ type: 'ema', period: 20 }),
    );
    expect(evaluateCondition(cond, 2, testCandles, cacheBelow, null)).toBe(true);
  });

  it('crosses_below does not fire when already below', () => {
    const cond = mkCondition(
      indOp({ type: 'ema', period: 5 }),
      'crosses_below',
      indOp({ type: 'ema', period: 20 }),
    );
    // At i=3: prev fast=25 < prev slow=30, so prevLeft < prevRight => not >=, no cross
    expect(evaluateCondition(cond, 3, testCandles, cacheBelow, null)).toBe(false);
  });

  it('crosses_above returns false when previous values are null', () => {
    const cacheWithNull: Record<string, (number | null)[]> = {
      sma_5: [null, null, 25, 35, 40],
      sma_20: [null, null, 30, 30, 28],
    };
    const cond = mkCondition(
      indOp({ type: 'sma', period: 5 }),
      'crosses_above',
      indOp({ type: 'sma', period: 20 }),
    );
    // At i=2: prev values at i=1 are null => false
    expect(evaluateCondition(cond, 2, testCandles, cacheWithNull, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — position scope without open position
// ---------------------------------------------------------------------------

describe('evaluateCondition position scope', () => {
  it('returns false when position scope but no open position', () => {
    const cond: Condition = {
      id: 'pnl-check',
      label: 'pnl > 5%',
      scope: 'position',
      left: indOp({ type: 'pnl_pct' }),
      op: 'gt',
      right: numOp(5),
    };
    expect(evaluateCondition(cond, 3, testCandles, {}, null)).toBe(false);
  });

  it('evaluates correctly when position scope and position is open', () => {
    const cond: Condition = {
      id: 'pnl-check',
      label: 'pnl > 5%',
      scope: 'position',
      left: indOp({ type: 'pnl_pct' }),
      op: 'gt',
      right: numOp(5),
    };
    const pos: OpenPosition = { entryPrice: 100, entryIndex: 0 };
    // candle[3].c = 115 => pnl = 15% > 5% => true
    expect(evaluateCondition(cond, 3, testCandles, {}, pos)).toBe(true);
  });

  it('bars_in_trade condition works with position', () => {
    const cond: Condition = {
      id: 'bars-check',
      label: 'bars >= 3',
      scope: 'position',
      left: indOp({ type: 'bars_in_trade' }),
      op: 'gte',
      right: numOp(3),
    };
    const pos: OpenPosition = { entryPrice: 100, entryIndex: 0 };
    // i=3, entryIndex=0 => bars=3 >= 3 => true
    expect(evaluateCondition(cond, 3, testCandles, {}, pos)).toBe(true);
    // i=2 => bars=2 >= 3 => false
    expect(evaluateCondition(cond, 2, testCandles, {}, pos)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateGroup — AND semantics
// ---------------------------------------------------------------------------

describe('evaluateGroup AND semantics', () => {
  function mkCondition(left: Operand, op: Condition['op'], right: Operand): Condition {
    return { id: 'test', label: 'test', scope: 'candle', left, op, right };
  }

  it('returns true when all conditions are true', () => {
    const group: ConditionGroup = {
      op: 'AND',
      conditions: [
        // candle[4].c = 120 > 100
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(100)),
        // candle[4].c = 120 < 200
        mkCondition(indOp({ type: 'price_close' }), 'lt', numOp(200)),
      ],
    };
    expect(evaluateGroup(group, 4, testCandles, {}, null)).toBe(true);
  });

  it('returns false when one condition is false', () => {
    const group: ConditionGroup = {
      op: 'AND',
      conditions: [
        // candle[0].c = 105 > 100 => true
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(100)),
        // candle[0].c = 105 > 110 => false
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(110)),
      ],
    };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(false);
  });

  it('returns false when all conditions are false', () => {
    const group: ConditionGroup = {
      op: 'AND',
      conditions: [
        // candle[0].c = 105 > 200 => false
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(200)),
        // candle[0].c = 105 < 50 => false
        mkCondition(indOp({ type: 'price_close' }), 'lt', numOp(50)),
      ],
    };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateGroup — OR semantics
// ---------------------------------------------------------------------------

describe('evaluateGroup OR semantics', () => {
  function mkCondition(left: Operand, op: Condition['op'], right: Operand): Condition {
    return { id: 'test', label: 'test', scope: 'candle', left, op, right };
  }

  it('returns true when at least one condition is true', () => {
    const group: ConditionGroup = {
      op: 'OR',
      conditions: [
        // candle[0].c = 105 > 200 => false
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(200)),
        // candle[0].c = 105 > 100 => true
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(100)),
      ],
    };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(true);
  });

  it('returns false when all conditions are false', () => {
    const group: ConditionGroup = {
      op: 'OR',
      conditions: [
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(200)),
        mkCondition(indOp({ type: 'price_close' }), 'lt', numOp(50)),
      ],
    };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(false);
  });

  it('returns true when all conditions are true', () => {
    const group: ConditionGroup = {
      op: 'OR',
      conditions: [
        mkCondition(indOp({ type: 'price_close' }), 'gt', numOp(100)),
        mkCondition(indOp({ type: 'price_close' }), 'lt', numOp(200)),
      ],
    };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateGroup — empty group semantics
// ---------------------------------------------------------------------------

describe('evaluateGroup empty group semantics', () => {
  it('empty AND group returns true (vacuous truth)', () => {
    const group: ConditionGroup = { op: 'AND', conditions: [] };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(true);
  });

  it('empty OR group returns false', () => {
    const group: ConditionGroup = { op: 'OR', conditions: [] };
    expect(evaluateGroup(group, 0, testCandles, {}, null)).toBe(false);
  });
});
