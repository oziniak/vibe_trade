# Vibe Trade — Final Specification v2

> **Context:** Solo entry for XBO's Claude Code Challenge (Feb 20–27, 2026).
> **Judged on:** Functionality · Usefulness · Code Quality · Creativity.
> **Deliverables:** Working app · 2–3 min demo video · GitHub repo.
> **Primary objective:** Win 1st place with a demo that is resilient under pressure.

---

## 0. Summary

**Vibe Trade** is a standalone web app that turns **plain-English trading ideas** into an **auditable strategy RuleSet (JSON)**, then runs a **deterministic backtest** on bundled historical OHLCV data and presents professional analytics: equity curve vs buy-and-hold, candlestick chart with trade markers, full metric suite, and trade-by-trade log.

**Core loop:** Describe → Parse → Confirm/Edit → Backtest → Analyze → Compare → Refine

**Reliability principle:** AI never "executes trades." AI only translates natural language into a constrained JSON schema. The backtest engine executes **only Zod-validated JSON**. Everything after the AI step is deterministic and auditable.

---

## 1. Non-Negotiable Principles

1. **AI is the translator, not the engine.** Claude parses English → JSON rules. Everything after that is deterministic math. If the AI is down, Demo Mode presets still work end-to-end.
2. **Zero runtime data dependencies.** Historical data is bundled as static JSON. Only the AI parse step needs a network call.
3. **Client-side engine for instant feedback.** The backtest runs in the browser. "Swap asset and re-run" is literally instant — no spinner, no server round-trip.
4. **Ship ugly on day 3, ship polished on day 6.** Engine must work end-to-end through UI by day 3. UI polish is layered on top of working math.
5. **Solo-scoped.** Every feature earns its place by contributing to the 3-minute demo or a judging criterion. No scope creep.

---

## 2. Non-Goals (Explicit)

- No connection to company systems, code, or databases.
- No live trading, no exchange integration, no wallets.
- No intraday timeframes (daily only for MVP).
- No "AI decides trades" — AI never makes market opinions or predictions.
- No server-side persistence. Runs live in-memory; sharing via URL-encoded configs.
- No shorting, no multiple simultaneous positions, no portfolio optimization.
- No trailing stop (approximated as fixed stop-loss if requested). No limit/stop-limit orders.
- No `between` operator (expressed as two AND conditions instead).

---

## 3. Goals & Success Criteria

### 3.1 Goals
1. **Impressive end-to-end in < 60 seconds:** Type prompt → rules appear → confirm → charts + metrics render.
2. **Demo-proof reliability:** Works even if Claude fails (Demo Mode presets skip AI entirely). Known-good snapshots guarantee visually interesting results with one click.
3. **Credible quant behavior:** No look-ahead bias. Fees + slippage modeled. Execution assumptions displayed. Benchmark uses identical assumptions.
4. **Strong engineering signal:** Zod-validated schemas, typed modules, unit-tested indicators/engine/metrics.

### 3.2 Definition of Done
- [ ] App runs locally via `pnpm dev` and optionally at a Vercel URL.
- [ ] 8 bundled assets: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX (daily candles).
- [ ] Strategy parsing from natural language + confirmation/editing UI.
- [ ] Deterministic backtesting with candlestick chart, equity curve, metrics, trade log.
- [ ] Compare mode: two strategies side-by-side.
- [ ] Demo Mode: preset strategies + known-good run snapshots work without Claude.
- [ ] Export/share: URL-encoded snapshot + JSON/CSV download.
- [ ] 2–3 minute demo video recordable with zero risk of failure.

### 3.3 Judging Criteria Mapping

| Criterion | How We Win |
|---|---|
| **Functionality** | Full E2E flow: parse → confirm → backtest → dashboard → compare. 12+ metrics. Trade log. Chart overlays. Audit panel. Export. |
| **Usefulness** | Anyone can test trading ideas without code. Templates for beginners. JSON editing for power users. Directly relevant to XBO's crypto business. |
| **Code Quality** | Zod schemas with discriminated unions. TypeScript strict mode. Pure-function engine with zero side effects. Unit tests for all math. JSDoc on public APIs. Clean module boundaries. |
| **Creativity** | NLP → quantitative finance is a bold intersection. AI IS the product, not just the build tool — the meta-move in a Claude Code challenge. "Vibe Trade" as a brand is memorable. The comparison feature turns a demo into a conversation. |

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                               │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Strategy      │  │ Rule         │  │ Results          │   │
│  │ Input Panel   │  │ Confirmation │  │ Dashboard        │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │              │
│         ▼                 ▼                    ▲              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              App State (React Context)                │    │
│  └───────────────────────┬──────────────────────────────┘    │
│                          │                                    │
│          ┌───────────────┴───────────────┐                    │
│          ▼                               ▼                    │
│  ┌───────────────────┐      ┌─────────────────────────┐      │
│  │ BACKTEST ENGINE   │      │ STATIC DATA STORE       │      │
│  │ (client-side TS)  │◄─────│ Bundled JSON (~200KB)   │      │
│  │                   │      │ /data/{asset}_1D.json   │      │
│  │ • indicators      │      └─────────────────────────┘      │
│  │ • engine loop     │                                        │
│  │ • metrics calc    │    ┌───────────────────────────┐      │
│  │ • Zod validation  │    │ DEMO MODE                 │      │
│  └───────────────────┘    │ • Preset RuleSet JSON     │      │
│                           │ • Known-good snapshots    │      │
│                           │   (strategy+asset+range)  │      │
│                           │ • Skip Claude entirely    │      │
│                           └───────────────────────────┘      │
└──────────────────────────────┬───────────────────────────────┘
                               │ (only network call)
                               ▼
                    ┌─────────────────────┐
                    │  POST /api/parse    │
                    │  Next.js API Route  │
                    │                     │
                    │  prompt + asset     │
                    │  → Claude Sonnet    │
                    │  → Zod-validated    │
                    │    RuleSet JSON     │
                    └─────────────────────┘
```

### Why Client-Side Engine

The OHLCV data for 8 assets is ~200KB. Loading it in the browser on app init is trivial. Client-side execution means:
- "Swap asset and re-run" is instant — zero network latency for computation.
- Demo feels snappy and responsive.
- Only the AI parse step (~1–2s) needs the network.
- Eliminates a server-side failure point.

The AI parser stays server-side (API route) because the Claude API key must not be exposed to the browser.

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | Next.js 14+ (App Router, TypeScript strict) | Full-stack in one repo. API route for parser. Vercel deploy. |
| **Validation** | Zod | Schema validation for AI output. Type-safe. Generates TS types. Shows code quality. |
| **Styling** | Tailwind CSS + shadcn/ui | Fast to build, consistent, dark mode trivial. |
| **Candlestick chart** | lightweight-charts v5 (TradingView) | 35KB. Professional look. Trade markers via plugins. Signals "real finance app." |
| **Analytics charts** | Recharts | Equity curves, drawdown area. Good React integration. |
| **AI parser** | Claude API (`claude-sonnet-4-20250514`) | Best structured output reliability. Fast (~1s). JSON extraction task. |
| **Engine** | Custom TypeScript, client-side | ~500 lines. Pure functions. Zero dependencies. Auditable. |
| **Indicators** | Custom TypeScript (~200 lines) | SMA, EMA, RSI, MACD, Bollinger, ATR, pct_change. 10–25 lines each. |
| **Data** | Pre-downloaded JSON, bundled in `/public/data/` | ~200KB. No runtime API. No API keys. No failures. |
| **Testing** | Vitest | Fast. TS-native. For indicator/engine/metrics unit tests. |
| **Deployment** | Vercel (free tier) | `git push` → live URL with SSL. Judges get a working link. |
| **Package manager** | pnpm | Fast, strict. |

### What We DON'T Use
- **No Python.** One language, one repo.
- **No database.** In-memory per session.
- **No WebSocket / real-time data.** Backtester, not a trading platform.
- **No external backtesting libraries.** Writing our own IS the point.

---

## 6. Data Model — Canonical RuleSet Schema

> All types enforced with **Zod** at runtime. Defined in `src/types/strategy.ts`.

### 6.1 Core Types

```typescript
import { z } from 'zod';

// ---- ENUMS ----

const AssetSymbol = z.enum(['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX']);
const Timeframe = z.literal('1D');

const ComparisonOp = z.enum([
  'lt','lte','gt','gte','eq',
  'crosses_above','crosses_below'
]);
const LogicOp = z.enum(['AND','OR']);
const Scope = z.enum(['candle','position']);
// candle = indicator evaluated on candle data
// position = evaluated relative to the current open trade (pnl_pct, bars_in_trade)

// ---- INDICATOR TYPES ----
// NOTE: dca_interval is NOT an indicator. DCA is a top-level strategy mode (see below).

const IndicatorType = z.enum([
  'price_close','price_open','price_high','price_low',
  'sma','ema',
  'rsi',
  'macd_line','macd_signal','macd_hist',
  'bb_upper','bb_middle','bb_lower',
  'atr',
  'pct_change',
  'volume',
  // Position-scope indicators (evaluated relative to the current open trade):
  'pnl_pct',        // (currentPrice - entryPrice) / entryPrice * 100
  'bars_in_trade'   // candles since entry
]);

// ---- INDICATOR SPEC ----

const IndicatorSpec = z.object({
  type: IndicatorType,
  period: z.number().int().positive().optional(),      // SMA(50), RSI(14), etc.
  fastPeriod: z.number().int().positive().optional(),   // MACD fast (default 12)
  slowPeriod: z.number().int().positive().optional(),   // MACD slow (default 26)
  signalPeriod: z.number().int().positive().optional(), // MACD signal (default 9)
  stdDev: z.number().positive().optional(),             // Bollinger (default 2)
  source: z.enum(['close','open','high','low']).optional(), // default 'close'
});

// ---- OPERAND (left or right side of a condition) ----

const Operand = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('indicator'), indicator: IndicatorSpec }),
  z.object({ kind: z.literal('number'), value: z.number() }),
]);

// ---- CONDITION ----

const Condition = z.object({
  id: z.string(),                   // unique: "entry_1", "exit_2"
  label: z.string(),                // human-readable: "RSI(14) < 30"
  scope: Scope.default('candle'),
  left: Operand,
  op: ComparisonOp,
  right: Operand,
});

// ---- CONDITION GROUP (AND/OR) ----
// conditions array may be EMPTY. Meaning:
//   - Empty entry group: no entry signals (validation error for standard mode)
//   - Empty exit group: no exit conditions (hold until end of backtest)

const ConditionGroup = z.object({
  op: LogicOp,
  conditions: z.array(Condition),   // may be empty (no .min(1))
});

// ---- POSITION SIZING ----

const PositionSizing = z.discriminatedUnion('type', [
  z.object({ type: z.literal('percent_equity'), valuePct: z.number().min(1).max(100) }),
  z.object({ type: z.literal('fixed_amount'), valueUsd: z.number().positive() }),
]);

// ---- STRATEGY MODE (discriminated union) ----
// This is the key design decision: DCA is a top-level mode, NOT an indicator.
// This keeps the schema clean, the evaluator simple, and Claude parsing reliable.

const StandardMode = z.object({
  type: z.literal('standard'),
});

const DCAMode = z.object({
  type: z.literal('dca'),
  intervalDays: z.number().int().positive(),  // e.g. 7 = buy every 7 candles
  amountUsd: z.number().positive(),           // e.g. 100 = $100 per buy
});

const StrategyMode = z.discriminatedUnion('type', [StandardMode, DCAMode]);

// ---- STRATEGY RULESET ----

const StrategyRuleSet = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mode: StrategyMode,
  // For standard mode: entry/exit are used. For DCA mode: both are ignored.
  entry: ConditionGroup,
  exit: ConditionGroup,
  sizing: PositionSizing.default({ type: 'percent_equity', valuePct: 100 }),
  // sizing is only used for standard mode. DCA mode uses mode.amountUsd.
  metadata: z.object({
    originalPrompt: z.string().optional(),
    parserConfidence: z.enum(['low','medium','high']).optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    warnings: z.array(z.string()).default([]),
  }).optional(),
});

// ---- VALIDATION INVARIANTS (enforced after Zod parse) ----
//
// If mode.type === 'dca':
//   - entry.conditions MUST be empty (DCA doesn't use signal-based entry)
//   - exit.conditions MUST be empty (DCA holds until end)
//   - sizing is ignored (mode.amountUsd is used instead)
//
// If mode.type === 'standard':
//   - entry.conditions MUST be non-empty (at least 1 entry signal)
//   - exit.conditions MAY be empty (hold-until-end is valid but triggers a warning)
//   - sizing is used for position sizing
//
// These invariants are checked in a post-Zod validation function:
//   validateRuleSetInvariants(ruleSet: StrategyRuleSet): { valid: boolean, errors: string[] }

// Export inferred types
type StrategyRuleSet = z.infer<typeof StrategyRuleSet>;
type Condition = z.infer<typeof Condition>;
type ConditionGroup = z.infer<typeof ConditionGroup>;
type StrategyMode = z.infer<typeof StrategyMode>;
// ... etc.
```

### 6.2 Why This Schema (Design Decisions)

**Operand abstraction (`left`/`right`).** Every condition is `left op right` where each side is either an indicator or a number. This is more expressive and uniform than separate `value` vs `compareIndicator` fields. One evaluation path for everything.

**Position-scope indicators (`pnl_pct`, `bars_in_trade`).** Take-profit and stop-loss are NOT special types — they are regular conditions with `scope: 'position'`. "Exit when profit >= 15%" becomes:
```json
{
  "scope": "position",
  "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } },
  "op": "gte",
  "right": { "kind": "number", "value": 15 }
}
```
No special-casing. Same evaluator. Cleaner code.

**DCA as a top-level mode, NOT an indicator.** DCA is structurally different from signal-based strategies: it buys at fixed intervals regardless of market conditions, uses fixed dollar amounts instead of percent-of-equity, and never exits. Modeling it as a fake indicator (`dca_interval > 0`) would force the AI to output an artificial condition and complicate the evaluator with special-case detection. A top-level `mode` discriminator is:
- **Cleaner for the schema:** `mode: { type: "dca", intervalDays: 7, amountUsd: 100 }` is self-documenting.
- **More reliable for Claude parsing:** The AI outputs a clear mode field instead of constructing a fake condition.
- **Simpler for the engine:** A single `if (mode.type === 'dca')` branch, no scanning entry conditions for magic indicator types.
- **Safer with validation invariants:** DCA mode enforces empty entry/exit conditions at validation time, preventing hybrid states that the engine can't handle.

**ConditionGroup allows empty conditions.** `conditions: z.array(Condition)` without `.min(1)`. Empty exit group means "hold until end of backtest" (common and valid). Empty entry group is invalid for standard mode but valid for DCA mode (where entry/exit are ignored). The invariant validation function enforces the right rules per mode.

**Why NOT `between`.** `between` adds a third operand pattern (`low`/`high` instead of `left`/`right`), which means the evaluator needs a branch, Zod needs a union, and Claude needs another pattern. For MVP, "RSI between 40 and 60" is expressed as two AND conditions (`RSI > 40 AND RSI < 60`), which the parser already handles well. Adding `between` is a v2 feature.

**Zod + post-validation invariants.** Zod handles structural validation (correct types, required fields). The post-Zod function `validateRuleSetInvariants()` handles semantic validation (DCA mode can't have entry signals, standard mode needs at least one entry). This two-layer approach is clean and testable.

### 6.3 Backtest Config & Results

```typescript
const BacktestConfig = z.object({
  asset: AssetSymbol,
  timeframe: Timeframe,
  startDate: z.string(),              // ISO date
  endDate: z.string(),                // ISO date
  initialCapital: z.number().positive().default(10000),
  feeBps: z.number().min(0).default(10),      // 10 bps = 0.1%
  slippageBps: z.number().min(0).default(5),  // 5 bps = 0.05%
  rules: StrategyRuleSet,
});

// ---- RESULTS ----

interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  benchmark: BenchmarkResult;
  indicatorData: Record<string, (number | null)[]>;
  audit: AuditInfo;
}

// ---- BENCHMARK (explicit spec — prevents "massaged numbers" suspicion) ----

interface BenchmarkResult {
  totalReturn: number;
  equityCurve: EquityPoint[];  // same length as strategy equity curve
  description: string;         // "Buy & Hold: entered at first tradable candle open, same fees"
}

// BENCHMARK DEFINITION:
// - Entry: buy at the OPEN of the first tradable candle (after warmup), using 100% of initial capital.
// - Same fee and slippage as the strategy (feeBps + slippageBps applied to entry).
// - Hold until end: value at each candle = units * close[i].
// - Exit: at last candle's close. Same fee and slippage applied to exit.
// - This means: if the strategy uses 10bps fee + 5bps slippage, the benchmark does too.
//   A judge can verify the benchmark isn't "easier" than the strategy.

interface Trade {
  id: number;
  entryDate: string;
  entryPrice: number;         // after slippage
  exitDate: string;
  exitPrice: number;          // after slippage
  pnlAbs: number;             // absolute P&L in $
  pnlPct: number;             // percentage P&L
  holdingDays: number;
  exitReason: string;         // human-readable: "pnl_pct >= 15 (take profit)" or "RSI > 70"
  positionSize: number;       // $ invested
}

interface EquityPoint {
  date: string;
  equity: number;
  benchmarkEquity: number;    // buy-and-hold equity at same date
  drawdownPct: number;        // current drawdown from peak (negative %)
}

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;   // CAGR
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;        // negative %
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

// ---- AUDIT INFO (credibility differentiator) ----

interface AuditInfo {
  executionModel: string;       // "Signal on candle[i] close, execute at candle[i+1] open"
  feeBps: number;
  slippageBps: number;
  warmupCandles: number;
  dataRange: string;            // "2020-01-01 to 2025-12-31"
  totalCandles: number;
  tradableCandles: number;      // total - warmup
  annualizationFactor: number;  // 365 for crypto
  riskFreeRate: number;         // 0
  benchmarkModel: string;       // "Buy at first tradable candle open, same fees/slippage, hold to end"
  positionModel: string;        // "Long-only, single position" or "DCA additive"
}
```

### 6.4 App State

```typescript
type AppPhase =
  | 'input'        // user typing / selecting config
  | 'parsing'      // waiting for Claude
  | 'confirming'   // reviewing parsed rules
  | 'running'      // engine computing (brief animation, <100ms real)
  | 'results'      // single strategy displayed
  | 'comparing';   // two strategies side-by-side

interface AppState {
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
  results: [BacktestResult | null, BacktestResult | null]; // [primary, comparison]
  runHistory: RunSnapshot[];
  error: string | null;
}

interface RunSnapshot {
  id: string;
  timestamp: number;
  prompt: string;
  asset: string;
  metricsPreview: { totalReturn: number; sharpeRatio: number; winRate: number; totalTrades: number };
  fullResult: BacktestResult;
}
```

---

## 7. AI Parser — `/api/parse`

### 7.1 API Contract

```typescript
// Request
POST /api/parse
{
  prompt: string;     // user's natural language
  asset: string;      // selected asset (passed through — AI doesn't pick the asset)
  timeframe: '1D';    // locked for MVP
}

// Response (success)
{
  success: true;
  ruleSet: StrategyRuleSet;  // Zod-validated + invariant-checked
}

// Response (failure)
{
  success: false;
  error: string;
  suggestions: string[];  // example prompts
}
```

### 7.2 System Prompt (Complete — Copy-Paste Ready)

```
You are a strict compiler that converts user trading strategy descriptions
into RuleSet JSON. You respond with ONLY valid JSON. No markdown. No code
fences. No explanation. No preamble. No trailing text.

Your output must conform EXACTLY to this schema:

{
  "id": "string (generate a unique short ID like 'vt_abc123')",
  "name": "string (short descriptive name)",
  "description": "string (1-2 sentence plain English summary)",
  "mode": { "type": "standard" } OR { "type": "dca", "intervalDays": N, "amountUsd": N },
  "entry": {
    "op": "AND" or "OR",
    "conditions": [ ...Condition objects... ]
  },
  "exit": {
    "op": "AND" or "OR" (usually OR for exits),
    "conditions": [ ...Condition objects... ]
  },
  "sizing": { "type": "percent_equity", "valuePct": N } or { "type": "fixed_amount", "valueUsd": N },
  "metadata": {
    "originalPrompt": "the user's original input text",
    "parserConfidence": "low" | "medium" | "high",
    "confidenceScore": 0.0-1.0,
    "warnings": ["string array of ambiguities or assumptions"]
  }
}

CRITICAL RULES FOR MODE:
- If the user describes a DCA/dollar-cost-averaging strategy:
  Set mode to { "type": "dca", "intervalDays": N, "amountUsd": N }.
  Set entry.conditions to [] (empty array).
  Set exit.conditions to [] (empty array).
  Set sizing to { "type": "fixed_amount", "valueUsd": same as mode.amountUsd }.
- For ALL other strategies:
  Set mode to { "type": "standard" }.
  entry.conditions MUST have at least 1 condition.
  exit.conditions may be empty (but add a warning if so).

CONDITION SCHEMA:
{
  "id": "string (unique like 'entry_1', 'exit_2')",
  "label": "string (human-readable like 'RSI(14) < 30')",
  "scope": "candle" (default) or "position",
  "left": { "kind": "indicator", "indicator": { "type": "...", ...params } } or { "kind": "number", "value": N },
  "op": "lt" | "lte" | "gt" | "gte" | "eq" | "crosses_above" | "crosses_below",
  "right": { "kind": "indicator", "indicator": { "type": "...", ...params } } or { "kind": "number", "value": N }
}

AVAILABLE INDICATOR TYPES:
- price_close, price_open, price_high, price_low (raw OHLC)
- sma (params: period) — Simple Moving Average
- ema (params: period) — Exponential Moving Average
- rsi (params: period, default 14) — Relative Strength Index
- macd_line (params: fastPeriod=12, slowPeriod=26, signalPeriod=9)
- macd_signal (same params as macd_line)
- macd_hist (same params as macd_line)
- bb_upper, bb_middle, bb_lower (params: period=20, stdDev=2) — Bollinger Bands
- atr (params: period) — Average True Range
- pct_change (params: period) — % change over N candles
- volume
- pnl_pct (scope: "position") — current trade P&L as percentage
- bars_in_trade (scope: "position") — candles since entry

TAKE-PROFIT / STOP-LOSS: Express as position-scope conditions:
  - Take profit 15%: { "scope": "position", "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } }, "op": "gte", "right": { "kind": "number", "value": 15 } }
  - Stop loss 5%: { "scope": "position", "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } }, "op": "lte", "right": { "kind": "number", "value": -5 } }

DEFAULTS (when user doesn't specify):
- RSI period: 14
- "moving average" without type: SMA
- MACD: fast=12, slow=26, signal=9
- Bollinger: period=20, stdDev=2
- Position sizing: { "type": "percent_equity", "valuePct": 100 }
- Entry logic: AND. Exit logic: OR.
- "buy the dip" with no %: pct_change(7) < -5, add warning.
- No exit conditions specified (non-DCA): add warning "No exit conditions. Positions held until end."

CONFIDENCE GUIDE:
- "high" (0.85-1.0): Unambiguous, maps directly to known indicators
- "medium" (0.5-0.85): Minor assumptions (default periods, inferred types)
- "low" (0.0-0.5): Significant ambiguity or not a trading strategy

UNSUPPORTED FEATURES — if the user mentions any of these:
- Shorting / short-selling → ignore, add warning: "Short selling is not supported. Strategy uses long-only positions."
- Intraday / hourly / minute timeframes → ignore, add warning: "Only daily timeframe is supported."
- Trailing stop → approximate as a fixed stop-loss with a warning: "Trailing stop is not supported. Using fixed stop-loss of X% instead."
- Multiple simultaneous positions → ignore, add warning: "Only one position at a time is supported."
- Specific order types (limit, market, stop-limit) → ignore, all orders execute at next open.
- Portfolio / multiple assets at once → ignore, add warning: "Single-asset backtesting only."
In ALL cases: output the BEST-EFFORT strategy within MVP constraints, and list every dropped/approximated feature in metadata.warnings. Never refuse to output a RuleSet — always try.

If the input is NOT a trading strategy: return confidenceScore: 0, parserConfidence: "low",
empty conditions arrays, mode: { "type": "standard" }, and a warning explaining the issue.
```

### 7.3 Few-Shot Examples (Appended to System Prompt)

```
USER: "Buy when RSI is below 30, sell when RSI goes above 70"
OUTPUT:
{
  "id": "vt_rsi_mr",
  "name": "RSI Mean Reversion",
  "description": "Buy when RSI indicates oversold, sell when overbought",
  "mode": { "type": "standard" },
  "entry": {
    "op": "AND",
    "conditions": [{
      "id": "entry_1", "label": "RSI(14) < 30", "scope": "candle",
      "left": { "kind": "indicator", "indicator": { "type": "rsi", "period": 14 } },
      "op": "lt",
      "right": { "kind": "number", "value": 30 }
    }]
  },
  "exit": {
    "op": "OR",
    "conditions": [{
      "id": "exit_1", "label": "RSI(14) > 70", "scope": "candle",
      "left": { "kind": "indicator", "indicator": { "type": "rsi", "period": 14 } },
      "op": "gt",
      "right": { "kind": "number", "value": 70 }
    }]
  },
  "sizing": { "type": "percent_equity", "valuePct": 100 },
  "metadata": { "originalPrompt": "Buy when RSI is below 30, sell when RSI goes above 70", "parserConfidence": "high", "confidenceScore": 0.95, "warnings": [] }
}

USER: "Buy when 50-day moving average crosses above 200-day moving average, sell on the opposite crossover"
OUTPUT:
{
  "id": "vt_golden_cross",
  "name": "Golden Cross / Death Cross",
  "description": "Enter on golden cross (50 SMA above 200 SMA), exit on death cross",
  "mode": { "type": "standard" },
  "entry": {
    "op": "AND",
    "conditions": [{
      "id": "entry_1", "label": "SMA(50) crosses above SMA(200)", "scope": "candle",
      "left": { "kind": "indicator", "indicator": { "type": "sma", "period": 50 } },
      "op": "crosses_above",
      "right": { "kind": "indicator", "indicator": { "type": "sma", "period": 200 } }
    }]
  },
  "exit": {
    "op": "OR",
    "conditions": [{
      "id": "exit_1", "label": "SMA(50) crosses below SMA(200)", "scope": "candle",
      "left": { "kind": "indicator", "indicator": { "type": "sma", "period": 50 } },
      "op": "crosses_below",
      "right": { "kind": "indicator", "indicator": { "type": "sma", "period": 200 } }
    }]
  },
  "sizing": { "type": "percent_equity", "valuePct": 100 },
  "metadata": { "originalPrompt": "...", "parserConfidence": "high", "confidenceScore": 0.95, "warnings": [] }
}

USER: "Buy ETH when it drops 10% in a week. Sell after 20% gain or 5% loss."
OUTPUT:
{
  "id": "vt_dip_tpsl",
  "name": "Dip Buyer with TP/SL",
  "description": "Buy after 10% weekly decline, exit at 20% profit or 5% loss",
  "mode": { "type": "standard" },
  "entry": {
    "op": "AND",
    "conditions": [{
      "id": "entry_1", "label": "7-day change < -10%", "scope": "candle",
      "left": { "kind": "indicator", "indicator": { "type": "pct_change", "period": 7 } },
      "op": "lt",
      "right": { "kind": "number", "value": -10 }
    }]
  },
  "exit": {
    "op": "OR",
    "conditions": [
      {
        "id": "exit_1", "label": "Take profit at 20%", "scope": "position",
        "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } },
        "op": "gte",
        "right": { "kind": "number", "value": 20 }
      },
      {
        "id": "exit_2", "label": "Stop loss at 5%", "scope": "position",
        "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } },
        "op": "lte",
        "right": { "kind": "number", "value": -5 }
      }
    ]
  },
  "sizing": { "type": "percent_equity", "valuePct": 100 },
  "metadata": { "originalPrompt": "...", "parserConfidence": "high", "confidenceScore": 0.9, "warnings": ["Asset 'ETH' detected — use the asset selector to choose ETH"] }
}

USER: "DCA $100 into BTC every week"
OUTPUT:
{
  "id": "vt_dca_weekly",
  "name": "Weekly DCA",
  "description": "Invest $100 every 7 days regardless of price",
  "mode": { "type": "dca", "intervalDays": 7, "amountUsd": 100 },
  "entry": { "op": "AND", "conditions": [] },
  "exit": { "op": "OR", "conditions": [] },
  "sizing": { "type": "fixed_amount", "valueUsd": 100 },
  "metadata": { "originalPrompt": "...", "parserConfidence": "high", "confidenceScore": 0.85, "warnings": ["DCA mode: buys every 7 days, holds until end of backtest period"] }
}

USER: "Buy when MACD crosses above signal line and RSI is below 50. Sell at 15% profit or 8% loss."
OUTPUT:
{
  "id": "vt_macd_rsi",
  "name": "MACD + RSI Confirmation with TP/SL",
  "description": "Enter on MACD bullish crossover confirmed by RSI below 50, exit at TP or SL",
  "mode": { "type": "standard" },
  "entry": {
    "op": "AND",
    "conditions": [
      {
        "id": "entry_1", "label": "MACD crosses above signal", "scope": "candle",
        "left": { "kind": "indicator", "indicator": { "type": "macd_line", "fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9 } },
        "op": "crosses_above",
        "right": { "kind": "indicator", "indicator": { "type": "macd_signal", "fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9 } }
      },
      {
        "id": "entry_2", "label": "RSI(14) < 50", "scope": "candle",
        "left": { "kind": "indicator", "indicator": { "type": "rsi", "period": 14 } },
        "op": "lt",
        "right": { "kind": "number", "value": 50 }
      }
    ]
  },
  "exit": {
    "op": "OR",
    "conditions": [
      {
        "id": "exit_1", "label": "Take profit at 15%", "scope": "position",
        "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } },
        "op": "gte",
        "right": { "kind": "number", "value": 15 }
      },
      {
        "id": "exit_2", "label": "Stop loss at 8%", "scope": "position",
        "left": { "kind": "indicator", "indicator": { "type": "pnl_pct" } },
        "op": "lte",
        "right": { "kind": "number", "value": -8 }
      }
    ]
  },
  "sizing": { "type": "percent_equity", "valuePct": 100 },
  "metadata": { "originalPrompt": "...", "parserConfidence": "high", "confidenceScore": 0.92, "warnings": [] }
}
```

### 7.4 Validation Pipeline

```
Claude JSON response
  │
  ▼
Strip markdown fences if present
  │
  ▼
JSON.parse()  ──fail──►  retry once with correction prompt
  │                                │
  ▼                              fail──► return error + suggestions
Zod StrategyRuleSet.safeParse()
  │                                │
  ▼                              fail──► retry once
validateRuleSetInvariants()              │
  │                              fail──► return error + suggestions
  ▼
confidenceScore check
  │
  ├─ < 0.3 ──► return error: "Couldn't parse. Try: [suggestions]"
  ├─ 0.3–0.6 ──► return rules WITH prominent warnings
  └─ > 0.6 ──► return rules normally
```

**`validateRuleSetInvariants()` function:**
```typescript
function validateRuleSetInvariants(rules: StrategyRuleSet): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rules.mode.type === 'dca') {
    if (rules.entry.conditions.length > 0) {
      errors.push('DCA mode must have empty entry conditions');
    }
    if (rules.exit.conditions.length > 0) {
      errors.push('DCA mode must have empty exit conditions');
    }
  }

  if (rules.mode.type === 'standard') {
    if (rules.entry.conditions.length === 0) {
      errors.push('Standard mode requires at least one entry condition');
    }
    // Empty exit is allowed (hold until end) but the parser should have added a warning
  }

  // Validate all indicators are real
  for (const condition of [...rules.entry.conditions, ...rules.exit.conditions]) {
    // check left/right operands have valid indicator types
    // check scope: 'position' only used with pnl_pct or bars_in_trade
    // check crosses_above/crosses_below have indicator on both sides
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 8. Indicators & Condition Evaluation

### 8.1 Indicator Computations (`src/indicators/`)

All pure functions. Same-length output arrays aligned with input candles. `null` for warmup.

```typescript
function sma(values: number[], period: number): (number | null)[]
function ema(values: number[], period: number): (number | null)[]
function rsi(closes: number[], period: number): (number | null)[]
// RSI uses Wilder smoothing (not simple average for subsequent values)
function macd(closes: number[], fast?: number, slow?: number, signal?: number):
  { line: (number|null)[], signal: (number|null)[], histogram: (number|null)[] }
function bollingerBands(closes: number[], period?: number, stdDev?: number):
  { upper: (number|null)[], middle: (number|null)[], lower: (number|null)[] }
function atr(candles: Candle[], period: number): (number | null)[]
function pctChange(values: number[], period: number): (number | null)[]
```

~200 lines total. Every function unit-tested against reference values (Investopedia, TradingView).

### 8.2 Cross Detection

```
crosses_above(A, B) at index i:
  A[i-1] <= B[i-1]  AND  A[i] > B[i]

crosses_below(A, B) at index i:
  A[i-1] >= B[i-1]  AND  A[i] < B[i]
```

Requires `i >= 1` (cannot detect cross on first candle).

### 8.3 Position-Scope Indicators

Evaluated only when a position is open. The evaluator receives the current entry price:

- `pnl_pct` at index `i` = `(close[i] - entryPrice) / entryPrice * 100`
- `bars_in_trade` = `i - entryIndex`

### 8.4 Condition Evaluator (`src/engine/evaluator.ts`)

Single function that evaluates any `Condition` at a given candle index:

```typescript
function evaluateCondition(
  condition: Condition,
  indicatorCache: IndicatorCache,  // pre-computed indicator arrays
  index: number,
  position: OpenPosition | null     // for position-scope conditions
): boolean
```

1. Resolve `left` operand → number (indicator value at index, or literal).
2. Resolve `right` operand → number.
3. Apply operator (`lt`, `gte`, `crosses_above`, etc.).
4. For `crosses_above`/`crosses_below`: also resolve both sides at `index - 1`.

`ConditionGroup` evaluation:
- `AND` → `conditions.every(c => evaluateCondition(c, ...))`
- `OR` → `conditions.some(c => evaluateCondition(c, ...))`
- **Empty conditions:** AND over empty = `true`, OR over empty = `false`. (Standard JS semantics for `every`/`some` on empty arrays.) This means empty entry (AND) always fires and empty exit (OR) never fires — but this case is prevented by invariant validation for standard mode. For DCA mode, entry/exit groups are not evaluated at all.

---

## 9. Backtest Engine (`src/engine/`)

~400–500 lines. Runs client-side. Pure function — no side effects, no state mutation.

### 9.1 Execution Model (Anti-Lookahead) — Unambiguous Rules

This is the section a skeptical engineer-judge will challenge first. Every rule is explicit:

1. **Signal evaluation time:** All indicators and conditions are evaluated using data available at the **close** of candle `i`. No future data is ever used.
2. **Order execution time:** If a signal fires at candle `i`, the order executes at the **open** of candle `i+1`, adjusted for slippage. This simulates "you see today's close, you place an order, it fills at tomorrow's open."
3. **No same-bar execution:** A signal at candle `i` NEVER executes at candle `i`'s close or any earlier price. The minimum delay is 1 candle.
4. **Last candle rule:** If a signal fires at the final candle in the date range (`i+1` doesn't exist), the signal is **ignored** — no trade is fabricated.
5. **Forced exit at end of data:** If a position is still open after the last candle is processed, it is force-closed at the **last candle's close**, with fee and slippage applied. This prevents unrealized P&L from being hidden.
6. **Entry/exit conflict on same bar:** If both entry and exit conditions evaluate to `true` on the same candle `i` while NOT in a position, **entry takes priority** (enter at `open[i+1]`). The exit conditions will be checked on subsequent candles. Rationale: you can't exit a position you don't have yet.
7. **Re-entry after exit:** After an exit executes at `open[i+1]`, a new entry signal can fire as early as candle `i+1` (evaluated at its close), executing at `open[i+2]`. There is no mandatory cooldown between trades.
8. **Position-scope conditions timing:** `pnl_pct` and `bars_in_trade` are evaluated at candle `i`'s close (using `close[i]`), not at the execution price of `open[i+1]`. This means the actual exit P&L may differ slightly from the trigger threshold due to overnight price movement + slippage.

### 9.2 Warmup

- **Standard mode:** Determined automatically as `max(all indicator periods used in entry + exit conditions)`. No signals evaluated, no trades allowed during warmup. The first tradable candle is `candles[warmup]`.
- **DCA mode:** No warmup needed (no indicators). First buy at candle index 0 (start of date range).
- If warmup ≥ date range length: return empty results with warning: "Warmup period (N candles) exceeds the selected date range."

### 9.3 Fees & Slippage — Exact Formulas

Configurable via UI. Defaults: `feeBps = 10` (0.1%), `slippageBps = 5` (0.05%).

**Unit conversion:**
```
slippagePct = slippageBps / 10_000   // 5 bps → 0.0005
feePct      = feeBps / 10_000        // 10 bps → 0.001
```

**Fill price calculation (buys):**
```
fillPrice = open[i+1] * (1 + slippagePct)
// Slippage is adverse: you pay MORE than the open when buying.
```

**Fill price calculation (sells):**
```
fillPrice = open[i+1] * (1 - slippagePct)
// Slippage is adverse: you receive LESS than the open when selling.
```

**Fee calculation (applied on notional value, both entry and exit):**
```
fee = fillPrice * positionSizeInUnits * feePct
// Fee is deducted from available equity (entry) or from proceeds (exit).
```

**Net entry cost:** `fillPrice * units + fee`
**Net exit proceeds:** `fillPrice * units - fee`

**Example:** Buy $10,000 of BTC at open $50,000, with 5 bps slippage and 10 bps fee:
```
fillPrice = 50000 * 1.0005 = $50,025.00
units     = 10000 / 50025  = 0.19990 BTC
fee       = 50025 * 0.19990 * 0.001 = $10.00
netCost   = $10,010.00
```

### 9.4 Benchmark (Buy & Hold) — Explicit Definition

The benchmark uses **identical assumptions** as the strategy to prevent "massaged numbers":

1. **Entry:** Buy at the OPEN of the first tradable candle (first candle after warmup). Invest 100% of initial capital.
2. **Fees/slippage:** Same `feeBps` and `slippageBps` as the strategy, applied at entry.
3. **Hold:** Value at each candle = `units * close[i]`.
4. **Exit:** At last candle's close. Same fee and slippage applied.
5. **Equity curve:** Computed at every candle, stored in `EquityPoint.benchmarkEquity` for easy overlay charting.

This is documented in the `AuditInfo.benchmarkModel` field and displayed in the Audit Panel.

### 9.5 Position Model

**Standard mode (`mode.type === 'standard'`):**
- Long-only, single position at a time.
- Entry: invest `sizing.valuePct%` of current equity.
- If already in position, no new entry (skip signal).

**DCA mode (`mode.type === 'dca'`):**
- Additive position tracking: each buy adds units at the current price.
- Buy every `mode.intervalDays` candles, starting from the first candle in the date range.
- Track `totalUnitsHeld`, `totalInvested`, and `remainingCash = initialCapital - totalInvested`.
- Equity at candle `i` = `totalUnitsHeld * close[i] + remainingCash`.
- No exit conditions. All units held until end of backtest.
- Entry/exit ConditionGroups are **not evaluated** in DCA mode.

**DCA cash constraint + fee handling (must be specified to avoid "magical" results):**
```
On each DCA buy candle:
  requiredCash = mode.amountUsd
  fee          = requiredCash * feePct
  totalCost    = requiredCash + fee

  if remainingCash >= totalCost:
    fillPrice = close[i] * (1 + slippagePct)   // adverse slippage
    units     = requiredCash / fillPrice
    totalUnitsHeld += units
    totalInvested  += totalCost                 // includes fee
    remainingCash  -= totalCost
    record Trade

  else if remainingCash > fee:
    // Partial buy: invest whatever cash remains (minus fee)
    availableForPurchase = remainingCash - fee
    fillPrice = close[i] * (1 + slippagePct)
    units     = availableForPurchase / fillPrice
    totalUnitsHeld += units
    totalInvested  += remainingCash             // all remaining cash used
    remainingCash   = 0
    record Trade (with actual amount, not mode.amountUsd)

  else:
    // No cash left — skip this buy, do nothing
    // (DCA is "done" for the rest of the backtest)
```

**DCA uses `close[i]` not `open[i+1]`:** Unlike standard mode, DCA buys execute at the current candle's close (not next open). Rationale: DCA is a periodic purchase, not a signal-based trade. Using `close[i]` is simpler and avoids the edge case where the last DCA buy can't execute because `i+1` doesn't exist.

**Mode detection is explicit:** `if (config.rules.mode.type === 'dca')` — no scanning entry conditions for magic indicator types.

### 9.6 Engine Pseudocode

```
function runBacktest(config, candles):
  // 1. Filter candles to [startDate, endDate]
  // 2. Determine mode

  if mode.type === 'dca':
    return runDCABacktest(config, candles)
  else:
    return runStandardBacktest(config, candles)


function runStandardBacktest(config, candles):
  // 1. Pre-compute ALL indicators for entry + exit conditions
  // 2. Determine warmup = max(all indicator periods)

  let capital = config.initialCapital
  let position: OpenPosition | null = null
  let trades: Trade[] = []
  let equityCurve: EquityPoint[] = []
  let peakEquity = capital

  // 3. Compute benchmark (buy & hold with same fees)
  const benchmark = computeBenchmark(candles, warmup, config)

  for i = warmup to candles.length - 1:
    if position === null:
      if evaluateGroup(entry, cache, i, null) AND i+1 < candles.length:
        ENTER at open[i+1] with slippage + fees
    else:
      if evaluateGroup(exit, cache, i, position) AND i+1 < candles.length:
        EXIT at open[i+1] with slippage + fees
        record Trade

    // Mark-to-market equity
    equity = position ? capital + unrealizedPnL : capital
    drawdownPct = (equity - peakEquity) / peakEquity * 100
    if equity > peakEquity: peakEquity = equity
    equityCurve.push({ date, equity, benchmarkEquity: benchmark.curve[i], drawdownPct })

  // Force-close open position at last candle close (with fees)
  // Compute metrics from trades + equityCurve
  // Build AuditInfo
  return { config, trades, equityCurve, metrics, benchmark, indicatorData, audit }


function runDCABacktest(config, candles):
  let remainingCash = config.initialCapital
  let totalUnits = 0
  let totalInvested = 0
  const intervalDays = config.rules.mode.intervalDays
  const amountUsd = config.rules.mode.amountUsd
  const slippagePct = config.slippageBps / 10_000
  const feePct = config.feeBps / 10_000

  // Benchmark: same entry timing (candle 0), same fees
  const benchmark = computeBenchmark(candles, 0, config)

  for i = 0 to candles.length - 1:
    if i % intervalDays === 0:
      fee = amountUsd * feePct
      totalCost = amountUsd + fee

      if remainingCash >= totalCost:
        // Full buy
        fillPrice = candles[i].close * (1 + slippagePct)
        units = amountUsd / fillPrice
        totalUnits += units
        totalInvested += totalCost
        remainingCash -= totalCost
        record Trade

      else if remainingCash > fee:
        // Partial buy (last available cash)
        available = remainingCash - fee
        fillPrice = candles[i].close * (1 + slippagePct)
        units = available / fillPrice
        totalUnits += units
        totalInvested += remainingCash
        remainingCash = 0
        record Trade (with actual amount)

      // else: no cash left, skip

    equity = totalUnits * candles[i].close + remainingCash
    equityCurve.push({ date, equity, benchmarkEquity, drawdownPct })

  // Compute metrics
  return { config, trades, equityCurve, metrics, benchmark, indicatorData, audit }
```

---

## 10. Metrics Spec (`src/metrics/`)

### 10.1 Return Series (Foundation for All Metrics)

All ratio-based metrics (Sharpe, Sortino) are computed from a **daily return series** derived from the equity curve:

```
dailyReturns[i] = (equityCurve[i].equity - equityCurve[i-1].equity) / equityCurve[i-1].equity
```

- Sampling frequency: **daily** (one data point per candle, since timeframe is 1D).
- Series length: total tradable candles (after warmup, within date range).
- Returns are computed for ALL days, including days not in a position (return = 0 on those days, which correctly penalizes low exposure in Sharpe).

### 10.2 Metrics Glossary (Exact Formulas)

| Metric | Formula | Edge Cases & Notes |
|---|---|---|
| **Total Return (%)** | `(finalEquity - initialCapital) / initialCapital × 100` | Can be negative. |
| **CAGR (%)** | `(finalEquity / initialCapital) ^ (365 / totalDays) - 1` | `totalDays` = calendar days from first to last candle in range. Returns annualized growth rate. |
| **Sharpe Ratio** | `mean(dailyReturns) / stdev(dailyReturns) × √365` | Risk-free rate = 0. Annualization factor = √365 (crypto trades every day). If stdev = 0 (no variance), Sharpe = 0. Uses population stdev. |
| **Sortino Ratio** | `mean(dailyReturns) / downsideDeviation × √365` | `downsideDeviation = sqrt(mean(min(dailyReturn, 0)²))` — only negative returns contribute. If no negative returns, Sortino = ∞ (display as "∞" or a large cap like 99.9). |
| **Max Drawdown (%)** | `min(drawdownPct[i] for all i)` where `drawdownPct[i] = (equity[i] - peakEquity) / peakEquity × 100` | Continuous peak-to-trough on equity curve. Reported as a negative number (e.g. -22%). Peak is the running maximum of equity. |
| **Max DD Duration (days)** | Longest consecutive streak where `equity[i] < peakEquity` | Measured in calendar days (candle count since timeframe is 1D). If equity never drops below peak, duration = 0. |
| **Win Rate (%)** | `winningTrades / totalTrades × 100` | A trade is a **win** if `pnlPct > 0`. A trade is a **loss** if `pnlPct < 0`. Breakeven trades (`pnlPct === 0`) count as **wins** (convention: you didn't lose money). If 0 trades, display "N/A". |
| **Profit Factor** | `sum(pnlAbs where pnlAbs > 0) / abs(sum(pnlAbs where pnlAbs < 0))` | If no losing trades, display "∞". If no winning trades, display 0. If 0 trades, display "N/A". |
| **Avg Win (%)** | `mean(pnlPct for trades where pnlPct > 0)` | "N/A" if no winning trades. |
| **Avg Loss (%)** | `mean(pnlPct for trades where pnlPct < 0)` | Reported as negative number. "N/A" if no losing trades. |
| **Best Trade (%)** | `max(pnlPct across all trades)` | |
| **Worst Trade (%)** | `min(pnlPct across all trades)` | |
| **Avg Holding Period (days)** | `mean(holdingDays for all trades)` | |
| **Exposure Time (%)** | `sum(holdingDays for all trades) / totalTradableDays × 100` | Counts only days where a position is open. |
| **Total Trades** | `trades.length` | |

### 10.3 Audit Panel (Displayed in UI)

This is a **credibility differentiator**. Most amateur backtesters hide their assumptions. We display them proudly:

- Execution model: "Signal on candle[i] close → execute at candle[i+1] open"
- Fee: X bps per trade (entry + exit)
- Slippage: X bps per trade (entry + exit)
- Warmup: N candles skipped
- Data range: YYYY-MM-DD to YYYY-MM-DD (N candles)
- Annualization: √365 (crypto markets trade daily)
- Risk-free rate: 0%
- **Benchmark model: "Buy at first tradable candle open, same fees/slippage, hold to end close"**
- Position model: "Long-only, single position" or "DCA additive"
- Breakeven convention: counted as win

---

## 11. Data Pipeline

### 11.1 Pre-work (before Feb 20)

1. Download daily OHLCV for 8 assets: `BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX`
   - **Source:** Binance public API (`GET /api/v3/klines`) — no key needed.
   - **Fallback:** CryptoDataDownload.com CSVs.
   - **Range:** 2020-01-01 to latest available.

2. Write `scripts/fetch-data.ts` — converts to JSON:
   ```json
   [
     { "t": "2020-01-01", "o": 7200.17, "h": 7254.33, "l": 7174.94, "c": 7200.17, "v": 18403.4 },
     ...
   ]
   ```
   Compact key names (`t/o/h/l/c/v`) to minimize file size.

3. Store in `/public/data/BTC_1D.json`, `/public/data/ETH_1D.json`, etc.

4. **Commit to repo.** Deterministic runs — anyone cloning gets the same data.

Total: ~200KB for 8 assets. Loads in browser in <100ms.

### 11.2 Data Provenance & Reproducibility

**Source:** Binance Spot OHLCV via public REST API (`GET /api/v3/klines`). No API key required.
**Pairs:** `{ASSET}USDT` (BTC/USDT, ETH/USDT, etc.).
**Interval:** `1d` (daily candles).
**Timezone:** All timestamps are **UTC 00:00** (Binance daily candle open time). Dates stored as `YYYY-MM-DD` strings. No timezone conversion needed at runtime.
**Price precision:** Floats as returned by API. Rounded to 2 decimal places for display only; full precision kept in computation.

**How to regenerate data (documented in `scripts/README.md`):**
```bash
# Fetch all 8 assets from Binance public API:
pnpm ts-node scripts/fetch-data.ts

# This script:
# 1. Hits GET /api/v3/klines for each asset
# 2. Converts response to [{ t, o, h, l, c, v }] JSON
# 3. Writes to /public/data/{ASSET}_1D.json
# 4. Logs: asset, candle count, date range, file size
```

**Disclaimer (displayed in app footer and README):**
> Historical data is provided for educational and backtesting purposes only. Past performance does not indicate future results. This is not financial advice.

---

## 12. Demo Mode (Must-Have)

Demo Mode means **pre-built RuleSet JSON that skips the AI call entirely.** This guarantees the demo works even if Claude is down, slow, or returns garbage.

### 12.1 Preset Strategies (stored in `src/data/presets.ts`)

| # | Name | Prompt (displayed) | Pre-built RuleSet | Why Included |
|---|---|---|---|---|
| 1 | RSI Mean Reversion | "Buy when RSI < 30, sell when RSI > 70" | ✅ | Classic. Usually decent win rate. Good baseline. |
| 2 | Golden Cross | "Buy when SMA(50) crosses above SMA(200), sell on death cross" | ✅ | Iconic. Few trades, long holds. |
| 3 | Dip Buyer + TP/SL | "Buy when price drops 10% in 7 days. Sell at 20% profit or 7% loss." | ✅ | Shows TP/SL. Relatable for crypto. |
| 4 | Bollinger Bounce | "Buy when price drops below lower Bollinger Band, sell at the middle band" | ✅ | Shows Bollinger. Mean-reversion. |
| 5 | MACD Momentum | "Buy when MACD crosses above signal and RSI < 50. Sell when MACD crosses below signal." | ✅ | Multi-condition AND. Shows complex entry. |
| 6 | Weekly DCA | "Invest $100 every week" | ✅ | Universal benchmark. DCA mode. Great for comparison. |

### 12.2 Known-Good Run Snapshots (Demo-Proof)

**Problem presets alone don't solve:** A preset strategy on a bad date range or unfamiliar asset can still produce 0 trades, a flat equity curve, or NaN metrics — which looks broken in a 3-minute demo.

**Solution: Known-good run snapshots.** Each snapshot locks:
- ✅ Preset RuleSet
- ✅ Specific asset
- ✅ Specific date range
- ✅ Specific fee/slippage settings

...so one click **always** produces the exact visually interesting result you rehearsed.

```typescript
interface DemoSnapshot {
  id: string;
  presetId: string;         // which preset strategy
  displayName: string;      // "RSI Mean Reversion on BTC (2021–2025)"
  config: {
    asset: AssetSymbol;
    startDate: string;
    endDate: string;
    initialCapital: number;
    feeBps: number;
    slippageBps: number;
  };
  // The RuleSet is loaded from the preset.
  // The config is pre-set. User clicks once → confirm screen → run.
  // Result is deterministic: same data + same rules = same output every time.
}
```

**Demo snapshots to pre-build and test:**

| Snapshot | Preset | Asset | Range | Why |
|---|---|---|---|---|
| "RSI on BTC" | RSI Mean Reversion | BTC | 2021-01-01 – 2025-12-31 | Produces 15–20 trades, good win rate, visually interesting equity curve. |
| "DCA on BTC" | Weekly DCA | BTC | 2021-01-01 – 2025-12-31 | Smooth upward curve. Great comparison against RSI. |
| "RSI on ETH" | RSI Mean Reversion | ETH | 2021-01-01 – 2025-12-31 | Shows different results on different asset. |
| "Golden Cross on BTC" | Golden Cross | BTC | 2021-01-01 – 2025-12-31 | Few trades, long holds. Contrasts with RSI. |

**Pre-demo checklist:** Run every snapshot. Verify non-zero trades, interesting charts, reasonable metrics. If any snapshot produces bad results, adjust the date range until it looks good. This is NOT cheating — you're choosing which data range to demo on, which is what every quant presentation does.

### 12.3 UX for Demo Mode

- **Landing page shows preset cards.** Click → RuleSet + config loaded directly (no AI call) → confirmation screen → run.
- **"Quick Demo" section** with known-good snapshots: "RSI on BTC" / "DCA on BTC" — single click, guaranteed good output.
- **"Load Demo-Safe Strategy" button** always visible in the input panel.
- If Claude parse fails → UI suggests "Use a preset instead" with one-click fallback.

---

## 13. UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: "Vibe Trade" logo  |  dark/light toggle  |  GitHub link   │
├────────────────────────────┬────────────────────────────────────────┤
│                            │                                        │
│  LEFT PANEL (~350px)       │  MAIN AREA (flex-1)                   │
│                            │                                        │
│  ┌──────────────────────┐  │  [Phase: INPUT / landing]              │
│  │ Quick Demo            │  │  Hero: tagline + 3-step how-it-works  │
│  │ ⚡ RSI on BTC         │  │  + preset grid                        │
│  │ ⚡ DCA on BTC          │  │                                       │
│  └──────────────────────┘  │  [Phase: CONFIRMING]                   │
│                            │  Rule cards + warnings + JSON toggle    │
│  ┌──────────────────────┐  │                                        │
│  │ Strategy Templates    │  │  [Phase: RESULTS]                     │
│  │ ┌─ RSI Mean Revert  │  │  Candlestick chart (markers + overlays)│
│  │ ├─ Golden Cross      │  │  Equity curve (strategy vs buy&hold)  │
│  │ ├─ Dip Buyer        │  │  Metrics grid (4×3 cards, green/red)  │
│  │ ├─ Bollinger Bounce │  │  Audit panel (collapsible)             │
│  │ ├─ MACD Momentum    │  │  Trade log (sortable table)            │
│  │ └─ Weekly DCA        │  │                                        │
│  └──────────────────────┘  │  [Phase: COMPARING]                    │
│                            │  Overlaid equity curves                │
│  ┌──────────────────────┐  │  Side-by-side metrics + deltas         │
│  │ Custom Strategy       │  │                                        │
│  │ ┌──────────────────┐ │  │                                        │
│  │ │ Describe your    │ │  │                                        │
│  │ │ strategy...      │ │  │                                        │
│  │ └──────────────────┘ │  │                                        │
│  │ Asset:   [BTC ▼]     │  │                                        │
│  │ From:    [2021-01-01] │  │                                        │
│  │ To:      [2025-12-31] │  │                                        │
│  │ Capital: [$10,000]    │  │                                        │
│  │ Fees:    [10 bps]     │  │                                        │
│  │ Slip:    [5 bps]      │  │                                        │
│  │                      │  │                                        │
│  │ [▶ Parse Strategy]   │  │                                        │
│  │ [⚔ Compare with...]  │  │                                        │
│  └──────────────────────┘  │                                        │
│                            │                                        │
│  ┌──────────────────────┐  │                                        │
│  │ Run History          │  │                                        │
│  │ ┌─ RSI on BTC +48%  │  │                                        │
│  │ ├─ DCA on BTC +31%  │  │                                        │
│  │ └─ RSI on ETH +22%  │  │                                        │
│  └──────────────────────┘  │                                        │
│                            │                                        │
├────────────────────────────┴────────────────────────────────────────┤
│  FOOTER: "AI parses your strategy. Math does the rest."  · v1.0    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 14. File Structure

```
vibe-trade/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── parse/
│   │           └── route.ts              # POST: prompt → Claude → Zod-validated RuleSet
│   ├── components/
│   │   ├── StrategyInput.tsx
│   │   ├── RuleConfirmation.tsx
│   │   ├── PriceChart.tsx                # lightweight-charts candlestick + markers + overlays
│   │   ├── EquityCurve.tsx               # Recharts area: strategy vs buy&hold + drawdown
│   │   ├── MetricsGrid.tsx
│   │   ├── AuditPanel.tsx                # execution assumptions (collapsible)
│   │   ├── TradeLog.tsx
│   │   ├── ComparisonView.tsx
│   │   ├── PresetGallery.tsx             # presets + known-good snapshots
│   │   ├── RunHistory.tsx
│   │   ├── LandingHero.tsx
│   │   └── ui/                           # shadcn/ui primitives
│   ├── engine/
│   │   ├── backtest.ts                   # main loop (standard + DCA branches)
│   │   ├── evaluator.ts                  # condition + group evaluation
│   │   ├── benchmark.ts                  # buy & hold computation (same fees)
│   │   └── types.ts                      # engine-internal types (OpenPosition, etc.)
│   ├── indicators/
│   │   ├── sma.ts
│   │   ├── ema.ts
│   │   ├── rsi.ts
│   │   ├── macd.ts
│   │   ├── bollinger.ts
│   │   ├── atr.ts
│   │   ├── pctChange.ts
│   │   └── index.ts                      # barrel export + registry
│   ├── metrics/
│   │   └── compute.ts
│   ├── types/
│   │   ├── strategy.ts                   # Zod schemas + inferred types + validateRuleSetInvariants()
│   │   └── results.ts                    # BacktestResult, Trade, EquityPoint, AuditInfo, etc.
│   ├── data/
│   │   ├── loader.ts                     # fetch + cache JSON from /public/data/
│   │   ├── presets.ts                    # Demo Mode: 6 preset RuleSet objects
│   │   └── snapshots.ts                  # Demo Mode: known-good run snapshot configs
│   └── lib/
│       ├── parser.ts                     # Claude API call + retry + Zod + invariant validation
│       └── utils.ts
├── public/
│   └── data/
│       ├── BTC_1D.json
│       ├── ETH_1D.json
│       ├── SOL_1D.json
│       ├── BNB_1D.json
│       ├── XRP_1D.json
│       ├── DOGE_1D.json
│       ├── ADA_1D.json
│       └── AVAX_1D.json
├── scripts/
│   ├── fetch-data.ts
│   └── test-engine.ts
├── __tests__/
│   ├── indicators/
│   │   ├── sma.test.ts
│   │   ├── ema.test.ts
│   │   ├── rsi.test.ts
│   │   ├── macd.test.ts
│   │   └── crossDetection.test.ts
│   ├── engine/
│   │   ├── backtest.test.ts
│   │   ├── evaluator.test.ts
│   │   ├── noLookahead.test.ts
│   │   ├── dcaMode.test.ts               # DCA-specific: interval buying, capital depletion
│   │   └── invariants.test.ts            # validateRuleSetInvariants() tests
│   └── metrics/
│       └── compute.test.ts
├── .env.local
├── tailwind.config.ts
├── next.config.js
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 15. Day-by-Day Build Plan (Solo)

### Pre-Work (before Feb 20)

- [ ] Download OHLCV data for 8 assets, convert to JSON, validate
- [ ] GitHub repo init + Next.js scaffold (TS, Tailwind, App Router, pnpm)
- [ ] Install deps: `zod`, `shadcn/ui`, `recharts`, `lightweight-charts`, `vitest`
- [ ] `.env.local` with `ANTHROPIC_API_KEY`
- [ ] Commit data files to repo

### Day 1 (Thu Feb 20) — Engine Core + Types

| Task | Est. Hours |
|---|---|
| Define ALL Zod schemas + TS types + `validateRuleSetInvariants()` | 2 |
| Implement indicators: SMA, EMA, RSI + unit tests | 2.5 |
| Implement condition evaluator + cross detection + unit tests | 1.5 |
| Implement standard-mode backtest engine core + equity tracking | 3 |
| CLI test script: hardcoded RSI strategy on BTC → print trade log + metrics | 0.5 |

**✅ Day 1 gate:** `pnpm test` passes. `npx ts-node scripts/test-engine.ts` prints correct trade log.

### Day 2 (Fri Feb 21) — Complete Engine + AI Parser + DCA

| Task | Est. Hours |
|---|---|
| Implement remaining indicators: MACD, Bollinger, ATR, pctChange + tests | 2.5 |
| Implement position-scope evaluation (pnl_pct, bars_in_trade) | 1 |
| Implement DCA mode branch (`runDCABacktest`) + tests | 1.5 |
| Implement benchmark computation (buy & hold with same fees) | 0.5 |
| Metrics calculator: all formulas + AuditInfo + unit tests | 1.5 |
| AI parser: system prompt, few-shots, Claude API call, Zod + invariant validation, retry | 2 |
| Wire `/api/parse` route | 0.5 |
| Define 6 Demo Mode presets as RuleSet JSON in `presets.ts` | 1 |

**✅ Day 2 gate:** `curl POST /api/parse` → valid Zod + invariant-checked JSON → engine → correct results. Presets work without Claude. DCA works. **Core product works headlessly.**

### Day 3 (Sat Feb 22) — Basic UI (Ugly but Functional)

| Task | Est. Hours |
|---|---|
| Data loader: fetch JSON on app init, cache in React context | 0.5 |
| Strategy input panel: textarea, asset dropdown, date range, capital, fees, Parse button | 2 |
| Wire frontend: parse → show rules → confirm → run engine client-side | 2 |
| Rule confirmation: human-readable cards, warnings, confidence, JSON toggle | 1.5 |
| lightweight-charts: candlestick chart with trade markers (green ▲ / red ▼) | 2.5 |
| Results v1: metrics as plain numbers, basic trade log | 1.5 |
| Demo Mode: preset cards + known-good snapshot buttons that skip AI | 1 |

**✅ Day 3 gate: THE "CAN'T LOSE" CHECKPOINT.** Full flow works. Presets work. It's ugly but functional.

### Day 4 (Sun Feb 23) — Charts + Visual Polish

| Task | Est. Hours |
|---|---|
| Equity curve: strategy vs buy&hold + drawdown shading (Recharts) | 2 |
| Indicator overlays on price chart: SMA/EMA/Bollinger lines | 1.5 |
| Dark mode, color palette, typography pass | 1.5 |
| Metrics grid: color-coded cards, proper number formatting | 1.5 |
| Audit panel (collapsible) with all execution assumptions | 1 |
| Loading states + landing hero with preset grid | 1.5 |

**✅ Day 4 gate:** Looks professional. Dark mode. Polished charts. Audit panel visible.

### Day 5 (Mon Feb 24) — Comparison + Edge Cases

| Task | Est. Hours |
|---|---|
| Comparison mode: overlaid equity curves + side-by-side metrics with deltas | 3.5 |
| "Swap asset, keep strategies" — re-run with one click | 1 |
| Run history sidebar | 1.5 |
| Edge cases: 0 trades, 1 trade, warmup > range → clear messages | 1.5 |
| Error UX: parse fail, low confidence, invariant violation → friendly messages | 1 |
| Test all known-good snapshots produce expected results | 0.5 |

**✅ Day 5 gate:** Full demo script executable. Compare works. 🛑 **HARD FEATURE FREEZE.**

### Day 6 (Tue Feb 25) — Polish + Deploy + Export

| Task | Est. Hours |
|---|---|
| Mobile responsiveness | 1.5 |
| Micro-animations: chart fade-in, metrics count-up | 1 |
| Export: JSON/CSV download, shareable URL | 1.5 |
| Deploy to Vercel, test live URL | 1 |
| README: architecture, stack, setup, screenshots | 2 |
| Code cleanup: dead code, JSDoc, naming | 1.5 |
| Stress test: 15+ prompts, verify results, fix bugs | 1.5 |

**✅ Day 6 gate:** Live URL works. README polished. Code clean. **No more code changes.**

### Day 7 (Wed Feb 26) — Demo Video + Submit

| Task | Est. Hours |
|---|---|
| Write demo script (exact words, strategies, timing) | 1 |
| Record 3–4 takes | 2 |
| Edit video: trim, transitions, captions | 2 |
| Submit: repo link + live URL + video | 0.5 |

---

## 16. Demo Video Script (2:30)

```
[0:00 – 0:10] HOOK
"Everyone in crypto has trading ideas. Almost nobody tests them.
Vibe Trade lets you describe a strategy in plain English
and see if it would've made money."

[0:10 – 0:40] FIRST STRATEGY
- Type: "Buy BTC when RSI drops below 30, sell when it goes above 70"
- Show: parsed rules appear as cards — "Entry: RSI(14) < 30. Exit: RSI(14) > 70."
- Click Confirm. Results appear instantly.
- Show: candlestick chart with green/red trade markers.
  Equity curve: strategy vs buy-and-hold.
  Metrics cards light up.

[0:40 – 1:10] RESULTS + AUDIT
"18 trades. 61% win rate. 87% return vs 54% buy-and-hold."
- Briefly expand audit panel:
  "No lookahead bias. Fees modeled. Benchmark uses the same assumptions.
  Every number is transparent and auditable."

[1:10 – 1:40] COMPARISON — THE MIC DROP
- Click "Compare with..."
- Type: "Just DCA $100 into BTC every week"
- Both equity curves overlaid. Metrics side-by-side with delta arrows.
"RSI had higher returns. DCA had lower drawdown.
Now you can actually see the tradeoff."

[1:40 – 2:10] SWAP ASSET
- Click ETH. Both strategies re-run instantly.
- Results visibly change.
"Same strategies, different asset, different outcome.
On ETH, the DCA won. That's why you test before you trade."

[2:10 – 2:30] CLOSE
- Briefly show preset gallery.
- "AI parses your strategy. Math does the rest.
  Built in one week with Claude Code."
```

---

## 17. Risk Register

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| AI parser misinterprets complex strategies | Med | High | Confirmation UI + JSON editing. Few-shot examples. Demo Mode presets + known-good snapshots. |
| Engine produces wrong metrics | Med | Critical | Unit tests for indicators + metrics. Cross-validate against manual spreadsheet. |
| DCA/standard mode confusion from Claude | Med | Med | Top-level `mode` field is explicit. Invariant validation catches hybrids. Retry once. Presets as fallback. |
| lightweight-charts integration issues | Low | Med | Fallback: Recharts for all charts. |
| Claude API down during demo | Low | High | Demo is pre-recorded. Live: known-good snapshots skip Claude entirely. |
| Scope creep | High | Critical | No new features after day 5 EOD. Day 3 checkpoint is safety net. |
| Benchmark looks "massaged" to skeptical judge | Low | Med | Same fees/slippage as strategy. Documented in Audit Panel. |
| Preset produces 0 trades on demo day | Low | High | Known-good snapshots lock asset+range. Pre-tested before recording. |
| Zod schema too complex for Claude | Med | Med | 5 few-shot examples. Retry once. Invariant validation catches malformed output. |

---

## 18. Security & Compliance

- No company systems, endpoints, or databases.
- Claude API key in `.env.local` only — never committed to repo.
- No user accounts, no auth.
- No server-side persistence.
- URL-encoded share links are validated and size-limited.
- Input sanitization on prompt text before sending to Claude.

---

## 19. Requirements Backlog (Speckit-Ready)

### Acceptance Criteria

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| VT-REQ-1 | Prompt to RuleSet | `/api/parse` returns Zod-valid + invariant-valid RuleSet OR friendly error with suggestions. |
| VT-REQ-2 | Rule Confirmation | Parsed rules shown as readable cards. JSON editor toggle. Warnings. Must confirm before execution. |
| VT-REQ-3 | Deterministic Backtest | Same inputs → identical outputs. No randomness. No network dependency for compute. |
| VT-REQ-4 | DCA Mode | DCA strategies produce correct additive equity tracking. No entry/exit conditions evaluated. |
| VT-REQ-5 | Professional Charts | Candlestick with trade markers + indicator overlays. Equity curve vs buy&hold with identical fee assumptions. |
| VT-REQ-6 | Metrics + Trade Log | 12+ metrics computed and displayed. Trade log sortable. |
| VT-REQ-7 | Audit Panel | Execution assumptions visible: fees, slippage, warmup, annualization, benchmark model. |
| VT-REQ-8 | Compare Mode | Two strategies side-by-side. Overlaid equity curves. Metric deltas. |
| VT-REQ-9 | Demo Mode | Preset RuleSets + known-good snapshots work E2E without Claude. |
| VT-REQ-10 | Export/Share | URL-encoded snapshot. JSON/CSV download. |
| VT-REQ-11 | Run History | Session history. Click to restore. |

### Task Breakdown

| ID | Task | Day | Est. |
|---|---|---|---|
| VT-TASK-01 | Zod schemas + types + invariant validator | 1 | 2h |
| VT-TASK-02 | Indicators: SMA, EMA, RSI + tests | 1 | 2.5h |
| VT-TASK-03 | Condition evaluator + cross detection | 1 | 1.5h |
| VT-TASK-04 | Standard-mode backtest engine core | 1 | 3h |
| VT-TASK-05 | Indicators: MACD, BB, ATR, pctChange | 2 | 2.5h |
| VT-TASK-06 | Position-scope evaluation | 2 | 1h |
| VT-TASK-07 | DCA mode engine branch | 2 | 1.5h |
| VT-TASK-08 | Benchmark computation (same fees) | 2 | 0.5h |
| VT-TASK-09 | Metrics calculator + AuditInfo | 2 | 1.5h |
| VT-TASK-10 | AI parser + /api/parse route | 2 | 2.5h |
| VT-TASK-11 | Demo Mode presets + snapshots | 2 | 1h |
| VT-TASK-12 | Data loader + caching | 3 | 0.5h |
| VT-TASK-13 | UI: input panel + API wiring | 3 | 4h |
| VT-TASK-14 | UI: rule confirmation | 3 | 1.5h |
| VT-TASK-15 | Candlestick chart + markers | 3 | 2.5h |
| VT-TASK-16 | Results v1: metrics + trade log | 3 | 1.5h |
| VT-TASK-17 | Preset gallery + snapshot buttons | 3 | 1h |
| VT-TASK-18 | Equity curve chart | 4 | 2h |
| VT-TASK-19 | Indicator chart overlays | 4 | 1.5h |
| VT-TASK-20 | Dark mode + polish | 4 | 3h |
| VT-TASK-21 | Audit panel | 4 | 1h |
| VT-TASK-22 | Loading states + landing hero | 4 | 1.5h |
| VT-TASK-23 | Comparison mode | 5 | 3.5h |
| VT-TASK-24 | Swap asset | 5 | 1h |
| VT-TASK-25 | Run history | 5 | 1.5h |
| VT-TASK-26 | Edge cases + error UX | 5 | 2.5h |
| VT-TASK-27 | Verify all snapshots produce good results | 5 | 0.5h |
| VT-TASK-28 | Mobile responsiveness | 6 | 1.5h |
| VT-TASK-29 | Export/share | 6 | 1.5h |
| VT-TASK-30 | Deploy Vercel | 6 | 1h |
| VT-TASK-31 | README + code cleanup | 6 | 3.5h |
| VT-TASK-32 | Stress test (15+ prompts) | 6 | 1.5h |
| VT-TASK-33 | Demo video | 7 | 5h |

---

## 20. README Structure (Submission)

```markdown
# 🎵 Vibe Trade — AI-Powered Strategy Backtester

> Describe a trading strategy in plain English. See if it would've made money.

[Live Demo](https://vibe-trade.vercel.app) · [Demo Video](link)

## What It Does
[Screenshot + 3-sentence description]

## How It Works
English prompt → [AI Parser] → Zod-Validated JSON RuleSet
                                         ↓
Bundled OHLCV data → [Deterministic Engine] → Trade Log → [Metrics] → Dashboard

AI touches ONE step. Everything else is verifiable, reproducible, deterministic math.

## Key Engineering Decisions
1. **AI is the translator, not the engine** — Claude parses; math executes.
2. **Client-side backtesting** — instant feedback, zero server compute latency.
3. **No look-ahead bias** — signal on close[i], execute on open[i+1].
4. **Zod-validated schemas** — AI output is schema-checked before engine receives it.
5. **Audit panel** — execution assumptions displayed. Benchmark uses same fees.

## Tech Stack
[Table]

## Getting Started
pnpm install → .env.local → pnpm dev

## Project Structure
[File tree]

## Testing
pnpm test

## Future Ideas
- Hourly/4H candles · Multi-asset portfolios · Live data mode
- Parameter optimization · Community strategy gallery · Export to Pine Script

## Built With
Claude Code for the XBO AI Coding Challenge, Feb 2026.
```

---

**End of spec.**
