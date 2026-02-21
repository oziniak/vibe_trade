import type { StrategyRuleSet } from '@/types/strategy';

/**
 * 6 preset strategy rule sets for the crypto backtester.
 *
 * Each preset is a complete, valid StrategyRuleSet ready to be fed
 * directly into the backtest engine or displayed in the UI preset picker.
 */
export const PRESETS: StrategyRuleSet[] = [
  // ── 1. RSI Mean Reversion ────────────────────────────────────────────
  {
    id: 'preset-rsi-mean-reversion',
    name: 'RSI Mean Reversion',
    description:
      'Buy when RSI drops below 30 (oversold), sell when it rises above 70 (overbought)',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'rsi-mr-entry-1',
          label: 'RSI(14) < 30',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'rsi', period: 14 },
          },
          op: 'lt',
          right: { kind: 'number', value: 30 },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'rsi-mr-exit-1',
          label: 'RSI(14) > 70',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'rsi', period: 14 },
          },
          op: 'gt',
          right: { kind: 'number', value: 70 },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },

  // ── 2. Golden Cross ──────────────────────────────────────────────────
  {
    id: 'preset-golden-cross',
    name: 'Golden Cross',
    description:
      'Buy when 50-day MA crosses above 200-day MA, sell on death cross',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'gc-entry-1',
          label: 'SMA(50) crosses above SMA(200)',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'sma', period: 50 },
          },
          op: 'crosses_above',
          right: {
            kind: 'indicator',
            indicator: { type: 'sma', period: 200 },
          },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'gc-exit-1',
          label: 'SMA(50) crosses below SMA(200)',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'sma', period: 50 },
          },
          op: 'crosses_below',
          right: {
            kind: 'indicator',
            indicator: { type: 'sma', period: 200 },
          },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },

  // ── 3. Dip Buyer with TP/SL ──────────────────────────────────────────
  {
    id: 'preset-dip-buyer',
    name: 'Dip Buyer with TP/SL',
    description:
      'Buy 10% weekly dips, take profit at 20%, stop loss at 5%',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'dip-entry-1',
          label: 'pct_change(7) < -10%',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'pct_change', period: 7 },
          },
          op: 'lt',
          right: { kind: 'number', value: -10 },
        },
      ],
    },
    exit: {
      op: 'OR',
      conditions: [
        {
          id: 'dip-exit-tp',
          label: 'Take profit: pnl_pct >= 20%',
          scope: 'position',
          left: {
            kind: 'indicator',
            indicator: { type: 'pnl_pct' },
          },
          op: 'gte',
          right: { kind: 'number', value: 20 },
        },
        {
          id: 'dip-exit-sl',
          label: 'Stop loss: pnl_pct <= -5%',
          scope: 'position',
          left: {
            kind: 'indicator',
            indicator: { type: 'pnl_pct' },
          },
          op: 'lte',
          right: { kind: 'number', value: -5 },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },

  // ── 4. Bollinger Bounce ──────────────────────────────────────────────
  {
    id: 'preset-bollinger-bounce',
    name: 'Bollinger Bounce',
    description:
      'Buy when price touches lower Bollinger Band, sell at upper band',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'bb-entry-1',
          label: 'Close < BB Lower(20, 2)',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'price_close' },
          },
          op: 'lt',
          right: {
            kind: 'indicator',
            indicator: { type: 'bb_lower', period: 20, stdDev: 2 },
          },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'bb-exit-1',
          label: 'Close > BB Upper(20, 2)',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: { type: 'price_close' },
          },
          op: 'gt',
          right: {
            kind: 'indicator',
            indicator: { type: 'bb_upper', period: 20, stdDev: 2 },
          },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },

  // ── 5. MACD Momentum ─────────────────────────────────────────────────
  {
    id: 'preset-macd-momentum',
    name: 'MACD Momentum',
    description:
      'Buy on bullish MACD crossover, sell on bearish crossover',
    mode: { type: 'standard' },
    entry: {
      op: 'AND',
      conditions: [
        {
          id: 'macd-entry-1',
          label: 'MACD line crosses above signal',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: {
              type: 'macd_line',
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
            },
          },
          op: 'crosses_above',
          right: {
            kind: 'indicator',
            indicator: {
              type: 'macd_signal',
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
            },
          },
        },
      ],
    },
    exit: {
      op: 'AND',
      conditions: [
        {
          id: 'macd-exit-1',
          label: 'MACD line crosses below signal',
          scope: 'candle',
          left: {
            kind: 'indicator',
            indicator: {
              type: 'macd_line',
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
            },
          },
          op: 'crosses_below',
          right: {
            kind: 'indicator',
            indicator: {
              type: 'macd_signal',
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
            },
          },
        },
      ],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },

  // ── 6. Weekly DCA ────────────────────────────────────────────────────
  {
    id: 'preset-weekly-dca',
    name: 'Weekly DCA',
    description:
      'Dollar-cost average $100 every week regardless of price',
    mode: { type: 'dca', intervalDays: 7, amountUsd: 100 },
    entry: {
      op: 'AND',
      conditions: [],
    },
    exit: {
      op: 'AND',
      conditions: [],
    },
    sizing: { type: 'percent_equity', valuePct: 100 },
  },
];

/**
 * Look up a preset by its id.
 * Returns `undefined` if no preset matches the given id.
 */
export function getPresetById(id: string): StrategyRuleSet | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
