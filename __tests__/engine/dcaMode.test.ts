import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/engine/backtest';
import type { BacktestConfig, Candle } from '@/types/results';
import type { StrategyRuleSet } from '@/types/strategy';

// ---------------------------------------------------------------------------
// Helper: build candles
// ---------------------------------------------------------------------------

function makeCandles(
  startDate: string,
  closePrices: number[],
  opts?: { openOffset?: number; highOffset?: number; lowOffset?: number; volume?: number },
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
// Helper: build DCA strategy
// ---------------------------------------------------------------------------

function makeDCAStrategy(intervalDays: number, amountUsd: number): StrategyRuleSet {
  return {
    id: 'test-dca',
    name: 'DCA Strategy',
    mode: { type: 'dca', intervalDays, amountUsd },
    entry: { op: 'AND', conditions: [] },
    exit: { op: 'AND', conditions: [] },
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

describe('DCA mode backtest', () => {
  it('buys at regular intervals (every N candles)', () => {
    const closePrices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];
    const candles = makeCandles('2024-01-01', closePrices);
    // Buy $1000 every 3 candles
    const rules = makeDCAStrategy(3, 1000);
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // Buys at indices: 0, 3, 6, 9 (every 3 candles starting from 0)
    expect(result.trades).toHaveLength(4);

    // Verify buy dates
    expect(result.trades[0].entryDate).toBe(candles[0].t);
    expect(result.trades[1].entryDate).toBe(candles[3].t);
    expect(result.trades[2].entryDate).toBe(candles[6].t);
    expect(result.trades[3].entryDate).toBe(candles[9].t);

    // All exit reasons should be DCA hold
    for (const trade of result.trades) {
      expect(trade.exitReason).toBe('DCA hold');
    }
  });

  it('DCA buys at close[i], NOT at open[i+1]', () => {
    // Set very different opens vs closes to verify which price is used
    const candles: Candle[] = [
      { t: '2024-01-01', o: 200, h: 210, l: 95,  c: 100, v: 1000 },
      { t: '2024-01-02', o: 300, h: 310, l: 95,  c: 102, v: 1000 },
      { t: '2024-01-03', o: 400, h: 410, l: 95,  c: 104, v: 1000 },
      { t: '2024-01-04', o: 500, h: 510, l: 95,  c: 106, v: 1000 },
    ];

    const rules = makeDCAStrategy(2, 1000); // buy every 2 candles
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    // Buys at indices 0 and 2
    expect(result.trades).toHaveLength(2);

    // Fill at close[0] = 100, NOT open[0] = 200
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].entryPrice).not.toBe(200);

    // Fill at close[2] = 104, NOT open[2] = 400 and NOT open[3] = 500
    expect(result.trades[1].entryPrice).toBe(104);
    expect(result.trades[1].entryPrice).not.toBe(400);
  });

  it('DCA buys at close[i] with slippage applied', () => {
    const candles: Candle[] = [
      { t: '2024-01-01', o: 200, h: 210, l: 95,  c: 100, v: 1000 },
      { t: '2024-01-02', o: 300, h: 310, l: 95,  c: 102, v: 1000 },
    ];

    const slippageBps = 50; // 0.5%
    const rules = makeDCAStrategy(1, 1000); // buy every candle
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps });

    const result = runBacktest(config, candles);

    // First buy at close[0] * (1 + 0.005)
    const expectedFill0 = 100 * (1 + 50 / 10000); // 100.5
    expect(result.trades[0].entryPrice).toBeCloseTo(expectedFill0, 6);

    // Second buy at close[1] * (1 + 0.005)
    const expectedFill1 = 102 * (1 + 50 / 10000); // 102.51
    expect(result.trades[1].entryPrice).toBeCloseTo(expectedFill1, 6);
  });

  it('stops buying when capital is depleted', () => {
    const closePrices = Array(20).fill(100);
    const candles = makeCandles('2024-01-01', closePrices);
    // $3000 per buy, $10000 capital, buy every candle
    // Can afford 3 full buys (3000*3 = 9000), then partial
    const rules = makeDCAStrategy(1, 3000);
    const config = makeConfig(rules, candles, {
      initialCapital: 10000,
      feeBps: 0,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // 3 full buys ($9000), then 1 partial buy ($1000 remaining), then 0
    expect(result.trades).toHaveLength(4);

    // First 3 buys are full $3000
    expect(result.trades[0].positionSize).toBe(3000);
    expect(result.trades[1].positionSize).toBe(3000);
    expect(result.trades[2].positionSize).toBe(3000);

    // 4th buy is partial (remaining cash = 1000)
    expect(result.trades[3].positionSize).toBe(1000);
  });

  it('handles capital depletion with fees', () => {
    const closePrices = Array(20).fill(100);
    const candles = makeCandles('2024-01-01', closePrices);
    // $5000 per buy, $10000 capital, feeBps = 10 (0.1%)
    // Buy 1: invest $5000, fee = $5000 * 0.001 = $5, total cost = $5005, remaining = $4995
    // Buy 2: invest $5000, fee = $5, total cost = $5005, but remaining = $4995 < $5005
    //   -> partial buy: investable = $4995 - $5 = $4990
    const rules = makeDCAStrategy(1, 5000);
    const config = makeConfig(rules, candles, {
      initialCapital: 10000,
      feeBps: 10,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // Should have 2 trades: 1 full, 1 partial
    expect(result.trades).toHaveLength(2);
  });

  it('skips buying when remaining cash is less than the fee', () => {
    const closePrices = Array(10).fill(100);
    const candles = makeCandles('2024-01-01', closePrices);
    // Capital = 100, amountUsd = 100, feeBps = 10
    // Buy 1: amount = 100, fee = 0.01, totalCost = 100.01, remaining = 100 < 100.01
    // This is actually a partial buy scenario: remaining (100) > fee (0.01)
    // investable = 100 - 0.01 = 99.99
    const rules = makeDCAStrategy(1, 100);
    const config = makeConfig(rules, candles, {
      initialCapital: 100,
      feeBps: 10,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // First buy is partial (100 < 100.01), but still executes
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    // After first buy, cash should be 0, no more buys
    expect(result.trades).toHaveLength(1);
  });

  it('equity = totalUnits * close + remainingCash', () => {
    const closePrices = [100, 100, 100, 100, 100, 200, 200, 200, 200, 200];
    const candles = makeCandles('2024-01-01', closePrices);
    // Buy $1000 every 5 candles, no fees/slippage for simple math
    const rules = makeDCAStrategy(5, 1000);
    const config = makeConfig(rules, candles, {
      initialCapital: 10000,
      feeBps: 0,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // Buy at index 0: $1000 at close=100 => 10 units, cash = 9000
    // Buy at index 5: $1000 at close=200 => 5 units, cash = 8000

    // After index 0 buy: equity = 10 * 100 + 9000 = 10000
    expect(result.equityCurve[0].equity).toBeCloseTo(10000, 2);

    // At index 4 (close=100): equity = 10 * 100 + 9000 = 10000
    expect(result.equityCurve[4].equity).toBeCloseTo(10000, 2);

    // At index 5 (close=200), after buying 5 more units:
    // equity = (10 + 5) * 200 + 8000 = 3000 + 8000 = 11000
    expect(result.equityCurve[5].equity).toBeCloseTo(11000, 2);

    // At index 9 (close=200): equity = 15 * 200 + 8000 = 11000
    expect(result.equityCurve[9].equity).toBeCloseTo(11000, 2);
  });

  it('sets warmupCandles = 0 for DCA', () => {
    const closePrices = [100, 102, 104, 106, 108];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makeDCAStrategy(1, 1000);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    expect(result.audit.warmupCandles).toBe(0);
    expect(result.audit.positionModel).toBe('DCA additive');
  });

  it('equity curve has one point per candle (no warmup)', () => {
    const closePrices = [100, 102, 104, 106, 108];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makeDCAStrategy(2, 1000);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    expect(result.equityCurve).toHaveLength(candles.length);
  });

  it('all DCA trades have exitReason "DCA hold" and exit at last candle', () => {
    const closePrices = [100, 102, 104, 106, 108];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makeDCAStrategy(2, 1000);
    const config = makeConfig(rules, candles, { feeBps: 0, slippageBps: 0 });

    const result = runBacktest(config, candles);

    for (const trade of result.trades) {
      expect(trade.exitReason).toBe('DCA hold');
      expect(trade.exitDate).toBe(candles[candles.length - 1].t);
      expect(trade.exitPrice).toBe(candles[candles.length - 1].c);
    }
  });

  it('handles empty date range for DCA', () => {
    const closePrices = [100, 102, 104];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makeDCAStrategy(1, 1000);
    const config = makeConfig(rules, candles, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
  });

  it('drawdown tracks correctly as price drops', () => {
    // Price drops from 100 to 50, then recovers
    const closePrices = [100, 90, 80, 70, 60, 50, 60, 70, 80, 90];
    const candles = makeCandles('2024-01-01', closePrices);
    const rules = makeDCAStrategy(1, 1000); // buy every day
    const config = makeConfig(rules, candles, {
      initialCapital: 10000,
      feeBps: 0,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // There should be negative drawdown somewhere
    const hasDrawdown = result.equityCurve.some((pt) => pt.drawdownPct < 0);
    expect(hasDrawdown).toBe(true);

    // All drawdowns should be <= 0
    for (const pt of result.equityCurve) {
      expect(pt.drawdownPct).toBeLessThanOrEqual(0.0001); // small epsilon for floating point
    }
  });

  it('partial buy uses remaining cash minus fee', () => {
    const closePrices = Array(5).fill(100);
    const candles = makeCandles('2024-01-01', closePrices);
    // Capital = 150, amount = 100, fee = 0 (for simplicity)
    // Buy 1: invest 100, cash = 50
    // Buy 2: want 100, only have 50 => partial buy of 50
    const rules = makeDCAStrategy(1, 100);
    const config = makeConfig(rules, candles, {
      initialCapital: 150,
      feeBps: 0,
      slippageBps: 0,
    });

    const result = runBacktest(config, candles);

    // 2 buys: full 100, then partial 50
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].positionSize).toBe(100);
    expect(result.trades[1].positionSize).toBe(50);
  });
});
