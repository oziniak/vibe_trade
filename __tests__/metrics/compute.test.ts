import { describe, it, expect } from 'vitest';
import { computeMetrics, buildAuditInfo } from '@/metrics/compute';
import { computeBenchmark } from '@/engine/benchmark';
import type { Trade, EquityPoint, Candle } from '@/types/results';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an equity curve from daily equity values starting at the given date. */
function makeEquityCurve(
  values: number[],
  startDate = '2023-01-01',
): EquityPoint[] {
  let peak = values[0] ?? 0;
  return values.map((equity, i) => {
    const date = addDays(startDate, i);
    if (equity > peak) peak = equity;
    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    return { date, equity, benchmarkEquity: equity, drawdownPct };
  });
}

/** Return YYYY-MM-DD string offset by `days` from a base date. */
function addDays(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Create a minimal trade. */
function makeTrade(overrides: Partial<Trade> & { id: number }): Trade {
  return {
    entryDate: '2023-01-02',
    entryPrice: 100,
    exitDate: '2023-01-12',
    exitPrice: 110,
    pnlAbs: 10,
    pnlPct: 10,
    holdingDays: 10,
    exitReason: 'signal',
    positionSize: 100,
    ...overrides,
  };
}

/** Create a OHLCV candle. */
function makeCandle(overrides: Partial<Candle> & { t: string }): Candle {
  return { o: 100, h: 105, l: 95, c: 100, v: 1000, ...overrides };
}

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe('computeMetrics', () => {
  // =========================================================================
  // 0 trades
  // =========================================================================
  describe('0 trades', () => {
    it('returns correct totalReturn from equity curve with no trades', () => {
      // Equity went from 10000 to 10500 (e.g. rounding leftover, or just
      // a flat line); the equity curve drives totalReturn, not trades.
      const equity = makeEquityCurve([10000, 10100, 10200, 10300, 10400, 10500]);
      const m = computeMetrics([], equity, 10000, 100);

      expect(m.totalReturn).toBeCloseTo(5, 5);
      expect(m.totalTrades).toBe(0);
      expect(m.winRate).toBe(0);
      expect(m.profitFactor).toBe(0);
      expect(m.avgWinPct).toBe(0);
      expect(m.avgLossPct).toBe(0);
      expect(m.bestTradePct).toBe(0);
      expect(m.worstTradePct).toBe(0);
      expect(m.avgHoldingDays).toBe(0);
      expect(m.exposureTimePct).toBe(0);
    });
  });

  // =========================================================================
  // 1 winning trade
  // =========================================================================
  describe('1 winning trade', () => {
    it('computes all metrics correctly', () => {
      const initialCapital = 10000;
      // Entry at 100, exit at 110 => pnlPct = +10%, pnlAbs = +1000
      const trade = makeTrade({
        id: 1,
        entryPrice: 100,
        exitPrice: 110,
        pnlAbs: 1000,
        pnlPct: 10,
        holdingDays: 10,
      });

      // 11-day equity curve: flat at 10000 then grows linearly to 11000
      const equityValues = [10000, 10100, 10200, 10300, 10400, 10500, 10600, 10700, 10800, 10900, 11000];
      const equity = makeEquityCurve(equityValues);

      const m = computeMetrics([trade], equity, initialCapital, 100);

      expect(m.totalReturn).toBeCloseTo(10, 5);
      expect(m.totalTrades).toBe(1);
      expect(m.winRate).toBe(100);
      expect(m.profitFactor).toBe(Infinity);
      expect(m.avgWinPct).toBeCloseTo(10, 5);
      expect(m.avgLossPct).toBe(0);
      expect(m.bestTradePct).toBeCloseTo(10, 5);
      expect(m.worstTradePct).toBeCloseTo(10, 5);
      expect(m.avgHoldingDays).toBe(10);
      // exposure = 10 holding days / 100 total candles * 100 = 10%
      expect(m.exposureTimePct).toBeCloseTo(10, 5);
      // Equity only goes up => drawdown always 0
      expect(m.maxDrawdown).toBe(0);
      expect(m.maxDrawdownDurationDays).toBe(0);
    });
  });

  // =========================================================================
  // Mix of wins and losses
  // =========================================================================
  describe('mix of wins and losses', () => {
    const initialCapital = 10000;

    // Trade 1: +5% on 10000 => +500 (equity -> 10500), 5 days
    // Trade 2: -3% on 10500 => -315 (equity -> 10185), 3 days
    // Trade 3: +8% on 10185 => +814.80 (equity -> 10999.80), 7 days
    const trades: Trade[] = [
      makeTrade({ id: 1, pnlAbs: 500, pnlPct: 5, holdingDays: 5 }),
      makeTrade({ id: 2, pnlAbs: -315, pnlPct: -3, holdingDays: 3 }),
      makeTrade({ id: 3, pnlAbs: 814.80, pnlPct: 8, holdingDays: 7 }),
    ];

    // 20-candle equity curve with a dip in the middle
    // Days 0-5: 10000 -> 10500 (up)
    // Days 6-8: 10500 -> 10185 (down - drawdown)
    // Days 9-15: 10185 -> 10999.80 (recovery and new high)
    // Days 16-19: flat at ~11000
    const equityValues = [
      10000, 10100, 10200, 10300, 10400, 10500, // days 0-5
      10400, 10300, 10185,                       // days 6-8 (drawdown)
      10300, 10400, 10500, 10600, 10700, 10850, 10999.80, // days 9-15
      10999.80, 10999.80, 10999.80, 10999.80,   // days 16-19
    ];
    const equity = makeEquityCurve(equityValues);

    it('computes winRate correctly (2 wins, 1 loss)', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // 2 wins out of 3 trades
      expect(m.winRate).toBeCloseTo((2 / 3) * 100, 5);
    });

    it('computes profitFactor correctly', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // grossProfit = 500 + 814.80 = 1314.80
      // grossLoss  = | -315 | = 315
      // profitFactor = 1314.80 / 315 = 4.17397...
      expect(m.profitFactor).toBeCloseTo(1314.80 / 315, 4);
    });

    it('computes avgWinPct and avgLossPct', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      expect(m.avgWinPct).toBeCloseTo((5 + 8) / 2, 5); // 6.5
      expect(m.avgLossPct).toBeCloseTo(-3, 5);
    });

    it('computes bestTradePct and worstTradePct', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      expect(m.bestTradePct).toBeCloseTo(8, 5);
      expect(m.worstTradePct).toBeCloseTo(-3, 5);
    });

    it('computes avgHoldingDays', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      expect(m.avgHoldingDays).toBeCloseTo((5 + 3 + 7) / 3, 5); // 5
    });

    it('computes exposureTimePct', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // (5 + 3 + 7) / 20 * 100 = 75%
      expect(m.exposureTimePct).toBeCloseTo(75, 5);
    });

    it('computes maxDrawdown from equity curve', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // Peak at day 5: 10500
      // Trough at day 8: 10185
      // Drawdown = (10185 - 10500) / 10500 * 100 = -3%
      expect(m.maxDrawdown).toBeCloseTo(((10185 - 10500) / 10500) * 100, 4);
    });

    it('computes sharpe with non-zero stdev', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // Sharpe should be a finite positive number (equity generally trends up)
      expect(Number.isFinite(m.sharpeRatio)).toBe(true);
      expect(m.sharpeRatio).toBeGreaterThan(0);
    });

    it('computes sortino with some negative returns', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // Sortino should be finite and positive
      expect(Number.isFinite(m.sortinoRatio)).toBe(true);
      expect(m.sortinoRatio).toBeGreaterThan(0);
      // Sortino >= Sharpe when there are some negative and some positive returns
      // (downside dev <= total dev)
      expect(m.sortinoRatio).toBeGreaterThanOrEqual(m.sharpeRatio);
    });

    it('computes totalReturn from equity curve', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      const expected = ((10999.80 - 10000) / 10000) * 100;
      expect(m.totalReturn).toBeCloseTo(expected, 4);
    });

    it('computes annualizedReturn (CAGR)', () => {
      const m = computeMetrics(trades, equity, initialCapital, 20);
      // 19 calendar days in our equity curve
      const totalDays = 19;
      const expectedCAGR =
        (Math.pow(10999.80 / 10000, 365 / totalDays) - 1) * 100;
      expect(m.annualizedReturn).toBeCloseTo(expectedCAGR, 2);
    });
  });

  // =========================================================================
  // All wins
  // =========================================================================
  describe('all wins', () => {
    it('returns profitFactor=Infinity and winRate=100', () => {
      const trades = [
        makeTrade({ id: 1, pnlAbs: 200, pnlPct: 2, holdingDays: 3 }),
        makeTrade({ id: 2, pnlAbs: 300, pnlPct: 3, holdingDays: 4 }),
        makeTrade({ id: 3, pnlAbs: 0, pnlPct: 0, holdingDays: 1 }), // breakeven = win
      ];
      const equity = makeEquityCurve([10000, 10100, 10200, 10300, 10400, 10500]);
      const m = computeMetrics(trades, equity, 10000, 100);

      expect(m.winRate).toBe(100);
      expect(m.profitFactor).toBe(Infinity);
      expect(m.avgLossPct).toBe(0);
    });
  });

  // =========================================================================
  // All losses
  // =========================================================================
  describe('all losses', () => {
    it('returns profitFactor=0 and winRate=0', () => {
      const trades = [
        makeTrade({ id: 1, pnlAbs: -100, pnlPct: -1, holdingDays: 2 }),
        makeTrade({ id: 2, pnlAbs: -200, pnlPct: -2, holdingDays: 3 }),
      ];
      const equity = makeEquityCurve([10000, 9950, 9900, 9850, 9800, 9700]);
      const m = computeMetrics(trades, equity, 10000, 100);

      expect(m.winRate).toBe(0);
      expect(m.profitFactor).toBe(0);
      expect(m.avgWinPct).toBe(0);
      expect(m.avgLossPct).toBeCloseTo((-1 + -2) / 2, 5); // -1.5
    });
  });

  // =========================================================================
  // maxDrawdownDurationDays
  // =========================================================================
  describe('maxDrawdownDurationDays', () => {
    it('computes the longest period below peak', () => {
      // Peak at day 0: 10000
      // Drops day 1-5, recovers day 6 => 6-day drawdown
      // New peak at day 6: 10100
      // Drops day 7-8, recovers day 9 => 3-day drawdown
      // Longest = 6 days
      const equityValues = [10000, 9800, 9700, 9600, 9500, 9800, 10100, 10000, 9900, 10100];
      const equity = makeEquityCurve(equityValues);
      const m = computeMetrics([], equity, 10000, 10);

      // First drawdown: day 0 (peak) to day 5... but recovery at day 5 is 9800 < 10000
      // Actually recovery is at day 6 (10100 > 10000). Duration = day 0 to day 6 = 6 days.
      // Second drawdown: day 6 (peak 10100) to day 9 (10100). Duration = day 6 to day 9 = 3 days.
      expect(m.maxDrawdownDurationDays).toBe(6);
    });

    it('handles ongoing drawdown at end of data', () => {
      // Peak at day 0: 10000, then drops and never recovers
      const equityValues = [10000, 9500, 9000, 8500, 8000];
      const equity = makeEquityCurve(equityValues);
      const m = computeMetrics([], equity, 10000, 5);

      // Drawdown from day 0 to day 4 = 4 calendar days
      expect(m.maxDrawdownDurationDays).toBe(4);
    });

    it('returns 0 when equity only goes up', () => {
      const equityValues = [10000, 10100, 10200, 10300, 10400];
      const equity = makeEquityCurve(equityValues);
      const m = computeMetrics([], equity, 10000, 5);

      expect(m.maxDrawdownDurationDays).toBe(0);
    });
  });

  // =========================================================================
  // Sharpe with constant returns (stdev=0)
  // =========================================================================
  describe('sharpe edge cases', () => {
    it('returns 0 when all daily returns are identical (stdev=0)', () => {
      // Each day equity goes up by exactly 1% => daily return = 0.01 every day
      // stdev = 0 => sharpe = 0
      const equityValues: number[] = [10000];
      for (let i = 1; i <= 10; i++) {
        equityValues.push(equityValues[i - 1] * 1.01);
      }
      const equity = makeEquityCurve(equityValues);
      const m = computeMetrics([], equity, 10000, 11);

      expect(m.sharpeRatio).toBe(0);
    });

    it('returns 0 with fewer than 2 equity points', () => {
      const equity = makeEquityCurve([10000]);
      const m = computeMetrics([], equity, 10000, 1);

      expect(m.sharpeRatio).toBe(0);
      expect(m.sortinoRatio).toBe(0);
    });
  });

  // =========================================================================
  // Sortino edge cases
  // =========================================================================
  describe('sortino edge cases', () => {
    it('returns Infinity when no negative daily returns', () => {
      // Equity goes up with varying amounts (so stdev > 0 but no negative returns)
      const equityValues = [10000, 10100, 10300, 10350, 10500, 10900];
      const equity = makeEquityCurve(equityValues);
      const m = computeMetrics([], equity, 10000, 6);

      expect(m.sortinoRatio).toBe(Infinity);
    });
  });

  // =========================================================================
  // exposureTimePct
  // =========================================================================
  describe('exposureTimePct', () => {
    it('computes correctly with multiple trades', () => {
      const trades = [
        makeTrade({ id: 1, holdingDays: 10 }),
        makeTrade({ id: 2, holdingDays: 20 }),
        makeTrade({ id: 3, holdingDays: 5 }),
      ];
      const equity = makeEquityCurve([10000, 10100, 10200]);
      const m = computeMetrics(trades, equity, 10000, 100);

      // (10 + 20 + 5) / 100 * 100 = 35%
      expect(m.exposureTimePct).toBeCloseTo(35, 5);
    });

    it('returns 0 when totalCandles is 0', () => {
      const trades = [makeTrade({ id: 1, holdingDays: 5 })];
      const equity = makeEquityCurve([10000]);
      const m = computeMetrics(trades, equity, 10000, 0);

      expect(m.exposureTimePct).toBe(0);
    });
  });

  // =========================================================================
  // Hand-calculated Sharpe and Sortino
  // =========================================================================
  describe('hand-calculated sharpe and sortino', () => {
    it('matches hand-calculated sharpe', () => {
      // Equity: 100, 102, 101, 104, 103
      // Daily returns: 0.02, -0.0098039..., 0.029703..., -0.0096154...
      // Mean = (0.02 + (-0.0098039) + 0.029703 + (-0.0096154)) / 4
      //      = 0.030284 / 4 = 0.0075710...
      // Variance (population) = sum((r - mean)^2) / N
      // Stdev = sqrt(variance)
      // Sharpe = mean / stdev * sqrt(365)

      const equityValues = [100, 102, 101, 104, 103];
      const equity = makeEquityCurve(equityValues);

      const r0 = (102 - 100) / 100;   // 0.02
      const r1 = (101 - 102) / 102;   // -0.009803921...
      const r2 = (104 - 101) / 101;   // 0.029702970...
      const r3 = (103 - 104) / 104;   // -0.009615384...
      const returns = [r0, r1, r2, r3];

      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
      const stdev = Math.sqrt(variance);
      const expectedSharpe = (mean / stdev) * Math.sqrt(365);

      const m = computeMetrics([], equity, 100, 5);
      expect(m.sharpeRatio).toBeCloseTo(expectedSharpe, 6);
    });

    it('matches hand-calculated sortino', () => {
      const equityValues = [100, 102, 101, 104, 103];
      const equity = makeEquityCurve(equityValues);

      const r0 = (102 - 100) / 100;
      const r1 = (101 - 102) / 102;
      const r2 = (104 - 101) / 101;
      const r3 = (103 - 104) / 104;
      const returns = [r0, r1, r2, r3];

      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const negReturns = returns.filter((r) => r < 0);
      // Downside variance: sum(negR^2) / N (all returns count as N)
      const downsideVariance =
        negReturns.reduce((s, r) => s + r ** 2, 0) / returns.length;
      const downsideDev = Math.sqrt(downsideVariance);
      const expectedSortino = (mean / downsideDev) * Math.sqrt(365);

      const m = computeMetrics([], equity, 100, 5);
      expect(m.sortinoRatio).toBeCloseTo(expectedSortino, 6);
    });
  });
});

// ---------------------------------------------------------------------------
// computeBenchmark
// ---------------------------------------------------------------------------

describe('computeBenchmark', () => {
  it('returns empty result for empty candles', () => {
    const result = computeBenchmark([], 10000, 10, 5);
    expect(result.totalReturn).toBe(0);
    expect(result.equityCurve).toHaveLength(0);
    expect(result.description).toContain('Buy & Hold');
  });

  it('computes correct benchmark for a single candle', () => {
    const candles: Candle[] = [makeCandle({ t: '2023-01-01', o: 100, c: 110 })];
    const initialCapital = 10000;
    const feeBps = 10; // 0.1%
    const slippageBps = 5; // 0.05%

    const result = computeBenchmark(candles, initialCapital, feeBps, slippageBps);

    // Entry: price = 100 * (1 + 0.0005) = 100.05
    // Entry fee = 10000 * 0.001 = 10
    // Units = (10000 - 10) / 100.05 = 9990 / 100.05 = 99.8500749...
    const entryPrice = 100 * 1.0005;
    const entryFee = 10000 * 0.001;
    const units = (10000 - entryFee) / entryPrice;

    // Single candle is also the last => apply exit slippage + fee
    // Exit price with slippage = 110 * (1 - 0.0005) = 109.945
    // Gross equity = units * 109.945
    // Exit fee = grossEquity * 0.001
    // Net equity = grossEquity - exitFee
    const exitPrice = 110 * (1 - 0.0005);
    const grossEquity = units * exitPrice;
    const exitFee = grossEquity * 0.001;
    const netEquity = grossEquity - exitFee;

    const expectedReturn = ((netEquity - 10000) / 10000) * 100;

    expect(result.equityCurve).toHaveLength(1);
    expect(result.equityCurve[0].benchmarkEquity).toBeCloseTo(netEquity, 4);
    expect(result.totalReturn).toBeCloseTo(expectedReturn, 4);
  });

  it('computes correct benchmark for multiple candles', () => {
    const candles: Candle[] = [
      makeCandle({ t: '2023-01-01', o: 100, c: 102 }),
      makeCandle({ t: '2023-01-02', o: 102, c: 105 }),
      makeCandle({ t: '2023-01-03', o: 105, c: 110 }),
    ];
    const initialCapital = 10000;
    const feeBps = 10;
    const slippageBps = 5;

    const result = computeBenchmark(candles, initialCapital, feeBps, slippageBps);

    const entryPrice = 100 * 1.0005;
    const entryFee = 10000 * 0.001;
    const units = (10000 - entryFee) / entryPrice;

    // Day 0 (intermediate, even though it's candle 0 it's not the last): equity = units * 102
    // Actually day 0 is NOT the last, so equity = units * 102
    expect(result.equityCurve[0].benchmarkEquity).toBeCloseTo(units * 102, 2);

    // Day 1 (intermediate): equity = units * 105
    expect(result.equityCurve[1].benchmarkEquity).toBeCloseTo(units * 105, 2);

    // Day 2 (last): exit slippage + fee
    const exitPrice = 110 * (1 - 0.0005);
    const grossEquity = units * exitPrice;
    const exitFee = grossEquity * 0.001;
    const netEquity = grossEquity - exitFee;
    expect(result.equityCurve[2].benchmarkEquity).toBeCloseTo(netEquity, 2);

    expect(result.totalReturn).toBeCloseTo(
      ((netEquity - initialCapital) / initialCapital) * 100,
      4,
    );
  });

  it('computes correct drawdown in benchmark equity curve', () => {
    // Price goes up then down then recovers
    const candles: Candle[] = [
      makeCandle({ t: '2023-01-01', o: 100, c: 110 }),
      makeCandle({ t: '2023-01-02', o: 110, c: 105 }), // drawdown from peak
      makeCandle({ t: '2023-01-03', o: 105, c: 100 }), // deeper drawdown
      makeCandle({ t: '2023-01-04', o: 100, c: 115 }), // last candle, exit fees
    ];
    const result = computeBenchmark(candles, 10000, 0, 0);

    // With 0 fees/slippage: units = 10000/100 = 100
    // Day 0: 100*110 = 11000 (peak)
    // Day 1: 100*105 = 10500 (dd = (10500-11000)/11000 = -4.545%)
    // Day 2: 100*100 = 10000 (dd = (10000-11000)/11000 = -9.091%)
    // Day 3: 100*115 = 11500 (new peak, dd = 0)
    expect(result.equityCurve[0].drawdownPct).toBeCloseTo(0, 5);
    expect(result.equityCurve[1].drawdownPct).toBeCloseTo(
      ((10500 - 11000) / 11000) * 100,
      4,
    );
    expect(result.equityCurve[2].drawdownPct).toBeCloseTo(
      ((10000 - 11000) / 11000) * 100,
      4,
    );
    expect(result.equityCurve[3].drawdownPct).toBeCloseTo(0, 4);
  });

  it('handles zero fees and slippage', () => {
    const candles: Candle[] = [
      makeCandle({ t: '2023-01-01', o: 50, c: 55 }),
      makeCandle({ t: '2023-01-02', o: 55, c: 60 }),
    ];
    const result = computeBenchmark(candles, 10000, 0, 0);

    // units = 10000 / 50 = 200
    // Day 0: 200 * 55 = 11000
    // Day 1 (last, 0 fees): 200 * 60 = 12000
    expect(result.equityCurve[0].benchmarkEquity).toBeCloseTo(11000, 2);
    expect(result.equityCurve[1].benchmarkEquity).toBeCloseTo(12000, 2);
    expect(result.totalReturn).toBeCloseTo(20, 4);
  });
});

// ---------------------------------------------------------------------------
// buildAuditInfo
// ---------------------------------------------------------------------------

describe('buildAuditInfo', () => {
  it('builds correct audit info', () => {
    const audit = buildAuditInfo({
      feeBps: 10,
      slippageBps: 5,
      warmupCandles: 200,
      startDate: '2020-01-01',
      endDate: '2023-12-31',
      totalCandles: 1461,
      tradableCandles: 1261,
    });

    expect(audit.executionModel).toBe('Signal on close[i], execute at open[i+1]');
    expect(audit.feeBps).toBe(10);
    expect(audit.slippageBps).toBe(5);
    expect(audit.warmupCandles).toBe(200);
    expect(audit.dataRange).toBe('2020-01-01 to 2023-12-31');
    expect(audit.totalCandles).toBe(1461);
    expect(audit.tradableCandles).toBe(1261);
    expect(audit.annualizationFactor).toBe(365);
    expect(audit.riskFreeRate).toBe(0);
    expect(audit.benchmarkModel).toContain('Buy & Hold');
    expect(audit.positionModel).toContain('Long-only');
  });
});
