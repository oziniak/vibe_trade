import type { Condition, ConditionGroup, Operand, IndicatorSpec } from '@/types/strategy';
import type { Candle } from '@/types/results';

/** Open position info for position-scope evaluation */
export interface OpenPosition {
  entryPrice: number;
  entryIndex: number;
}

/** Generate a unique cache key for an indicator spec */
export function indicatorKey(spec: IndicatorSpec): string {
  // Create a deterministic string key like "sma_50" or "macd_12_26_9" or "bb_upper_20_2"
  const parts: string[] = [spec.type];
  if (spec.period !== undefined) parts.push(String(spec.period));
  if (spec.fastPeriod !== undefined) parts.push(String(spec.fastPeriod));
  if (spec.slowPeriod !== undefined) parts.push(String(spec.slowPeriod));
  if (spec.signalPeriod !== undefined) parts.push(String(spec.signalPeriod));
  if (spec.stdDev !== undefined) parts.push(String(spec.stdDev));
  if (spec.source !== undefined) parts.push(spec.source);
  return parts.join('_');
}

/** Resolve an operand value at candle index i */
export function resolveOperand(
  operand: Operand,
  i: number,
  candles: Candle[],
  indicatorCache: Record<string, (number | null)[]>,
  position: OpenPosition | null,
): number | null {
  if (operand.kind === 'number') {
    return operand.value;
  }

  const spec = operand.indicator;

  // Position-scope indicators
  if (spec.type === 'pnl_pct') {
    if (!position) return null;
    return ((candles[i].c - position.entryPrice) / position.entryPrice) * 100;
  }
  if (spec.type === 'bars_in_trade') {
    if (!position) return null;
    return i - position.entryIndex;
  }

  // Price directly from candle
  if (spec.type === 'price_close') return candles[i].c;
  if (spec.type === 'price_open') return candles[i].o;
  if (spec.type === 'price_high') return candles[i].h;
  if (spec.type === 'price_low') return candles[i].l;
  if (spec.type === 'volume') return candles[i].v;

  // Look up from pre-computed indicator cache
  const key = indicatorKey(spec);
  const values = indicatorCache[key];
  if (!values) return null;
  return values[i] ?? null;
}

/** Evaluate a single condition at candle index i */
export function evaluateCondition(
  condition: Condition,
  i: number,
  candles: Candle[],
  indicatorCache: Record<string, (number | null)[]>,
  position: OpenPosition | null,
): boolean {
  // For position-scope conditions, only evaluate when position is open
  if (condition.scope === 'position' && !position) {
    return false;
  }

  const leftVal = resolveOperand(condition.left, i, candles, indicatorCache, position);
  const rightVal = resolveOperand(condition.right, i, candles, indicatorCache, position);

  // If either operand is null (warmup period), condition is false
  if (leftVal === null || rightVal === null) return false;

  switch (condition.op) {
    case 'lt': return leftVal < rightVal;
    case 'lte': return leftVal <= rightVal;
    case 'gt': return leftVal > rightVal;
    case 'gte': return leftVal >= rightVal;
    case 'eq': return leftVal === rightVal;
    case 'crosses_above': {
      // Need i >= 1 to compare with previous candle
      if (i < 1) return false;
      const prevLeft = resolveOperand(condition.left, i - 1, candles, indicatorCache, position);
      const prevRight = resolveOperand(condition.right, i - 1, candles, indicatorCache, position);
      if (prevLeft === null || prevRight === null) return false;
      return prevLeft <= prevRight && leftVal > rightVal;
    }
    case 'crosses_below': {
      if (i < 1) return false;
      const prevLeft = resolveOperand(condition.left, i - 1, candles, indicatorCache, position);
      const prevRight = resolveOperand(condition.right, i - 1, candles, indicatorCache, position);
      if (prevLeft === null || prevRight === null) return false;
      return prevLeft >= prevRight && leftVal < rightVal;
    }
  }
}

/** Evaluate a condition group (AND/OR over conditions) at candle index i */
export function evaluateGroup(
  group: ConditionGroup,
  i: number,
  candles: Candle[],
  indicatorCache: Record<string, (number | null)[]>,
  position: OpenPosition | null,
): boolean {
  // Empty semantics: AND over empty = true, OR over empty = false
  if (group.conditions.length === 0) {
    return group.op === 'AND';
  }

  if (group.op === 'AND') {
    return group.conditions.every(c => evaluateCondition(c, i, candles, indicatorCache, position));
  } else {
    return group.conditions.some(c => evaluateCondition(c, i, candles, indicatorCache, position));
  }
}
