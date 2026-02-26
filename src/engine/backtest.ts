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

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round(Math.abs(db.getTime() - da.getTime()) / msPerDay);
}

export function runBacktest(
  config: BacktestConfig,
  allCandles: Candle[],
): BacktestResult {
  const candles = allCandles.filter(
    (c) => c.t >= config.startDate && c.t <= config.endDate,
  );

  if (candles.length === 0) {
    return emptyResult(config);
  }

  if (config.rules.mode.type === 'dca') {
    return runDCABacktest(config, candles);
  }

  return runStandardBacktest(config, candles);
}

function runStandardBacktest(
  config: BacktestConfig,
  candles: Candle[],
): BacktestResult {
  const { rules, initialCapital, feeBps, slippageBps } = config;
  const slippageFrac = slippageBps / 10_000;
  const feeFrac = feeBps / 10_000;

  const specs = collectIndicators(rules);
  const warmup = computeWarmup(specs);
  const cache = precomputeIndicators(candles, specs);

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

  const tradableCandles = candles.slice(warmup);
  const benchmark = computeBenchmark(
    tradableCandles,
    initialCapital,
    feeBps,
    slippageBps,
  );

  const benchmarkByDate = new Map<string, number>();
  const benchmarkDrawdownByDate = new Map<string, number>();
  for (const pt of benchmark.equityCurve) {
    benchmarkByDate.set(pt.date, pt.benchmarkEquity);
    benchmarkDrawdownByDate.set(pt.date, pt.benchmarkDrawdownPct);
  }

  let capital = initialCapital;
  let position: OpenPosition | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let peak = initialCapital;
  let tradeId = 1;

  let positionCostBasis = 0;

  for (let i = warmup; i < candles.length; i++) {
    if (position === null) {
      const entryFires = evaluateGroup(
        rules.entry,
        i,
        candles,
        cache,
        null,
      );

      if (entryFires && i + 1 < candles.length) {
        let positionSize: number;
        if (rules.sizing.type === 'percent_equity') {
          positionSize = capital * (rules.sizing.valuePct / 100);
        } else {
          // fixed_amount
          positionSize = Math.min(rules.sizing.valueUsd, capital);
        }

        // Fill at open[i+1] with adverse slippage (price goes up for a buy)
        const fillPrice = candles[i + 1].o * (1 + slippageFrac);

        const fee = positionSize * feeFrac;
        const netInvestable = positionSize - fee;
        const units = netInvestable / fillPrice;
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

        const grossProceeds = fillPrice * position.units;
        const exitFee = grossProceeds * feeFrac;
        const netProceeds = grossProceeds - exitFee;
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

    if (equityCurve.length > 0) {
      const lastEq = equityCurve[equityCurve.length - 1];
      lastEq.equity = capital;
      if (capital > peak) {
        peak = capital;
      }
      lastEq.drawdownPct = peak > 0 ? ((capital - peak) / peak) * 100 : 0;
    }
  }

  const tradableCount = candles.length - warmup;
  const metrics = computeMetrics(trades, equityCurve, initialCapital, tradableCount);

  const audit = buildAuditInfo({
    feeBps,
    slippageBps,
    warmupCandles: warmup,
    startDate: candles[0].t,
    endDate: candles[candles.length - 1].t,
    totalCandles: candles.length,
    tradableCandles: tradableCount,
  });

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

  const benchmark = computeBenchmark(candles, initialCapital, feeBps, slippageBps);
  const benchmarkByDate = new Map<string, number>();
  const benchmarkDrawdownByDate = new Map<string, number>();
  for (const pt of benchmark.equityCurve) {
    benchmarkByDate.set(pt.date, pt.benchmarkEquity);
    benchmarkDrawdownByDate.set(pt.date, pt.benchmarkDrawdownPct);
  }

  let remainingCash = initialCapital;
  let totalUnits = 0;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let peak = initialCapital;
  let tradeId = 1;

  interface DCAEntry {
    date: string;
    fillPrice: number;
    units: number;
    invested: number; // amount invested (before fee, but the total outflow)
  }
  const dcaEntries: DCAEntry[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i % intervalDays === 0) {
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

  // Each DCA buy is recorded as a trade with exit at the last candle
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

  const metrics = computeMetrics(trades, equityCurve, initialCapital, candles.length);
  const audit = buildAuditInfo({
    feeBps,
    slippageBps,
    warmupCandles: 0,
    startDate: candles[0].t,
    endDate: candles[candles.length - 1].t,
    totalCandles: candles.length,
    tradableCandles: candles.length,
  });
  audit.positionModel = 'DCA additive';

  // Flag when DCA budget was fully exhausted
  if (remainingCash <= amountUsd * feeFrac && dcaEntries.length > 0) {
    audit.dcaBudgetExhaustedDate = dcaEntries[dcaEntries.length - 1].date;
  }

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
