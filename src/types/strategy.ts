import { z } from 'zod';

export const AssetSymbolSchema = z.enum([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
]);
export type AssetSymbol = z.infer<typeof AssetSymbolSchema>;

export const TimeframeSchema = z.literal('1D');
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const ComparisonOpSchema = z.enum([
  'lt', 'lte', 'gt', 'gte', 'eq', 'crosses_above', 'crosses_below',
]);
export type ComparisonOp = z.infer<typeof ComparisonOpSchema>;

export const LogicOpSchema = z.enum(['AND', 'OR']);
export type LogicOp = z.infer<typeof LogicOpSchema>;

export const ScopeSchema = z.enum(['candle', 'position']);
export type Scope = z.infer<typeof ScopeSchema>;

export const IndicatorTypeSchema = z.enum([
  'price_close', 'price_open', 'price_high', 'price_low',
  'sma', 'ema', 'rsi',
  'macd_line', 'macd_signal', 'macd_hist',
  'bb_upper', 'bb_middle', 'bb_lower',
  'atr', 'pct_change', 'volume',
  'pnl_pct', 'bars_in_trade',
]);
export type IndicatorType = z.infer<typeof IndicatorTypeSchema>;

export const IndicatorSpecSchema = z.object({
  type: IndicatorTypeSchema,
  period: z.number().int().positive().optional(),
  fastPeriod: z.number().int().positive().optional(),
  slowPeriod: z.number().int().positive().optional(),
  signalPeriod: z.number().int().positive().optional(),
  stdDev: z.number().positive().optional(),
  source: z.enum(['close', 'open', 'high', 'low']).optional(),
});
export type IndicatorSpec = z.infer<typeof IndicatorSpecSchema>;

export const OperandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('indicator'), indicator: IndicatorSpecSchema }),
  z.object({ kind: z.literal('number'), value: z.number() }),
]);
export type Operand = z.infer<typeof OperandSchema>;

export const ConditionSchema = z.object({
  id: z.string(),
  label: z.string(),
  scope: ScopeSchema.default('candle'),
  left: OperandSchema,
  op: ComparisonOpSchema,
  right: OperandSchema,
});
export type Condition = z.infer<typeof ConditionSchema>;

export const ConditionGroupSchema = z.object({
  op: LogicOpSchema,
  conditions: z.array(ConditionSchema),
});
export type ConditionGroup = z.infer<typeof ConditionGroupSchema>;

export const PositionSizingSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('percent_equity'), valuePct: z.number().min(1).max(100) }),
  z.object({ type: z.literal('fixed_amount'), valueUsd: z.number().positive() }),
]);
export type PositionSizing = z.infer<typeof PositionSizingSchema>;

export const StrategyModeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('standard') }),
  z.object({
    type: z.literal('dca'),
    intervalDays: z.number().int().positive(),
    amountUsd: z.number().positive(),
  }),
]);
export type StrategyMode = z.infer<typeof StrategyModeSchema>;

export const StrategyMetadataSchema = z.object({
  originalPrompt: z.string().optional(),
  parserConfidence: z.enum(['low', 'medium', 'high']).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()),
});
export type StrategyMetadata = z.infer<typeof StrategyMetadataSchema>;

export const StrategyRuleSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mode: StrategyModeSchema,
  entry: ConditionGroupSchema,
  exit: ConditionGroupSchema,
  sizing: PositionSizingSchema.default({ type: 'percent_equity', valuePct: 100 }),
  metadata: StrategyMetadataSchema.optional(),
});
export type StrategyRuleSet = z.infer<typeof StrategyRuleSetSchema>;

/** Position-scope indicator types */
const POSITION_SCOPE_TYPES: ReadonlySet<IndicatorType> = new Set([
  'pnl_pct', 'bars_in_trade',
]);

/** Cross operators that require indicator operands on both sides */
const CROSS_OPS: ReadonlySet<ComparisonOp> = new Set([
  'crosses_above', 'crosses_below',
]);

export interface InvariantResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRuleSetInvariants(rules: StrategyRuleSet): InvariantResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rules.mode.type === 'standard') {
    if (rules.entry.conditions.length === 0) {
      errors.push('Standard mode must have at least 1 entry condition.');
    }
    if (rules.exit.conditions.length === 0) {
      warnings.push('No exit conditions — positions will be held until the end of the data range.');
    }
  }

  if (rules.mode.type === 'dca') {
    if (rules.entry.conditions.length > 0) {
      errors.push('DCA mode must have empty entry conditions.');
    }
    if (rules.exit.conditions.length > 0) {
      errors.push('DCA mode must have empty exit conditions.');
    }
  }

  const allConditions = [...rules.entry.conditions, ...rules.exit.conditions];

  for (const cond of allConditions) {
    // Cross operators require indicator operands on both sides
    if (CROSS_OPS.has(cond.op)) {
      if (cond.left.kind !== 'indicator' || cond.right.kind !== 'indicator') {
        errors.push(
          `Condition "${cond.id}": ${cond.op} requires indicator operands on both sides.`
        );
      }
    }

    // Position-scope only valid with pnl_pct or bars_in_trade
    if (cond.scope === 'position') {
      const leftIsPositionScope =
        cond.left.kind === 'indicator' && POSITION_SCOPE_TYPES.has(cond.left.indicator.type);
      const rightIsPositionScope =
        cond.right.kind === 'indicator' && POSITION_SCOPE_TYPES.has(cond.right.indicator.type);

      if (!leftIsPositionScope && !rightIsPositionScope) {
        errors.push(
          `Condition "${cond.id}": scope "position" is only valid with pnl_pct or bars_in_trade indicator types.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
