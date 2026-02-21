import { describe, it, expect } from 'vitest';
import {
  StrategyRuleSetSchema,
  validateRuleSetInvariants,
  type StrategyRuleSet,
  type Condition,
  type ConditionGroup,
} from '@/types/strategy';

/** Helper: minimal valid standard rule set */
function makeStandardRuleSet(overrides: Partial<StrategyRuleSet> = {}): StrategyRuleSet {
  const entry: ConditionGroup = overrides.entry ?? {
    op: 'AND',
    conditions: [{
      id: 'entry_1',
      label: 'RSI(14) < 30',
      scope: 'candle',
      left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
      op: 'lt',
      right: { kind: 'number', value: 30 },
    }],
  };

  const exit: ConditionGroup = overrides.exit ?? {
    op: 'AND',
    conditions: [{
      id: 'exit_1',
      label: 'RSI(14) > 70',
      scope: 'candle',
      left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
      op: 'gt',
      right: { kind: 'number', value: 70 },
    }],
  };

  return {
    id: 'test-1',
    name: 'Test Strategy',
    mode: { type: 'standard' },
    entry,
    exit,
    sizing: { type: 'percent_equity', valuePct: 100 },
    ...overrides,
  };
}

/** Helper: minimal valid DCA rule set */
function makeDcaRuleSet(overrides: Partial<StrategyRuleSet> = {}): StrategyRuleSet {
  return {
    id: 'test-dca',
    name: 'Test DCA',
    mode: { type: 'dca', intervalDays: 7, amountUsd: 100 },
    entry: { op: 'AND', conditions: [] },
    exit: { op: 'AND', conditions: [] },
    sizing: { type: 'percent_equity', valuePct: 100 },
    ...overrides,
  };
}

describe('StrategyRuleSetSchema', () => {
  it('parses a valid standard rule set', () => {
    const input = makeStandardRuleSet();
    const result = StrategyRuleSetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('parses a valid DCA rule set', () => {
    const input = makeDcaRuleSet();
    const result = StrategyRuleSetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('applies default sizing (percent_equity 100%)', () => {
    const input = {
      id: 'test',
      name: 'Test',
      mode: { type: 'standard' },
      entry: { op: 'AND', conditions: [{ id: 'e1', label: 'RSI<30', scope: 'candle', left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } }, op: 'lt', right: { kind: 'number', value: 30 } }] },
      exit: { op: 'AND', conditions: [] },
    };
    const result = StrategyRuleSetSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sizing).toEqual({ type: 'percent_equity', valuePct: 100 });
    }
  });

  it('rejects invalid indicator type', () => {
    const input = makeStandardRuleSet({
      entry: {
        op: 'AND',
        conditions: [{
          id: 'e1',
          label: 'bad',
          scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'nonexistent' as never } },
          op: 'gt',
          right: { kind: 'number', value: 0 },
        }],
      },
    });
    const result = StrategyRuleSetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid comparison operator', () => {
    const input = makeStandardRuleSet({
      entry: {
        op: 'AND',
        conditions: [{
          id: 'e1',
          label: 'bad',
          scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
          op: 'between' as never,
          right: { kind: 'number', value: 30 },
        }],
      },
    });
    const result = StrategyRuleSetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects percent_equity outside 1-100', () => {
    const result1 = StrategyRuleSetSchema.safeParse(
      makeStandardRuleSet({ sizing: { type: 'percent_equity', valuePct: 0 } })
    );
    expect(result1.success).toBe(false);

    const result2 = StrategyRuleSetSchema.safeParse(
      makeStandardRuleSet({ sizing: { type: 'percent_equity', valuePct: 101 } })
    );
    expect(result2.success).toBe(false);
  });

  it('rejects negative fixed_amount', () => {
    const result = StrategyRuleSetSchema.safeParse(
      makeStandardRuleSet({ sizing: { type: 'fixed_amount', valueUsd: -100 } })
    );
    expect(result.success).toBe(false);
  });

  it('rejects DCA with non-positive intervalDays', () => {
    const result = StrategyRuleSetSchema.safeParse(
      makeDcaRuleSet({ mode: { type: 'dca', intervalDays: 0, amountUsd: 100 } })
    );
    expect(result.success).toBe(false);
  });
});

describe('validateRuleSetInvariants', () => {
  it('passes for valid standard rule set', () => {
    const result = validateRuleSetInvariants(makeStandardRuleSet());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for valid DCA rule set', () => {
    const result = validateRuleSetInvariants(makeDcaRuleSet());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when standard mode has no entry conditions', () => {
    const rules = makeStandardRuleSet({
      entry: { op: 'AND', conditions: [] },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Standard mode must have at least 1 entry condition.');
  });

  it('warns when standard mode has no exit conditions', () => {
    const rules = makeStandardRuleSet({
      exit: { op: 'AND', conditions: [] },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('errors when DCA mode has entry conditions', () => {
    const rules = makeDcaRuleSet({
      entry: {
        op: 'AND',
        conditions: [{
          id: 'e1', label: 'RSI<30', scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
          op: 'lt', right: { kind: 'number', value: 30 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('DCA mode must have empty entry conditions');
  });

  it('errors when DCA mode has exit conditions', () => {
    const rules = makeDcaRuleSet({
      exit: {
        op: 'AND',
        conditions: [{
          id: 'x1', label: 'RSI>70', scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
          op: 'gt', right: { kind: 'number', value: 70 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('DCA mode must have empty exit conditions');
  });

  it('errors when crosses_above has a number operand', () => {
    const rules = makeStandardRuleSet({
      entry: {
        op: 'AND',
        conditions: [{
          id: 'e1', label: 'SMA crosses 100', scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'sma', period: 50 } },
          op: 'crosses_above',
          right: { kind: 'number', value: 100 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('crosses_above requires indicator operands on both sides');
  });

  it('passes when crosses_above has indicator operands on both sides', () => {
    const rules = makeStandardRuleSet({
      entry: {
        op: 'AND',
        conditions: [{
          id: 'e1', label: 'SMA(50) crosses above SMA(200)', scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'sma', period: 50 } },
          op: 'crosses_above',
          right: { kind: 'indicator', indicator: { type: 'sma', period: 200 } },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(true);
  });

  it('errors when position scope used without pnl_pct or bars_in_trade', () => {
    const rules = makeStandardRuleSet({
      exit: {
        op: 'AND',
        conditions: [{
          id: 'x1', label: 'RSI > 70 (position scope)', scope: 'position',
          left: { kind: 'indicator', indicator: { type: 'rsi', period: 14 } },
          op: 'gt', right: { kind: 'number', value: 70 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('scope "position" is only valid with pnl_pct or bars_in_trade');
  });

  it('passes when position scope used with pnl_pct', () => {
    const rules = makeStandardRuleSet({
      exit: {
        op: 'AND',
        conditions: [{
          id: 'x1', label: 'PnL >= 15%', scope: 'position',
          left: { kind: 'indicator', indicator: { type: 'pnl_pct' } },
          op: 'gte', right: { kind: 'number', value: 15 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(true);
  });

  it('passes when position scope used with bars_in_trade', () => {
    const rules = makeStandardRuleSet({
      exit: {
        op: 'OR',
        conditions: [{
          id: 'x1', label: 'Bars >= 30', scope: 'position',
          left: { kind: 'indicator', indicator: { type: 'bars_in_trade' } },
          op: 'gte', right: { kind: 'number', value: 30 },
        }],
      },
    });
    const result = validateRuleSetInvariants(rules);
    expect(result.valid).toBe(true);
  });
});
