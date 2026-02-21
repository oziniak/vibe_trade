# Data Model: Vibe Trade — Crypto Strategy Backtester

**Date**: 2026-02-21
**Feature**: [spec.md](./spec.md)
**Source**: Extracted from [vibe-trade-final-spec-v3.md](../../vibe-trade-final-spec-v3.md) §6

## Entity Relationship Overview

```
StrategyRuleSet
  ├── StrategyMode (standard | dca)
  ├── ConditionGroup (entry)
  │   └── Condition[] (each has Operand left/right)
  ├── ConditionGroup (exit)
  └── PositionSizing (percent_equity | fixed_amount)

BacktestConfig
  ├── AssetSymbol
  ├── date range + capital + fees
  └── StrategyRuleSet

BacktestResult
  ├── BacktestConfig
  ├── Trade[]
  ├── EquityPoint[]
  ├── PerformanceMetrics
  ├── BenchmarkResult
  ├── indicatorData (Record<string, (number|null)[]>)
  └── AuditInfo

AppState
  ├── AppPhase
  ├── config (asset, dates, capital, fees)
  ├── currentRules: StrategyRuleSet | null
  ├── results: [BacktestResult | null, BacktestResult | null]
  ├── runHistory: RunSnapshot[]
  └── error: string | null
```

## Core Types (Zod Schemas)

All types enforced with Zod at runtime. Defined in `src/types/strategy.ts`.

### Enums

| Enum | Values | Purpose |
|------|--------|---------|
| `AssetSymbol` | BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX | Supported crypto assets |
| `Timeframe` | 1D (literal) | Locked to daily for MVP |
| `ComparisonOp` | lt, lte, gt, gte, eq, crosses_above, crosses_below | Condition operators |
| `LogicOp` | AND, OR | Group logic |
| `Scope` | candle, position | Condition evaluation scope |
| `IndicatorType` | price_close, price_open, price_high, price_low, sma, ema, rsi, macd_line, macd_signal, macd_hist, bb_upper, bb_middle, bb_lower, atr, pct_change, volume, pnl_pct, bars_in_trade | All indicator types |

### IndicatorSpec

```typescript
{
  type: IndicatorType,
  period?: number,          // SMA(50), RSI(14), etc.
  fastPeriod?: number,      // MACD fast (default 12)
  slowPeriod?: number,      // MACD slow (default 26)
  signalPeriod?: number,    // MACD signal (default 9)
  stdDev?: number,          // Bollinger (default 2)
  source?: 'close' | 'open' | 'high' | 'low',  // default 'close'
}
```

### Operand (discriminated union)

```typescript
{ kind: 'indicator', indicator: IndicatorSpec }
  | { kind: 'number', value: number }
```

### Condition

```typescript
{
  id: string,               // "entry_1", "exit_2"
  label: string,            // "RSI(14) < 30"
  scope: Scope,             // default 'candle'
  left: Operand,
  op: ComparisonOp,
  right: Operand,
}
```

### ConditionGroup

```typescript
{
  op: LogicOp,
  conditions: Condition[],  // may be empty
}
```

Empty semantics: AND over empty = `true`, OR over empty = `false`.

### PositionSizing (discriminated union)

```typescript
{ type: 'percent_equity', valuePct: number }  // 1-100
  | { type: 'fixed_amount', valueUsd: number }  // positive
```

### StrategyMode (discriminated union)

```typescript
{ type: 'standard' }
  | { type: 'dca', intervalDays: number, amountUsd: number }
```

### StrategyRuleSet

```typescript
{
  id: string,
  name: string,
  description?: string,
  mode: StrategyMode,
  entry: ConditionGroup,
  exit: ConditionGroup,
  sizing: PositionSizing,  // default { type: 'percent_equity', valuePct: 100 }
  metadata?: {
    originalPrompt?: string,
    parserConfidence?: 'low' | 'medium' | 'high',
    confidenceScore?: number,  // 0-1
    warnings: string[],
  },
}
```

### Post-Zod Invariants

Enforced by `validateRuleSetInvariants()`:

| Mode | Entry conditions | Exit conditions | Sizing |
|------|-----------------|-----------------|--------|
| `standard` | MUST be non-empty (>=1) | MAY be empty (hold until end, with warning) | Used for position sizing |
| `dca` | MUST be empty | MUST be empty | Ignored (uses `mode.amountUsd`) |

Additional invariants:
- `crosses_above`/`crosses_below` must have indicator operands on both sides.
- `scope: 'position'` only valid with `pnl_pct` or `bars_in_trade` indicator types.
- All indicator types must be from the valid `IndicatorType` enum.

## Result Types

Defined in `src/types/results.ts`.

### BacktestConfig

```typescript
{
  asset: AssetSymbol,
  timeframe: '1D',
  startDate: string,        // ISO date
  endDate: string,          // ISO date
  initialCapital: number,   // default 10000
  feeBps: number,           // default 10 (0.1%)
  slippageBps: number,      // default 5 (0.05%)
  rules: StrategyRuleSet,
}
```

### Trade

```typescript
{
  id: number,
  entryDate: string,
  entryPrice: number,       // after slippage
  exitDate: string,
  exitPrice: number,        // after slippage
  pnlAbs: number,           // absolute P&L in $
  pnlPct: number,           // percentage P&L
  holdingDays: number,
  exitReason: string,       // "pnl_pct >= 15 (take profit)" or "RSI > 70"
  positionSize: number,     // $ invested
}
```

### EquityPoint

```typescript
{
  date: string,
  equity: number,
  benchmarkEquity: number,
  drawdownPct: number,      // negative %
}
```

### PerformanceMetrics

14 metrics with exact formulas:

| Metric | Type | Edge Case |
|--------|------|-----------|
| totalReturn | number (%) | Can be negative |
| annualizedReturn (CAGR) | number (%) | Uses 365/totalDays |
| sharpeRatio | number | 0 if stdev=0; uses population stdev, rf=0, √365 |
| sortinoRatio | number | Infinity if no negative returns |
| maxDrawdown | number (%) | Negative number |
| maxDrawdownDurationDays | number | 0 if never below peak |
| winRate | number (%) | "N/A" if 0 trades; breakeven=win |
| profitFactor | number | Infinity if no losses; 0 if no wins |
| totalTrades | number | |
| avgWinPct | number (%) | "N/A" if no wins |
| avgLossPct | number (%) | Negative; "N/A" if no losses |
| bestTradePct | number (%) | |
| worstTradePct | number (%) | |
| avgHoldingDays | number | |
| exposureTimePct | number (%) | |

### BenchmarkResult

```typescript
{
  totalReturn: number,
  equityCurve: EquityPoint[],
  description: string,      // "Buy & Hold: entered at first tradable candle open, same fees"
}
```

### AuditInfo

```typescript
{
  executionModel: string,
  feeBps: number,
  slippageBps: number,
  warmupCandles: number,
  dataRange: string,
  totalCandles: number,
  tradableCandles: number,
  annualizationFactor: number,  // 365
  riskFreeRate: number,         // 0
  benchmarkModel: string,
  positionModel: string,
}
```

## Application State

### AppPhase

```typescript
'input' | 'parsing' | 'confirming' | 'running' | 'results' | 'comparing'
```

### AppState

```typescript
{
  phase: AppPhase,
  config: {
    asset: AssetSymbol,
    startDate: string,
    endDate: string,
    initialCapital: number,
    feeBps: number,
    slippageBps: number,
  },
  currentPrompt: string,
  currentRules: StrategyRuleSet | null,
  results: [BacktestResult | null, BacktestResult | null],
  runHistory: RunSnapshot[],
  error: string | null,
}
```

### RunSnapshot

```typescript
{
  id: string,
  timestamp: number,
  prompt: string,
  asset: string,
  metricsPreview: {
    totalReturn: number,
    sharpeRatio: number,
    winRate: number,
    totalTrades: number,
  },
  fullResult: BacktestResult,
}
```

### DemoSnapshot

```typescript
{
  id: string,
  presetId: string,
  displayName: string,
  config: {
    asset: AssetSymbol,
    startDate: string,
    endDate: string,
    initialCapital: number,
    feeBps: number,
    slippageBps: number,
  },
}
```

## OHLCV Data Format

Stored in `/public/data/{ASSET}_1D.json`:

```json
[
  { "t": "2020-01-01", "o": 7200.17, "h": 7254.33, "l": 7174.94, "c": 7200.17, "v": 18403.4 },
  ...
]
```

- Compact keys: `t` (time), `o` (open), `h` (high), `l` (low), `c` (close), `v` (volume).
- Source: Binance Spot OHLCV (`{ASSET}USDT` pair, `1d` interval).
- Timestamps: UTC 00:00, stored as `YYYY-MM-DD` strings.
- ~200KB total for 8 assets.
