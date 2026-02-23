# Vibe Trade

## Core Principle

AI is the translator, not the engine. Claude API parses natural language into a constrained JSON schema. The backtest engine executes **only Zod-validated JSON**. Everything after the AI parse step is deterministic and auditable.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript strict)
- **Validation:** Zod (runtime schema validation, generates TS types)
- **Styling:** Tailwind CSS + shadcn/ui (dark mode)
- **Candlestick chart:** lightweight-charts v5 (TradingView)
- **Analytics charts:** Recharts
- **AI parser:** Claude API (`claude-sonnet-4-20250514`) via `/api/parse` route
- **Engine:** Custom TypeScript, client-side, pure functions, zero dependencies
- **Testing:** Vitest
- **Package manager:** pnpm
- **Deploy:** Vercel

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   └── api/parse/          # POST: prompt+asset → Claude → Zod-validated RuleSet
├── components/             # React components (input panel, confirmation, dashboard, charts)
├── engine/                 # Backtest engine (pure functions, no side effects)
│   ├── indicators.ts       # SMA, EMA, RSI, MACD, BB, ATR, pctChange
│   ├── evaluator.ts        # Condition evaluation + cross detection
│   ├── backtest.ts         # Main engine loop (standard + DCA modes)
│   ├── metrics.ts          # Performance metrics calculator
│   └── benchmark.ts        # Buy-and-hold with identical fee assumptions
├── types/                  # Zod schemas + inferred TypeScript types
│   └── strategy.ts         # StrategyRuleSet, BacktestConfig, BacktestResult
├── data/                   # Data loader + caching
├── presets/                # Demo Mode: preset RuleSets + known-good snapshots
└── lib/                    # Shared utilities
public/
└── data/                   # Static OHLCV JSON: {asset}_1D.json (~200KB total)
```

## Architecture Rules

1. **No network dependencies for compute.** OHLCV data is bundled static JSON. Backtest runs entirely in the browser. Only `/api/parse` needs network (Claude API).
2. **Zod is the trust boundary.** AI output is parsed through `StrategyRuleSet` schema + `validateRuleSetInvariants()` before the engine ever sees it.
3. **Engine functions are pure.** Same inputs → identical outputs. No randomness, no side effects, no Date.now().
4. **No look-ahead bias.** Signal evaluated on `close[i]`, execution on `open[i+1]`.
5. **Fees are symmetric.** Benchmark uses the same `feeBps` + `slippageBps` as the strategy.
6. **DCA is a top-level mode**, not an indicator. `mode.type === 'dca'` → separate engine branch with empty entry/exit conditions enforced by invariant validation.
7. **Position-scope indicators** (`pnl_pct`, `bars_in_trade`) are regular conditions with `scope: 'position'`, not special types.

## Schema Key Points

- **Operand pattern:** Every condition is `left op right` where each side is `{ kind: 'indicator', indicator } | { kind: 'number', value }`.
- **Discriminated unions:** `StrategyMode` (`standard` | `dca`), `PositionSizing` (`percent_equity` | `fixed_amount`), `Operand` (`indicator` | `number`).
- **Post-Zod invariants:** `validateRuleSetInvariants()` enforces semantic rules per mode (DCA: empty conditions; standard: ≥1 entry condition).

## Testing Strategy

- Unit tests for: all indicators, condition evaluator, engine (standard + DCA), metrics calculator, benchmark, Zod schemas + invariant validator.
- Tests use known input/output pairs. Cross-validate metrics against manual spreadsheet calculations.

## Non-Goals

No live trading, no intraday, no shorting, no multiple positions, no database, no auth, no trailing stops, no `between` operator. See spec §2 for full list.

## Active Technologies
- TypeScript 5, strict mode, Next.js 16 (App Router) + React 19, Tailwind CSS 4, shadcn/ui, lucide-react (icons), Web Speech API (browser-native, zero npm packages) (001-voice-input)
- N/A (ephemeral speech sessions, no persistence) (001-voice-input)

## Recent Changes
- 001-voice-input: Added TypeScript 5, strict mode, Next.js 16 (App Router) + React 19, Tailwind CSS 4, shadcn/ui, lucide-react (icons), Web Speech API (browser-native, zero npm packages)
