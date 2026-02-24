import type {
  BacktestConfig,
  BacktestResult,
  Candle,
  Trade,
  EquityPoint,
  PerformanceMetrics,
} from '@/types/results';
import type {
  StrategyRuleSet,
  ConditionGroup,
  Condition,
  IndicatorSpec,
  Operand,
} from '@/types/strategy';
import type { IndicatorCache, OpenPosition } from './types';
import { evaluateGroup, indicatorKey } from './evaluator';
import { computeBenchmark } from './benchmark';
import { computeMetrics, buildAuditInfo } from '@/metrics/compute';
import {
  computeSMA,
  computeEMA,
  computeRSI,
  computeMACD,
  computeBollinger,
  computeATR,
  computePctChange,
} from '@/indicators/index';

// ---------------------------------------------------------------------------
// Indicator collection
// ---------------------------------------------------------------------------

/** Position-scope indicator types that are computed at runtime, not pre-cached */
const POSITION_SCOPE_TYPES = new Set(['pnl_pct', 'bars_in_trade']);

/** Price/volume types read directly from candle data, not pre-cached */
const CANDLE_DIRECT_TYPES = new Set([
  'price_close',
  'price_open',
  'price_high',
  'price_low',
  'volume',
]);

/** Extract all unique IndicatorSpecs from entry + exit conditions */
function collectIndicators(rules: StrategyRuleSet): IndicatorSpec[] {
  const seen = new Set<string>();
  const specs: IndicatorSpec[] = [];

  function addSpec(spec: IndicatorSpec): void {
    if (POSITION_SCOPE_TYPES.has(spec.type)) return;
    if (CANDLE_DIRECT_TYPES.has(spec.type)) return;
    const key = indicatorKey(spec);
    if (seen.has(key)) return;
    seen.add(key);
    specs.push(spec);
  }

  function walkOperand(operand: Operand): void {
    if (operand.kind === 'indicator') {
      addSpec(operand.indicator);
    }
  }

  function walkConditions(conditions: Condition[]): void {
    for (const cond of conditions) {
      walkOperand(cond.left);
      walkOperand(cond.right);
    }
  }

  walkConditions(rules.entry.conditions);
  walkConditions(rules.exit.conditions);

  return specs;
}

// ---------------------------------------------------------------------------
// Warmup calculation
// ---------------------------------------------------------------------------

/** Determine the warmup period based on indicator specs */
function computeWarmup(specs: IndicatorSpec[]): number {
  let maxWarmup = 0;

  for (const spec of specs) {
    let warmup = 0;

    switch (spec.type) {
      case 'sma':
      case 'ema':
        // First valid value at index period-1, so need period-1 warmup candles
        warmup = (spec.period ?? 14) - 1;
        break;

      case 'rsi':
        // RSI needs period+1 data points, first value at index period
        warmup = spec.period ?? 14;
        break;

      case 'macd_line':
      case 'macd_signal':
      case 'macd_hist': {
        const slow = spec.slowPeriod ?? 26;
        const signal = spec.signalPeriod ?? 9;
        // MACD line available at slowPeriod-1, signal needs signalPeriod-1 more
        warmup = (slow - 1) + (signal - 1);
        break;
      }

      case 'bb_upper':
      case 'bb_middle':
      case 'bb_lower':
        warmup = (spec.period ?? 20) - 1;
        break;

      case 'atr':
        // ATR first value at index period (needs period+1 data for TR)
        warmup = spec.period ?? 14;
        break;

      case 'pct_change':
        // First value at index period
        warmup = spec.period ?? 1;
        break;

      default:
        warmup = 0;
    }

    if (warmup > maxWarmup) {
      maxWarmup = warmup;
    }
  }

  return Math.max(maxWarmup, 0);
}

// ---------------------------------------------------------------------------
// Indicator pre-computation
// ---------------------------------------------------------------------------

/** Get the source data array from candles based on source field */
function getSourceData(candles: Candle[], source?: string): number[] {
  switch (source) {
    case 'open':
      return candles.map((c) => c.o);
    case 'high':
      return candles.map((c) => c.h);
    case 'low':
      return candles.map((c) => c.l);
    case 'close':
    default:
      return candles.map((c) => c.c);
  }
}

/** Pre-compute all required indicators and return cache */
function precomputeIndicators(
  candles: Candle[],
  specs: IndicatorSpec[],
): IndicatorCache {
  const cache: IndicatorCache = {};

  for (const spec of specs) {
    const src = getSourceData(candles, spec.source);

    switch (spec.type) {
      case 'sma': {
        const period = spec.period ?? 14;
        cache[indicatorKey(spec)] = computeSMA(src, period);
        break;
      }

      case 'ema': {
        const period = spec.period ?? 14;
        cache[indicatorKey(spec)] = computeEMA(src, period);
        break;
      }

      case 'rsi': {
        const period = spec.period ?? 14;
        cache[indicatorKey(spec)] = computeRSI(src, period);
        break;
      }

      case 'macd_line':
      case 'macd_signal':
      case 'macd_hist': {
        const fast = spec.fastPeriod ?? 12;
        const slow = spec.slowPeriod ?? 26;
        const signal = spec.signalPeriod ?? 9;
        // Compute the full MACD result, store all 3 series
        const macd = computeMACD(src, fast, slow, signal);
        // Build keys for all three components
        const lineKey = `macd_line_${fast}_${slow}_${signal}`;
        const signalKey = `macd_signal_${fast}_${slow}_${signal}`;
        const histKey = `macd_hist_${fast}_${slow}_${signal}`;
        // Only store if not already stored (another MACD component may have done it)
        if (!(lineKey in cache)) cache[lineKey] = macd.line;
        if (!(signalKey in cache)) cache[signalKey] = macd.signal;
        if (!(histKey in cache)) cache[histKey] = macd.histogram;
        break;
      }

      case 'bb_upper':
      case 'bb_middle':
      case 'bb_lower': {
        const period = spec.period ?? 20;
        const stdDev = spec.stdDev ?? 2;
        const bb = computeBollinger(src, period, stdDev);
        const upperKey = `bb_upper_${period}_${stdDev}`;
        const middleKey = `bb_middle_${period}_${stdDev}`;
        const lowerKey = `bb_lower_${period}_${stdDev}`;
        if (!(upperKey in cache)) cache[upperKey] = bb.upper;
        if (!(middleKey in cache)) cache[middleKey] = bb.middle;
        if (!(lowerKey in cache)) cache[lowerKey] = bb.lower;
        break;
      }

      case 'atr': {
        const period = spec.period ?? 14;
        const highs = candles.map((c) => c.h);
        const lows = candles.map((c) => c.l);
        const closes = candles.map((c) => c.c);
        cache[indicatorKey(spec)] = computeATR(highs, lows, closes, period);
        break;
      }

      case 'pct_change': {
        const period = spec.period ?? 1;
        cache[indicatorKey(spec)] = computePctChange(src, period);
        break;
      }
    }
  }

  return cache;
}

// ---------------------------------------------------------------------------
// Empty result helper
// ---------------------------------------------------------------------------

function emptyMetrics(): PerformanceMetrics {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    maxDrawdown: 0,
    maxDrawdownDurationDays: 0,
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    avgWinPct: 0,
    avgLossPct: 0,
    bestTradePct: 0,
    worstTradePct: 0,
    avgHoldingDays: 0,
    exposureTimePct: 0,
  };
}

function emptyResult(config: BacktestConfig): BacktestResult {
  return {
    config,
    trades: [],
    equityCurve: [],
    metrics: emptyMetrics(),
    benchmark: { totalReturn: 0, equityCurve: [], description: 'No data' },
    indicatorData: {},
    audit: buildAuditInfo({
      feeBps: config.feeBps,
      slippageBps: config.slippageBps,
      warmupCandles: 0,
      startDate: config.startDate,
      endDate: config.endDate,
      totalCandles: 0,
      tradableCandles: 0,
    }),
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Calendar days between two YYYY-MM-DD strings (absolute value) */
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round(Math.abs(db.getTime() - da.getTime()) / msPerDay);
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/** Main dispatcher */
export function runBacktest(
  config: BacktestConfig,
  allCandles: Candle[],
): BacktestResult {
  // 1. Filter candles to [startDate, endDate] range (inclusive)
  const candles = allCandles.filter(
    (c) => c.t >= config.startDate && c.t <= config.endDate,
  );

  if (candles.length === 0) {
    return emptyResult(config);
  }

  // 2. Dispatch based on strategy mode
  if (config.rules.mode.type === 'dca') {
    return runDCABacktest(config, candles);
  }

  return runStandardBacktest(config, candles);
}

// ---------------------------------------------------------------------------
// Standard-mode backtest
// ---------------------------------------------------------------------------

function runStandardBacktest(
  config: BacktestConfig,
  candles: Candle[],
): BacktestResult {
  const { rules, initialCapital, feeBps, slippageBps } = config;
  const slippageFrac = slippageBps / 10_000;
  const feeFrac = feeBps / 10_000;

  // 1. Collect indicators, compute warmup, precompute indicator cache
  const specs = collectIndicators(rules);
  const warmup = computeWarmup(specs);
  const cache = precomputeIndicators(candles, specs);

  // 2. If warmup >= candles.length, return empty result with warning
  if (warmup >= candles.length) {
    return {
      config,
      trades: [],
      equityCurve: [],
      metrics: emptyMetrics(),
      benchmark: { totalReturn: 0, equityCurve: [], description: 'Warmup exceeds data range' },
      indicatorData: cache,
      audit: buildAuditInfo({
        feeBps,
        slippageBps,
        warmupCandles: warmup,
        startDate: candles[0].t,
        endDate: candles[candles.length - 1].t,
        totalCandles: candles.length,
        tradableCandles: 0,
      }),
    };
  }

  // 3. Compute benchmark (from warmup candle onward)
  const tradableCandles = candles.slice(warmup);
  const benchmark = computeBenchmark(
    tradableCandles,
    initialCapital,
    feeBps,
    slippageBps,
  );

  // Build lookups from date to benchmark equity and drawdown for the equity curve
  const benchmarkByDate = new Map<string, number>();
  const benchmarkDrawdownByDate = new Map<string, number>();
  for (const pt of benchmark.equityCurve) {
    benchmarkByDate.set(pt.date, pt.benchmarkEquity);
    benchmarkDrawdownByDate.set(pt.date, pt.benchmarkDrawdownPct);
  }

  // 4. Signal loop
  let capital = initialCapital;
  let position: OpenPosition | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let peak = initialCapital;
  let tradeId = 1;

  // Track the total cost basis of current position (including entry fee)
  let positionCostBasis = 0;

  for (let i = warmup; i < candles.length; i++) {
    // --- Entry / Exit signal processing ---
    if (position === null) {
      // Check entry condition at candle i
      const entryFires = evaluateGroup(
        rules.entry,
        i,
        candles,
        cache,
        null,
      );

      if (entryFires && i + 1 < candles.length) {
        // Calculate position size
        let positionSize: number;
        if (rules.sizing.type === 'percent_equity') {
          positionSize = capital * (rules.sizing.valuePct / 100);
        } else {
          // fixed_amount
          positionSize = Math.min(rules.sizing.valueUsd, capital);
        }

        // Fill at open[i+1] with adverse slippage (price goes up for a buy)
        const fillPrice = candles[i + 1].o * (1 + slippageFrac);

        // Fee on the notional
        const fee = positionSize * feeFrac;

        // Net investable amount after fee
        const netInvestable = positionSize - fee;

        // Units purchased
        const units = netInvestable / fillPrice;

        // Total cost basis (what we subtract from capital)
        positionCostBasis = positionSize;

        position = {
          entryPrice: fillPrice,
          entryIndex: i + 1,
          entryDate: candles[i + 1].t,
          units,
          positionSize,
        };

        capital -= positionSize;
      }
    } else {
      // Check exit condition at candle i
      const evalPosition = {
        entryPrice: position.entryPrice,
        entryIndex: position.entryIndex,
      };

      const exitFires = evaluateGroup(
        rules.exit,
        i,
        candles,
        cache,
        evalPosition,
      );

      if (exitFires && i + 1 < candles.length) {
        // Fill at open[i+1] with adverse slippage (price goes down for a sell)
        const fillPrice = candles[i + 1].o * (1 - slippageFrac);

        // Gross proceeds
        const grossProceeds = fillPrice * position.units;

        // Exit fee
        const exitFee = grossProceeds * feeFrac;

        // Net proceeds
        const netProceeds = grossProceeds - exitFee;

        // PnL
        const pnlAbs = netProceeds - positionCostBasis;
        const pnlPct = (pnlAbs / positionCostBasis) * 100;

        const holdingDays = daysBetween(position.entryDate, candles[i + 1].t);

        trades.push({
          id: tradeId++,
          entryDate: position.entryDate,
          entryPrice: position.entryPrice,
          exitDate: candles[i + 1].t,
          exitPrice: fillPrice,
          pnlAbs,
          pnlPct,
          holdingDays,
          exitReason: 'Exit signal',
          positionSize: position.positionSize,
        });

        capital += netProceeds;
        position = null;
        positionCostBasis = 0;
      }
    }

    // --- Mark-to-market equity ---
    let equity: number;
    if (position !== null) {
      equity = capital + position.units * candles[i].c;
    } else {
      equity = capital;
    }

    if (equity > peak) {
      peak = equity;
    }

    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    const benchmarkEquity = benchmarkByDate.get(candles[i].t) ?? initialCapital;
    const benchmarkDrawdownPct = benchmarkDrawdownByDate.get(candles[i].t) ?? 0;

    equityCurve.push({
      date: candles[i].t,
      equity,
      benchmarkEquity,
      drawdownPct,
      benchmarkDrawdownPct,
    });
  }

  // 5. Force-close at last candle close if still in position
  if (position !== null) {
    const lastCandle = candles[candles.length - 1];
    const fillPrice = lastCandle.c * (1 - slippageFrac);
    const grossProceeds = fillPrice * position.units;
    const exitFee = grossProceeds * feeFrac;
    const netProceeds = grossProceeds - exitFee;

    const pnlAbs = netProceeds - positionCostBasis;
    const pnlPct = (pnlAbs / positionCostBasis) * 100;

    const holdingDays = daysBetween(position.entryDate, lastCandle.t);

    trades.push({
      id: tradeId++,
      entryDate: position.entryDate,
      entryPrice: position.entryPrice,
      exitDate: lastCandle.t,
      exitPrice: fillPrice,
      pnlAbs,
      pnlPct,
      holdingDays,
      exitReason: 'Force-close at end of data',
      positionSize: position.positionSize,
    });

    capital += netProceeds;
    position = null;

    // Update the last equity point to reflect the force-close
    if (equityCurve.length > 0) {
      const lastEq = equityCurve[equityCurve.length - 1];
      lastEq.equity = capital;
      if (capital > peak) {
        peak = capital;
      }
      lastEq.drawdownPct = peak > 0 ? ((capital - peak) / peak) * 100 : 0;
    }
  }

  // 6. Compute metrics
  const tradableCount = candles.length - warmup;
  const metrics = computeMetrics(trades, equityCurve, initialCapital, tradableCount);

  // 7. Build audit info
  const audit = buildAuditInfo({
    feeBps,
    slippageBps,
    warmupCandles: warmup,
    startDate: candles[0].t,
    endDate: candles[candles.length - 1].t,
    totalCandles: candles.length,
    tradableCandles: tradableCount,
  });

  // 8. Return result
  return {
    config,
    trades,
    equityCurve,
    metrics,
    benchmark,
    indicatorData: cache,
    audit,
  };
}

// ---------------------------------------------------------------------------
// DCA-mode backtest
// ---------------------------------------------------------------------------

function runDCABacktest(
  config: BacktestConfig,
  candles: Candle[],
): BacktestResult {
  const { rules, initialCapital, feeBps, slippageBps } = config;
  const mode = rules.mode;

  if (mode.type !== 'dca') {
    throw new Error('runDCABacktest called with non-DCA mode');
  }

  const slippageFrac = slippageBps / 10_000;
  const feeFrac = feeBps / 10_000;
  const { intervalDays, amountUsd } = mode;

  // 1. No warmup
  const warmup = 0;

  // 2. Compute benchmark from candle 0
  const benchmark = computeBenchmark(candles, initialCapital, feeBps, slippageBps);
  const benchmarkByDate = new Map<string, number>();
  const benchmarkDrawdownByDate = new Map<string, number>();
  for (const pt of benchmark.equityCurve) {
    benchmarkByDate.set(pt.date, pt.benchmarkEquity);
    benchmarkDrawdownByDate.set(pt.date, pt.benchmarkDrawdownPct);
  }

  // 3. DCA loop
  let remainingCash = initialCapital;
  let totalUnits = 0;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let peak = initialCapital;
  let tradeId = 1;

  // Track individual DCA buy entries for trade records
  interface DCAEntry {
    date: string;
    fillPrice: number;
    units: number;
    invested: number; // amount invested (before fee, but the total outflow)
  }
  const dcaEntries: DCAEntry[] = [];

  for (let i = 0; i < candles.length; i++) {
    // Check if this is a buy day (every intervalDays candles)
    if (i % intervalDays === 0) {
      // Fill at close[i] with adverse slippage
      const fillPrice = candles[i].c * (1 + slippageFrac);
      const fee = amountUsd * feeFrac;
      const totalCost = amountUsd + fee;

      if (remainingCash >= totalCost) {
        // Full buy
        const units = amountUsd / fillPrice;
        totalUnits += units;
        remainingCash -= totalCost;

        dcaEntries.push({
          date: candles[i].t,
          fillPrice,
          units,
          invested: totalCost,
        });
      } else if (remainingCash > fee) {
        // Partial buy: invest whatever cash we have minus the fee
        const investable = remainingCash - fee;
        const units = investable / fillPrice;
        totalUnits += units;

        dcaEntries.push({
          date: candles[i].t,
          fillPrice,
          units,
          invested: remainingCash,
        });

        remainingCash = 0;
      }
      // else: skip, no cash
    }

    // Equity = totalUnits * close[i] + remainingCash
    const equity = totalUnits * candles[i].c + remainingCash;

    if (equity > peak) {
      peak = equity;
    }

    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    const benchmarkEquity = benchmarkByDate.get(candles[i].t) ?? initialCapital;
    const benchmarkDrawdownPct = benchmarkDrawdownByDate.get(candles[i].t) ?? 0;

    equityCurve.push({
      date: candles[i].t,
      equity,
      benchmarkEquity,
      drawdownPct,
      benchmarkDrawdownPct,
    });
  }

  // 4. Build trade records for each DCA entry
  //    Each DCA buy is recorded as a trade with exit at the last candle
  const lastCandle = candles[candles.length - 1];
  for (const entry of dcaEntries) {
    const exitPrice = lastCandle.c;
    const pnlAbs = entry.units * exitPrice - entry.invested;
    const pnlPct = entry.invested > 0 ? (pnlAbs / entry.invested) * 100 : 0;
    const holdingDays = daysBetween(entry.date, lastCandle.t);

    trades.push({
      id: tradeId++,
      entryDate: entry.date,
      entryPrice: entry.fillPrice,
      exitDate: lastCandle.t,
      exitPrice,
      pnlAbs,
      pnlPct,
      holdingDays,
      exitReason: 'DCA hold',
      positionSize: entry.invested,
    });
  }

  // 5. Compute metrics
  const metrics = computeMetrics(trades, equityCurve, initialCapital, candles.length);

  // 6. Build audit info
  const audit = buildAuditInfo({
    feeBps,
    slippageBps,
    warmupCandles: 0,
    startDate: candles[0].t,
    endDate: candles[candles.length - 1].t,
    totalCandles: candles.length,
    tradableCandles: candles.length,
  });
  // Override position model for DCA
  audit.positionModel = 'DCA additive';

  return {
    config,
    trades,
    equityCurve,
    metrics,
    benchmark,
    indicatorData: {},
    audit,
  };
}
