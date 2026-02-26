import { z } from 'zod';
import { AssetSymbolSchema, StrategyRuleSetSchema } from './strategy';
import type { AssetSymbol, StrategyRuleSet } from './strategy';

/** OHLCV candle data */
export interface Candle {
  t: string;  // date "YYYY-MM-DD"
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

/** Backtest configuration */
export const BacktestConfigSchema = z.object({
  asset: AssetSymbolSchema,
  timeframe: z.literal('1D'),
  startDate: z.string(),
  endDate: z.string(),
  initialCapital: z.number().positive().default(10000),
  feeBps: z.number().nonnegative().default(10),
  slippageBps: z.number().nonnegative().default(5),
  rules: StrategyRuleSetSchema,
});
export type BacktestConfig = z.infer<typeof BacktestConfigSchema>;

/** A completed trade */
export interface Trade {
  id: number;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  pnlAbs: number;
  pnlPct: number;
  holdingDays: number;
  exitReason: string;
  positionSize: number;
}

/** Equity value at a point in time */
export interface EquityPoint {
  date: string;
  equity: number;
  benchmarkEquity: number;
  drawdownPct: number;
  benchmarkDrawdownPct: number;
}

/** All 14 performance metrics */
export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDurationDays: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWinPct: number;
  avgLossPct: number;
  bestTradePct: number;
  worstTradePct: number;
  avgHoldingDays: number;
  exposureTimePct: number;
}

/** Benchmark (buy-and-hold) result */
export interface BenchmarkResult {
  totalReturn: number;
  equityCurve: EquityPoint[];
  description: string;
}

/** Audit information for transparency */
export interface AuditInfo {
  executionModel: string;
  feeBps: number;
  slippageBps: number;
  warmupCandles: number;
  dataRange: string;
  totalCandles: number;
  tradableCandles: number;
  annualizationFactor: number;
  riskFreeRate: number;
  benchmarkModel: string;
  positionModel: string;
}

/** Complete backtest result */
export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  benchmark: BenchmarkResult;
  indicatorData: Record<string, (number | null)[]>;
  audit: AuditInfo;
}

/** Application phase */
export type AppPhase = 'input' | 'parsing' | 'running' | 'results' | 'comparing';

/** Snapshot of a run for history */
export interface RunSnapshot {
  id: string;
  timestamp: number;
  prompt: string;
  asset: string;
  metricsPreview: {
    totalReturn: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
  };
  fullResult: BacktestResult;
}

/** Demo mode snapshot config */
export interface DemoSnapshot {
  id: string;
  presetId: string;
  displayName: string;
  config: {
    asset: AssetSymbol;
    startDate: string;
    endDate: string;
    initialCapital: number;
    feeBps: number;
    slippageBps: number;
  };
}

/** Full application state */
export interface AppState {
  phase: AppPhase;
  config: {
    asset: AssetSymbol;
    startDate: string;
    endDate: string;
    initialCapital: number;
    feeBps: number;
    slippageBps: number;
  };
  currentPrompt: string;
  currentRules: StrategyRuleSet | null;
  results: [BacktestResult | null, BacktestResult | null];
  runHistory: RunSnapshot[];
  error: string | null;
}
