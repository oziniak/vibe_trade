import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/engine/backtest';
import type { BacktestConfig, Candle } from '@/types/results';
import type { StrategyRuleSet } from '@/types/strategy';

// ---------------------------------------------------------------------------
// Helper: make candles with explicit open/high/low/close
// ---------------------------------------------------------------------------

function makeExplicitCandles(
  data: { t: string; o: number; h: number; l: number; c: number; v: number }[],
): Candle[] {
  return data;
}

// ---------------------------------------------------------------------------
// Helper: build a simple price strategy
// ---------------------------------------------------------------------------

function makePriceStrategy(
  entryBelow: number,
  exitAbove: number,
): StrategyRuleSet {
  return {
    id: 'test-no-lookahead',
    name: 'No Lookahead Test',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'entry',
          label: `close < ${entryBelow}`,
          scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'price_close' } },
          op: 'lt',
          right: { kind: 'number', value: entryBelow },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'exit',
          label: `close > ${exitAbove}`,
          scope: 'candle',
          left: { kind: 'indicator', indicator: { type: 'price_close' } },
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
    feeBps: 0,
    slippageBps: 0,
    rules,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('No-lookahead verification', () => {
  it('entry fills at open[i+1], NOT at any price from candle i', () => {
    // Candle i=2 has close=90 which triggers entry (< 95)
    // We set open[3] to a very specific value (999) to verify that's where the fill happens
    const candles = makeExplicitCandles([
      { t: '2024-01-01', o: 100, h: 105, l: 95, c: 100, v: 1000 },
      { t: '2024-01-02', o: 100, h: 105, l: 90, c: 98,  v: 1000 },
      { t: '2024-01-03', o: 98,  h: 100, l: 85, c: 90,  v: 1000 }, // signal fires here (close=90 < 95)
      { t: '2024-01-04', o: 77,  h: 100, l: 70, c: 92,  v: 1000 }, // entry fills at open=77
      { t: '2024-01-05', o: 93,  h: 110, l: 90, c: 95,  v: 1000 },
      { t: '2024-01-06', o: 96,  h: 115, l: 94, c: 100, v: 1000 },
      { t: '2024-01-07', o: 101, h: 120, l: 99, c: 110, v: 1000 }, // exit signal (close=110 > 105)
      { t: '2024-01-08', o: 55,  h: 120, l: 50, c: 115, v: 1000 }, // exit fills at open=55
    ]);

    const rules = makePriceStrategy(95, 105);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(1);

    const trade = result.trades[0];

    // Entry must be at open of candle 3, NOT at close/open/high/low of candle 2
    expect(trade.entryPrice).toBe(77);
    expect(trade.entryDate).toBe('2024-01-04');

    // Verify it's NOT at candle 2's close (the signal candle)
    expect(trade.entryPrice).not.toBe(90);   // not close[2]
    expect(trade.entryPrice).not.toBe(98);   // not open[2]

    // Exit must be at open of candle 7 (index 7), NOT at candle 6 prices
    expect(trade.exitPrice).toBe(55);
    expect(trade.exitDate).toBe('2024-01-08');

    // Verify it's NOT at candle 6's prices
    expect(trade.exitPrice).not.toBe(110);   // not close[6]
    expect(trade.exitPrice).not.toBe(101);   // not open[6]
  });

  it('signal at the LAST candle is IGNORED for entry (no trade created)', () => {
    // The only entry signal fires on the very last candle — there is no i+1
    const candles = makeExplicitCandles([
      { t: '2024-01-01', o: 100, h: 105, l: 95,  c: 100, v: 1000 },
      { t: '2024-01-02', o: 100, h: 105, l: 95,  c: 100, v: 1000 },
      { t: '2024-01-03', o: 100, h: 105, l: 95,  c: 100, v: 1000 },
      { t: '2024-01-04', o: 100, h: 105, l: 85,  c: 90,  v: 1000 }, // signal fires here (last candle)
    ]);

    const rules = makePriceStrategy(95, 200);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    // No trade should be created because signal fires at last candle
    expect(result.trades).toHaveLength(0);
  });

  it('signal at the LAST candle is IGNORED for exit (force-close instead)', () => {
    // Entry signal fires at candle 1, exit signal fires at the very last candle
    const candles = makeExplicitCandles([
      { t: '2024-01-01', o: 100, h: 105, l: 88, c: 90,  v: 1000 }, // entry signal (close=90 < 95)
      { t: '2024-01-02', o: 92,  h: 105, l: 90, c: 95,  v: 1000 }, // entry fills here
      { t: '2024-01-03', o: 96,  h: 110, l: 94, c: 100, v: 1000 },
      { t: '2024-01-04', o: 101, h: 120, l: 99, c: 110, v: 1000 }, // exit signal (close=110 > 105), but this is LAST candle
    ]);

    const rules = makePriceStrategy(95, 105);
    const config = makeConfig(rules, candles);

    const result = runBacktest(config, candles);

    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];

    // The exit signal at candle 3 (last) cannot execute at open[4] (doesn't exist)
    // So it must be force-closed at last candle's close
    expect(trade.exitReason).toBe('Force-close at end of data');
    expect(trade.exitDate).toBe('2024-01-04');
    expect(trade.exitPrice).toBe(candles[3].c); // force-close at close, no slippage because config has 0
  });

  it('entry with slippage fills at open[i+1] * (1 + slippageBps/10000)', () => {
    const candles = makeExplicitCandles([
      { t: '2024-01-01', o: 100, h: 105, l: 88, c: 90,  v: 1000 }, // entry signal
      { t: '2024-01-02', o: 200, h: 210, l: 195, c: 205, v: 1000 }, // fills here
      { t: '2024-01-03', o: 206, h: 220, l: 200, c: 210, v: 1000 },
      { t: '2024-01-04', o: 211, h: 230, l: 208, c: 220, v: 1000 },
    ]);

    const rules = makePriceStrategy(95, 300); // enter when < 95, never exit
    const slippageBps = 50; // 0.5%
    const config = makeConfig(rules, candles, { slippageBps, feeBps: 0 });

    const result = runBacktest(config, candles);
    expect(result.trades).toHaveLength(1);

    const expectedFill = 200 * (1 + 50 / 10000); // 200 * 1.005 = 201
    expect(result.trades[0].entryPrice).toBeCloseTo(expectedFill, 6);
  });

  it('exit with slippage fills at open[i+1] * (1 - slippageBps/10000)', () => {
    const candles = makeExplicitCandles([
      { t: '2024-01-01', o: 100, h: 105, l: 85, c: 90,  v: 1000 }, // entry signal
      { t: '2024-01-02', o: 92,  h: 100, l: 88, c: 95,  v: 1000 }, // entry fills
      { t: '2024-01-03', o: 96,  h: 115, l: 94, c: 110, v: 1000 }, // exit signal (close=110 > 105)
      { t: '2024-01-04', o: 300, h: 320, l: 290, c: 310, v: 1000 }, // exit fills at open=300
    ]);

    const rules = makePriceStrategy(95, 105);
    const slippageBps = 50; // 0.5%
    const config = makeConfig(rules, candles, { slippageBps, feeBps: 0 });

    const result = runBacktest(config, candles);
    expect(result.trades).toHaveLength(1);

    const expectedFill = 300 * (1 - 50 / 10000); // 300 * 0.995 = 298.5
    expect(result.trades[0].exitPrice).toBeCloseTo(expectedFill, 6);
  });
});
