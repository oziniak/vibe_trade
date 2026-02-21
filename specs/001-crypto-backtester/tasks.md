# Tasks: Vibe Trade — Crypto Strategy Backtester

**Input**: Design documents from `/specs/001-crypto-backtester/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/parse-api.md, research.md, quickstart.md
**Source**: Task breakdown extracted from `vibe-trade-final-spec-v3.md` §19 (VT-TASK-01 through VT-TASK-33)

**Organization**: Tasks follow the 3-phase constitution (Engine → UI v1 → Polish + Features) with dependency ordering. Tests are included per Constitution Principle IV (Math-First Testing).

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- Include exact file paths in descriptions
- Phase gates are verification checkpoints — MUST pass before proceeding

---

## Phase 1: ENGINE (Days 1-2) — ~18h

**Goal**: All pure-function modules implemented and tested. A backtest can be run programmatically with a preset RuleSet and produces correct metrics.

**Covers**: US1 (engine), US2 (presets), US3 (DCA engine) — engine-layer only, no UI.

### Step 1: Types & Schemas (blocks everything)

- [ ] VT-TASK-01 Define all Zod schemas (StrategyRuleSet, BacktestConfig, BacktestResult, Trade, EquityPoint, PerformanceMetrics, AuditInfo) with discriminated unions (StrategyMode, Operand, PositionSizing) + validateRuleSetInvariants() + inferred TS types in `src/types/strategy.ts` and `src/types/results.ts`. Tests: `__tests__/engine/invariants.test.ts` (2h)

### Step 2: Parallel batch after VT-TASK-01

- [ ] VT-TASK-02 [P] Implement SMA, EMA, RSI indicator functions returning `(number | null)[]` aligned with input length, null for warmup candles. Barrel export in `src/indicators/index.ts`. Files: `src/indicators/sma.ts`, `src/indicators/ema.ts`, `src/indicators/rsi.ts`, `src/indicators/index.ts`. Tests with hand-calculated values: `__tests__/indicators/sma.test.ts`, `__tests__/indicators/ema.test.ts`, `__tests__/indicators/rsi.test.ts` (2.5h)

- [ ] VT-TASK-05 [P] Implement MACD (line/signal/histogram), Bollinger Bands (upper/middle/lower), ATR, pctChange indicator functions. Files: `src/indicators/macd.ts`, `src/indicators/bollinger.ts`, `src/indicators/atr.ts`, `src/indicators/pctChange.ts`. Tests: `__tests__/indicators/macd.test.ts`, `__tests__/indicators/bollinger.test.ts`, `__tests__/indicators/atr.test.ts`, `__tests__/indicators/pctChange.test.ts` (2.5h)

- [ ] VT-TASK-08 [P] Implement computeBenchmark() — buy at first tradable candle open with 100% capital, same feeBps + slippageBps as strategy, hold to end, equity curve at every candle. File: `src/engine/benchmark.ts` (0.5h)

- [ ] VT-TASK-09 [P] Implement computeMetrics() with all 14 formulas from spec §10: totalReturn, CAGR, Sharpe (√365 annualization, population stdev, rf=0), Sortino, maxDrawdown, maxDrawdownDurationDays, winRate, profitFactor, avgWinPct, avgLossPct, bestTradePct, worstTradePct, avgHoldingDays, exposureTimePct, totalTrades. Build AuditInfo. Handle edge cases: 0 trades, 1 trade, no wins, no losses. File: `src/metrics/compute.ts`. Tests: `__tests__/metrics/compute.test.ts` (1.5h)

- [ ] VT-TASK-10 [P] Implement AI parser: system prompt with full schema + 5 few-shot examples from spec §7.2-7.3, Claude API call via @anthropic-ai/sdk (claude-sonnet-4-20250514, max_tokens 2048), validation pipeline (strip fences → JSON.parse → Zod safeParse → validateRuleSetInvariants → confidence check), retry once on failure, error response with suggestions. Files: `src/lib/parser.ts`, `src/app/api/parse/route.ts` (2.5h)

- [ ] VT-TASK-11 [P] Define 6 preset RuleSet JSON objects (RSI Mean Reversion, Golden Cross, Dip Buyer + TP/SL, Bollinger Bounce, MACD Momentum, Weekly DCA) and 4 known-good DemoSnapshot configs (RSI on BTC, DCA on BTC, RSI on ETH, Golden Cross on BTC) with locked asset + date range + fee settings. Files: `src/data/presets.ts`, `src/data/snapshots.ts` (1h)

### Step 3: After VT-TASK-02 (needs indicator functions for operand resolution)

- [ ] VT-TASK-03 Implement evaluateCondition() (resolve left/right operands → apply operator) and evaluateGroup() (AND = every, OR = some). Implement cross detection: crosses_above(A,B) at i = A[i-1] <= B[i-1] AND A[i] > B[i]; crosses_below is inverse. Requires i >= 1. File: `src/engine/evaluator.ts`. Tests: `__tests__/engine/evaluator.test.ts`, `__tests__/indicators/crossDetection.test.ts` (1.5h)

### Step 4: After VT-TASK-03 (extends evaluator)

- [ ] VT-TASK-06 Add position-scope indicator evaluation to evaluator: pnl_pct at index i = (close[i] - entryPrice) / entryPrice * 100; bars_in_trade = i - entryIndex. Only evaluated when position is open (receives OpenPosition). Extends: `src/engine/evaluator.ts` (1h)

### Step 5: After VT-TASK-01 + VT-TASK-02 + VT-TASK-03 (needs types, indicators, evaluator)

- [ ] VT-TASK-04 Implement runStandardBacktest(): pre-compute all indicators, determine warmup = max(all indicator periods), signal loop with anti-lookahead (signal on close[i], execute at open[i+1]), fee/slippage (adverse slippage on fill, fee on notional), mark-to-market equity tracking, drawdown from peak, force-close at last candle close. Define engine-internal types (OpenPosition, IndicatorCache). Build runBacktest() dispatcher. Files: `src/engine/backtest.ts`, `src/engine/types.ts`. Tests: `__tests__/engine/backtest.test.ts` (determinism proof: same inputs → identical outputs), `__tests__/engine/noLookahead.test.ts` (verify signal at i never uses data from i+1) (3h)

### Step 6: After VT-TASK-04 (extends backtest with DCA branch)

- [ ] VT-TASK-07 Implement runDCABacktest(): buy every mode.intervalDays candles at close price with adverse slippage, track totalUnitsHeld + totalInvested + remainingCash, handle cash depletion (partial buy when remainingCash > fee, skip when remainingCash <= fee), equity = totalUnitsHeld * close[i] + remainingCash, no warmup needed, entry/exit groups not evaluated. Extends: `src/engine/backtest.ts`. Tests: `__tests__/engine/dcaMode.test.ts` (interval buying, capital depletion, partial buy edge case) (1.5h)

### Phase 1 Verification Script

- [ ] VT-TASK-P1-GATE Create CLI test script that imports runBacktest() with a preset RSI RuleSet + mock BTC candle data, runs backtest, prints trade log + metrics. Verify programmatic E2E flow. File: `scripts/test-engine.ts` (included in VT-TASK-04 effort)

---

### ═══ PHASE 1 GATE ═══

**Verification**: ALL of the following must pass before starting Phase 2.

```
1. pnpm test → 0 failures across all test files:
   - __tests__/engine/invariants.test.ts
   - __tests__/indicators/sma.test.ts, ema.test.ts, rsi.test.ts
   - __tests__/indicators/macd.test.ts, bollinger.test.ts, atr.test.ts, pctChange.test.ts
   - __tests__/indicators/crossDetection.test.ts
   - __tests__/engine/evaluator.test.ts
   - __tests__/engine/backtest.test.ts
   - __tests__/engine/noLookahead.test.ts
   - __tests__/engine/dcaMode.test.ts
   - __tests__/metrics/compute.test.ts

2. npx ts-node scripts/test-engine.ts → prints correct trade log + metrics
   for a preset RSI strategy on BTC data.

3. curl -X POST http://localhost:3000/api/parse with a valid prompt →
   returns Zod-validated + invariant-checked RuleSet JSON.
```

---

## Phase 2: UI v1 (Day 3) — ~11h — CRITICAL CHECKPOINT

**Goal**: Full E2E loop works in the browser. Type prompt → see rules → confirm → see charts and metrics. Presets work without AI.

**Covers**: US1 (full UI), US2 (preset gallery), US3 (DCA in UI), US4 (rule editing).

### Step 1: Data loader (blocks all UI components)

- [ ] VT-TASK-12 Implement OHLCV data loader: fetch JSON from `/public/data/{ASSET}_1D.json`, parse compact keys (t/o/h/l/c/v) into typed Candle objects, cache in module-level Map. File: `src/data/loader.ts` (0.5h)

### Step 2: Parallel batch after VT-TASK-12

- [ ] VT-TASK-13 [P] Build strategy input panel (textarea for prompt, Select for asset with 8 options, date range inputs, initial capital, feeBps/slippageBps inputs, Parse button calling /api/parse) + app state context (AppPhase-based rendering: input → parsing → confirming → running → results → comparing) + two-panel layout (left sidebar ~350px, main area flex-1) + dark mode default (className="dark" on html). Files: `src/components/StrategyInput.tsx`, `src/app/page.tsx` (AppState context + phase router), `src/app/layout.tsx` (dark mode, fonts) (4h)

- [ ] VT-TASK-15 [P] Build candlestick chart using lightweight-charts: createChart in useEffect with dark theme, addCandlestickSeries (green up / red down), setMarkers for trade entry (green arrowUp belowBar) and exit (red arrowDown aboveBar) sorted by time ascending, ResizeObserver for responsive width, chart.remove() cleanup. File: `src/components/PriceChart.tsx` (2.5h)

### Step 3: After VT-TASK-13 (needs app state + input panel)

- [ ] VT-TASK-14 Build rule confirmation UI: display each condition as readable card with human-readable label, show parser warnings prominently, show parserConfidence badge, Tabs toggle between card view and JSON editor (textarea), Confirm button triggers client-side backtest via runBacktest(). File: `src/components/RuleConfirmation.tsx` (1.5h)

### Step 4: After VT-TASK-14 + VT-TASK-15 (needs confirmation flow + chart)

- [ ] VT-TASK-16 Build results v1: MetricsGrid with 4×3 Card layout showing all 14 metrics with basic color coding (green positive / red negative), number formatting (currency, %, ratios). TradeLog as sortable Table (entry/exit dates, prices, P&L, holding days, exit reason). Files: `src/components/MetricsGrid.tsx`, `src/components/TradeLog.tsx` (1.5h)

### Step 5: After VT-TASK-13 + VT-TASK-11 (needs input panel + presets from Phase 1)

- [ ] VT-TASK-17 Build preset gallery: 6 preset strategy cards with name, description, and prompt displayed. Click → loads pre-built RuleSet directly into confirmation (no AI call). Known-good snapshot buttons → loads preset + locked config → one-click to full results. "Load Demo-Safe Strategy" fallback when AI parse fails. File: `src/components/PresetGallery.tsx` (1h)

---

### ═══ PHASE 2 GATE (DAY 3 CHECKPOINT) ═══

**Verification**: Full E2E loop works in the browser via `pnpm dev`. If this gate fails, STOP all other work and fix it.

```
Test sequence:
  1. Open http://localhost:3000 → see landing page with preset cards
  2. Click "RSI Mean Reversion" preset → see rule confirmation cards
     with entry "RSI(14) < 30" and exit "RSI(14) > 70"
  3. Click Confirm → see candlestick chart with green/red trade markers
     + metrics grid + trade log
  4. Go back to input → type "Buy BTC when RSI drops below 30, sell
     when it goes above 70" → click Parse → see rules → Confirm → results
  5. Disconnect network → click a preset → full results still render
     (Demo Mode works without AI)
  6. Try "DCA $100 into BTC every week" preset → see DCA accumulation
     pattern in results
```

---

## Phase 3: POLISH + FEATURES (Days 4-5) — ~18h

**Goal**: Demo script from spec §16 can be executed without failure. Feature freeze at end of Day 5.

**Covers**: US5 (compare), US6 (swap asset), US7 (history), plus polish for US1-4.

### Day 4: Parallel batch (can all start immediately)

- [ ] VT-TASK-18 [P] Build equity curve chart using Recharts ComposedChart: two Area series (strategy green #22c55e with gradient fill, benchmark indigo #6366f1 dashed), drawdown sub-chart with Area baseValue={0} (red #ef4444), syncId="backtest" for linked hover, dark mode styling (slate palette), custom tooltip with currency formatting, ResponsiveContainer. File: `src/components/EquityCurve.tsx` (2h)

- [ ] VT-TASK-20 [P] Dark mode + UI polish: full color pass with Tailwind slate palette, consistent typography, shadcn/ui component theming, globals.css CSS variables for dark theme, proper contrast ratios, professional card styling for metrics. Files: `src/app/globals.css`, `src/app/layout.tsx`, `tailwind.config.ts` (3h)

- [ ] VT-TASK-21 [P] Build audit panel: Collapsible component showing all AuditInfo fields — execution model, feeBps, slippageBps, warmupCandles, dataRange, totalCandles, tradableCandles, annualizationFactor (365), riskFreeRate (0), benchmarkModel, positionModel. File: `src/components/AuditPanel.tsx` (1h)

- [ ] VT-TASK-22 [P] Build loading states + landing hero: LandingHero with tagline "Describe a trading strategy in plain English. See if it would've made money.", 3-step how-it-works (Describe → Parse → Analyze), preset grid. Skeleton loaders during AI parse. Brief animation during backtest computation. Error states for all failure modes. File: `src/components/LandingHero.tsx` + loading/error state additions to existing components (1.5h)

- [ ] VT-TASK-25 [P] Build run history sidebar: list of RunSnapshot entries (strategy name, asset, key metrics preview: totalReturn, sharpeRatio, winRate, totalTrades), click to restore full BacktestResult, stored in AppState.runHistory, auto-added after each backtest completes. File: `src/components/RunHistory.tsx` (1.5h)

### Day 4: After VT-TASK-15 from Phase 2 (extends candlestick chart)

- [ ] VT-TASK-19 Add indicator overlays to candlestick chart: SMA/EMA as addLineSeries with distinct colors, Bollinger Bands as 3 line series (upper/lower semi-transparent, middle dashed), conditionally rendered based on which indicators the strategy uses (extracted from entry/exit conditions). Extends: `src/components/PriceChart.tsx` (1.5h)

### Day 5: After VT-TASK-18 (needs equity curve for overlay)

- [ ] VT-TASK-23 Build comparison mode: "Compare with..." button in results view → second strategy input, run second backtest, overlaid equity curves (two strategy series on same ComposedChart with distinct colors + legend), side-by-side metrics with delta arrows (green ▲ when strategy A is better, red ▼ when worse), both strategies re-run when asset is swapped. File: `src/components/ComparisonView.tsx` (3.5h)

### Day 5: After Phase 2 gate (needs E2E working)

- [ ] VT-TASK-24 Implement instant asset swap: when user changes asset dropdown in results/comparing phase, re-run backtest(s) with new asset data client-side, update all charts + metrics + trade log without loading spinner. Extends: app state context in `src/app/page.tsx` (1h)

### Day 5: After most features built

- [ ] VT-TASK-26 Implement edge cases + error UX across all components: zero trades → "No trades were generated" message with explanation; single trade → force-close at last candle, metrics show "N/A" where needed; warmup > range → warning message; DCA capital depletion → skip/partial buy handled gracefully; parse fail → friendly error + "Use a preset instead" one-click fallback; low confidence (< 0.3) → error with suggestions instead of confirmation; identical entry/exit on same candle → entry takes priority. Extends: all components with error boundaries, empty states, validation messages (2.5h)

### Day 5: LAST task in Phase 3

- [ ] VT-TASK-27 Run every demo snapshot (RSI on BTC, DCA on BTC, RSI on ETH, Golden Cross on BTC), verify each produces non-zero trades, visually interesting equity curves, reasonable metrics. Adjust snapshot date ranges if any produce bad results. Verify all 6 presets produce at least 1 trade. (0.5h)

---

### ═══ PHASE 3 GATE ═══

**Verification**: The 2:30 demo script from spec §16 can be executed manually without failure.

```
Test sequence (mirrors demo video):
  1. Type "Buy BTC when RSI drops below 30, sell when it goes above 70"
     → Parse → Confirm → Results with candlestick chart, equity curve,
     metrics, trade log. No errors.
  2. Expand audit panel → shows execution model, fees, benchmark model.
  3. Click "Compare with..." → type "Just DCA $100 into BTC every week"
     → Confirm → Both equity curves overlaid, metrics side-by-side with
     delta arrows.
  4. Click ETH in asset dropdown → both strategies re-run instantly
     with different results. No loading spinner.
  5. Click preset gallery → click "RSI Mean Reversion" → full results.
  6. Check run history → previous runs listed with metrics preview.
  7. Zero console errors, zero unhandled promise rejections throughout.

🛑 HARD FEATURE FREEZE after this gate passes.
```

---

## Phase 4: SHIP (Days 6-7) — ~14h

**Goal**: Stabilize, deploy, document, record demo video. NO new features.

**Covers**: US8 (export/share), plus deployment, documentation, testing, video.

### Sequential execution (each depends on previous)

- [ ] VT-TASK-28 Add mobile responsiveness: responsive breakpoints for two-panel layout (stack on mobile), touch-friendly chart interactions, readable metrics grid on small screens. Extends: all component files + `src/app/globals.css` (1.5h)

- [ ] VT-TASK-29 Implement export/share: "Export JSON" button downloads full {ruleSet, config, results} as .json file; "Export CSV" button downloads trade log as .csv; "Share" button generates URL-encoded snapshot (base64 compressed ruleSet + config in URL params), URL parser restores config on load. File: `src/lib/utils.ts` (export helpers) + extends results components (1.5h)

- [ ] VT-TASK-30 Deploy to Vercel: set ANTHROPIC_API_KEY in Vercel Environment Variables, verify pnpm build succeeds, deploy with `vercel --prod`, test live URL (parse route works, presets work, static data loads from CDN). Verify `export const maxDuration = 10` in API route for safety. (1h)

- [ ] VT-TASK-31 Write README (architecture diagram, tech stack table, getting started, project structure, testing, engineering decisions), code cleanup (remove dead code, add JSDoc comments to all exported functions/types, naming consistency pass), verify all files match spec §14 structure. Files: `README.md`, all `src/` files (3.5h)

- [ ] VT-TASK-32 Stress test with 15+ diverse prompts covering: simple RSI, complex multi-condition, DCA variants, ambiguous inputs, non-trading-strategy text, partial strategies, strategies with unsupported features (shorting, trailing stop). Verify each produces valid results or appropriate error message. Fix any bugs found. (1.5h)

- [ ] VT-TASK-33 Record demo video: write 2:30 script per spec §16 (hook → first strategy → results/audit → comparison → swap asset → close), record 3-4 takes, edit best take with trims/transitions/captions. Submit: repo link + live URL + video. (5h)

---

## Dependencies & Execution Order

### Dependency Graph

```
PHASE 1 — ENGINE
VT-01 (types) ─────────────────────────────────────────────────
  ├─[P]─ VT-02 (SMA/EMA/RSI) ──► VT-03 (evaluator) ──► VT-06 (position-scope)
  ├─[P]─ VT-05 (MACD/BB/ATR/pctChange)
  ├─[P]─ VT-08 (benchmark)
  ├─[P]─ VT-09 (metrics)
  ├─[P]─ VT-10 (AI parser)
  └─[P]─ VT-11 (presets)

  VT-01 + VT-02 + VT-03 ──► VT-04 (standard engine) ──► VT-07 (DCA engine)

  ═══ GATE: pnpm test passes, scripts/test-engine.ts runs ═══

PHASE 2 — UI v1
VT-12 (data loader) ──────────────────────────────────────────
  ├─[P]─ VT-13 (input panel + app state) ──► VT-14 (rule confirmation)
  │                                      └──► VT-17 (preset gallery, also needs VT-11)
  └─[P]─ VT-15 (candlestick chart)

  VT-14 + VT-15 ──► VT-16 (results dashboard)

  ═══ GATE: E2E loop in browser — DAY 3 CHECKPOINT ═══

PHASE 3 — POLISH + FEATURES
  ┌─[P]─ VT-18 (equity curve) ──► VT-23 (comparison mode)
  ├─[P]─ VT-19 (indicator overlays — needs VT-15)
  ├─[P]─ VT-20 (dark mode polish)
  ├─[P]─ VT-21 (audit panel)
  ├─[P]─ VT-22 (loading states + hero)
  ├─[P]─ VT-25 (run history)
  └───── VT-24 (swap asset — needs Phase 2 gate)

  All above ──► VT-26 (edge cases) ──► VT-27 (verify snapshots)

  ═══ GATE: demo script §16 runs without failure ═══

PHASE 4 — SHIP
VT-28 ──► VT-29 ──► VT-30 ──► VT-31 ──► VT-32 ──► VT-33
```

### Cross-Phase Dependencies

| Task | Depends On | Phase |
|------|-----------|-------|
| VT-TASK-03 | VT-TASK-02 (needs indicator functions) | 1 |
| VT-TASK-04 | VT-TASK-01 + VT-TASK-02 + VT-TASK-03 | 1 |
| VT-TASK-06 | VT-TASK-03 (extends evaluator) | 1 |
| VT-TASK-07 | VT-TASK-04 (extends backtest) | 1 |
| VT-TASK-14 | VT-TASK-13 (needs app state) | 2 |
| VT-TASK-16 | VT-TASK-14 + VT-TASK-15 | 2 |
| VT-TASK-17 | VT-TASK-13 + VT-TASK-11 (Phase 1) | 2 |
| VT-TASK-19 | VT-TASK-15 (extends chart) | 3 |
| VT-TASK-23 | VT-TASK-18 (needs equity curve) | 3 |
| VT-TASK-24 | Phase 2 gate | 3 |
| VT-TASK-26 | Most Phase 3 tasks | 3 |
| VT-TASK-27 | VT-TASK-26 (after edge cases) | 3 |

### Parallel Opportunities

**Phase 1 — After VT-TASK-01**:
```
Parallel: VT-02, VT-05, VT-08, VT-09, VT-10, VT-11 (6 tasks, all independent)
```

**Phase 2 — After VT-TASK-12**:
```
Parallel: VT-13, VT-15 (2 tasks, different components)
```

**Phase 3 — Immediately**:
```
Parallel: VT-18, VT-19, VT-20, VT-21, VT-22, VT-25 (6 tasks, all independent)
```

---

## Implementation Strategy

### MVP: Phase 1 + Phase 2 (Days 1-3)

1. Complete Phase 1: Engine — all math correct, all tests pass
2. Complete Phase 2: UI v1 — full loop works in browser
3. **DAY 3 CHECKPOINT**: If this fails, stop everything and fix it
4. At this point: app is ugly but functional, demo-proof via presets

### Incremental Delivery: Phase 3 (Days 4-5)

5. Day 4: Equity curve, overlays, dark mode polish, audit panel, hero — app looks professional
6. Day 5: Comparison mode, swap asset, run history, edge cases — full feature set
7. **FEATURE FREEZE**: No new features after Day 5 EOD

### Ship: Phase 4 (Days 6-7)

8. Day 6: Mobile, export, deploy, README, stress test — production ready
9. Day 7: Demo video — submit

---

## Task Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|----------------|
| Phase 1: Engine | VT-01 through VT-11 (11 tasks) | ~18h |
| Phase 2: UI v1 | VT-12 through VT-17 (6 tasks) | ~11h |
| Phase 3: Polish | VT-18 through VT-27 (10 tasks) | ~18h |
| Phase 4: Ship | VT-28 through VT-33 (6 tasks) | ~14h |
| **Total** | **33 tasks** | **~61h** |

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Phase gates are hard checkpoints — do not proceed until verified
- Day 3 is the critical checkpoint — if Phase 2 is not complete, stop all other work
- Feature freeze at end of Day 5 — Days 6-7 are ship-only
- All backtest computation is client-side — no server dependencies for core functionality
- Demo Mode (presets + snapshots) guarantees demo resilience regardless of AI availability
