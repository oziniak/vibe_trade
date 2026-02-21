import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/engine/backtest';
import type { BacktestConfig, Candle } from '@/types/results';
import type { StrategyRuleSet } from '@/types/strategy';

// ---------------------------------------------------------------------------
// Helper: build candle data
// ---------------------------------------------------------------------------

/** Generate a sequence of daily candles starting from a given date */
function makeCandles(
  startDate: string,
  closePrices: number[],
  opts?: {
    openOffset?: number;   // open = close + openOffset (default: -2)
    highOffset?: number;   // high = max(open, close) + highOffset (default: 5)
    lowOffset?: number;    // low = min(open, close) - lowOffset (default: 5)
    volume?: number;
  },
): Candle[] {
  const openOff = opts?.openOffset ?? -2;
  const highOff = opts?.highOffset ?? 5;
  const lowOff = opts?.lowOffset ?? 5;
  const vol = opts?.volume ?? 1000;

  return closePrices.map((c, i) => {
    const date = new Date(startDate + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const o = c + openOff;
    return {
      t: dateStr,
      o,
      h: Math.max(o, c) + highOff,
      l: Math.min(o, c) - lowOff,
      c,
      v: vol,
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: build a simple RSI strategy
// ---------------------------------------------------------------------------

function makeRSIStrategy(
  entryThreshold: number,
  exitThreshold: number,
  rsiPeriod: number = 14,
): StrategyRuleSet {
  return {
    id: 'test-rsi',
    name: 'RSI Strategy',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'entry-rsi-lt',
          label: `RSI(${rsiPeriod}) < ${entryThreshold}`,
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'rsi', period: rsiPeriod },
          },
          op: 'lt',
          right: { kind: 'number', value: entryThreshold },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'exit-rsi-gt',
          label: `RSI(${rsiPeriod}) > ${exitThreshold}`,
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'rsi', period: rsiPeriod },
          },
          op: 'gt',
          right: { kind: 'number', value: exitThreshold },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
    metadata: { warnings: [] },
  };
}

/** Build a simple price-based strategy that enters when close < threshold, exits when close > threshold */
function makePriceStrategy(
  entryBelow: number,
  exitAbove: number,
): StrategyRuleSet {
  return {
    id: 'test-price',
    name: 'Price Strategy',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'entry-price',
          label: `close < ${entryBelow}`,
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'price_close' },
          },
          op: 'lt',
          right: { kind: 'number', value: entryBelow },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'exit-price',
          label: `close > ${exitAbove}`,
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'price_close' },
          },
          op: 'gt',
          right: { kind: 'number', value: exitAbove },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
    metadata: { warnings: [] },
  };
}

function makeConfig(
  rules: StrategyRuleSet,
  candles: Candle[],
  overrides?: Partial<BacktestConfig>,
): BacktestConfig {
  return {
    asset: 'BTC',
    timeframe: '1D',
    startDate: candles[0].t,
    endDate: candles[candles.length - 1].t,
    initialCapital: 10000,
    feeBps: 10,
    slippageBps: 5,
    rules,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runBacktest – standard mode', () => {
  it('returns empty result for no candles in date range', () => {
    const candles = makeCandles('2024-01-01', [100, 102, 104]);
    const rules = makePriceStrategy(99, 105);
    const config = makeConfig(rules, candles, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
    expect(result.metrics.totalTrades).toBe(0);
  });

  it('returns empty result when warmup exceeds candle range', () => {
    // RSI(14) needs 14 warmup candles, but we only have 10
    const candles = makeCandles('2024-01-01', Array(10).fill(100));
    const rules = makeRSIStrategy(30, 70, 14);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
    expect(result.audit.warmupCandles).toBe(14);
  });

  it('executes a simple price-based strategy with correct entry/exit', () => {
    // 10 candles: price drops below 95, then rises above 110
    const closePrices = [100, 98, 94, 92, 90, 95, 100, 108, 112, 115];
    const candles = makeCandles('2024-01-01', closePrices);
    // Entry when close < 95, exit when close > 110
    const rules = makePriceStrategy(95, 110);
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // close < 95 first fires at index 2 (close=94), entry at open[3]
    // close > 110 first fires at index 8 (close=112), exit at open[9]
    expect(result.trades.length).toBeGreaterThanOrEqual(1);

    const trade = result.trades[0];
    // Entry at open of candle 3
    expect(trade.entryDate).toBe(candles[3].t);
    expect(trade.entryPrice).toBe(candles[3].o);
    // Exit at open of candle 9
    expect(trade.exitDate).toBe(candles[9].t);
    expect(trade.exitPrice).toBe(candles[9].o);
  });

  it('applies fees and slippage correctly', () => {
    const closePrices = [100, 98, 94, 92, 90, 95, 100, 108, 112, 115];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(95, 110);
    const initialCapital = 10000;
    const feeBps = 10; // 0.1%
    const slippageBps = 5; // 0.05%
    const config = makeConfig(rules, candles, {
      initialCapital,
      feeBps,
      slippageBps,
    });

    const result = runBacktest(config, candles);
    expect(result.trades.length).toBeGreaterThanOrEqual(1);

    const trade = result.trades[0];

    // Entry: signal at index 2 (close=94 < 95), fill at open[3]
    // open[3] = 92 + (-2) = 90
    const expectedEntryFill = candles[3].o * (1 + slippageBps / 10000);
    expect(trade.entryPrice).toBeCloseTo(expectedEntryFill, 6);

    // Exit: signal at index 8 (close=112 > 110), fill at open[9]
    // open[9] = 115 + (-2) = 113
    const expectedExitFill = candles[9].o * (1 - slippageBps / 10000);
    expect(trade.exitPrice).toBeCloseTo(expectedExitFill, 6);

    // Verify PnL calculation with fees
    const positionSize = trade.positionSize;
    const entryFee = positionSize * (feeBps / 10000);
    const netInvestable = positionSize - entryFee;
    const units = netInvestable / trade.entryPrice;

    const grossProceeds = trade.exitPrice * units;
    const exitFee = grossProceeds * (feeBps / 10000);
    const netProceeds = grossProceeds - exitFee;
    const expectedPnl = netProceeds - positionSize;

    expect(trade.pnlAbs).toBeCloseTo(expectedPnl, 2);
  });

  it('force-closes when position is still open at end', () => {
    // Price drops and stays low — entry fires but exit never fires
    const closePrices = [100, 98, 94, 92, 90, 88, 86, 85, 84, 83];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(95, 200); // exit at 200 will never fire
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe('Force-close at end of data');
    expect(result.trades[0].exitDate).toBe(candles[candles.length - 1].t);
    // Exit at last candle close (no slippage since slippageBps=0)
    expect(result.trades[0].exitPrice).toBe(candles[candles.length - 1].c);
  });

  it('equity curve has correct length (tradable candles)', () => {
    // With a price-based strategy (no warmup), equity = candles.length
    const closePrices = [100, 102, 104, 106, 108];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(200, 300); // never triggers
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    // Price strategy uses price_close (no warmup), so all candles are tradable
    expect(result.equityCurve).toHaveLength(candles.length);
  });

  it('determinism: same inputs produce identical results', () => {
    const closePrices = [100, 98, 94, 92, 90, 95, 100, 108, 112, 115];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(95, 110);
    const config = makeConfig(rules, candles);

    const result1 = runBacktest(config, candles);
    const result2 = runBacktest(config, candles);

    expect(result1.trades).toEqual(result2.trades);
    expect(result1.equityCurve).toEqual(result2.equityCurve);
    expect(result1.metrics).toEqual(result2.metrics);
  });

  it('handles fixed_amount position sizing', () => {
    const closePrices = [100, 98, 94, 92, 90, 95, 100, 108, 112, 115];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules: StrategyRuleSet = {
      ...makePriceStrategy(95, 110),
      sizing: { type: 'fixed_amount', valueUsd: 5000 },
    };
    const config = makeConfig(rules, candles, {
      initialCapital: 10000,
      feeBps: 0,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    expect(result.trades[0].positionSize).toBe(5000);
  });

  it('handles RSI strategy with proper warmup', () => {
    // Need 15+ candles for RSI(14) warmup
    // Create a price series that triggers RSI < 30 then RSI > 70
    // Use a sharp drop followed by a sharp rise
    const prices: number[] = [];
    // 15 stable candles for warmup
    for (let i = 0; i < 15; i++) prices.push(100);
    // 5 candles dropping sharply (trigger RSI < 30)
    prices.push(95, 88, 80, 72, 65);
    // 5 candles rising sharply (trigger RSI > 70)
    prices.push(75, 90, 105, 120, 135);

    const candles = makeCandles('2024-01-01', prices);
    const rules = makeRSIStrategy(30, 70, 14);
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // Warmup = 14 for RSI(14)
    expect(result.audit.warmupCandles).toBe(14);
    // Equity curve starts from warmup
    expect(result.equityCurve).toHaveLength(candles.length - 14);
  });

  it('filters candles to date range', () => {
    const closePrices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(200, 300); // never triggers
    // Only use first 5 candles
    const config = makeConfig(rules, candles, {
      startDate: '2024-01-01',
      endDate: '2024-01-05',
    });

    const result = runBacktest(config, candles);

    expect(result.equityCurve).toHaveLength(5);
    expect(result.audit.totalCandles).toBe(5);
  });

  it('tracks drawdown correctly', () => {
    // Enter position, price drops (drawdown), price recovers
    const closePrices = [100, 98, 94, 92, 90, 85, 80, 90, 100, 110];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(95, 200); // enter when price < 95, never exit
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // There should be some negative drawdown values
    const hasDrawdown = result.equityCurve.some((pt) => pt.drawdownPct < 0);
    expect(hasDrawdown).toBe(true);

    // Drawdown should never be positive
    for (const pt of result.equityCurve) {
      expect(pt.drawdownPct).toBeLessThanOrEqual(0);
    }
  });

  it('handles multiple entry-exit cycles', () => {
    // Price oscillates: below 95, above 110, below 95, above 110
    const closePrices = [
      100, 98, 94, 92, 90,    // entry at index 2
      95, 100, 108, 112, 115, // exit at index 8
      110, 105, 100, 94, 92,  // entry at index 13
      95, 100, 108, 112, 115, // exit at index 18
    ];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makePriceStrategy(95, 110);
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // Should have at least 2 trades (entry-exit cycles)
    expect(result.trades.length).toBeGreaterThanOrEqual(2);

    // All exit reasons should be "Exit signal" (none force-closed)
    for (const trade of result.trades) {
      expect(trade.exitReason).toBe('Exit signal');
    }
  });

  it('handles position-scope exit conditions (pnl_pct)', () => {
    // Enter at any time, exit when pnl_pct > 10%
    const closePrices = [100, 98, 94, 92, 90, 95, 100, 105, 110, 115];
    const candles = makeCandles('2024-01-01', closePrices);

    const rules: StrategyRuleSet = {
      id: 'test-pnl',
      name: 'PnL Exit',
      mode: { type: 'standard' },
      entry: {
        op: 'AND',
        conditions: [
          {
            id: 'entry-always',
            label: 'close < 99',
            scope: 'candle',
            left: { kind: 'indicator', indicator: { type: 'price_close' } },
            op: 'lt',
            right: { kind: 'number', value: 99 },
          },
        ],
      },
      exit: {
        op: 'AND',
        conditions: [
          {
            id: 'exit-pnl',
            label: 'pnl_pct > 10',
            scope: 'position',
            left: { kind: 'indicator', indicator: { type: 'pnl_pct' } },
            op: 'gt',
            right: { kind: 'number', value: 10 },
          },
        ],
      },
      sizing: { type: 'percent_equity', valuePct: 100 },
      metadata: { warnings: [] },
    };

    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });
    const result = runBacktest(config, candles);

    // Should have at least one trade
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    // The trade should have positive PnL (exited when pnl > 10%)
    expect(result.trades[0].pnlPct).toBeGreaterThan(0);
  });
});
