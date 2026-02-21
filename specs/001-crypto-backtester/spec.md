# Feature Specification: Vibe Trade — Crypto Strategy Backtester

**Feature Branch**: `001-crypto-backtester`
**Created**: 2026-02-21
**Status**: Draft
**Input**: Solo competition entry for XBO Claude Code Challenge (Feb 20-27, 2026). AI-powered crypto strategy backtester that turns plain-English trading ideas into deterministic backtests with professional analytics.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Backtest a Strategy from Natural Language (Priority: P1) [Phase 1 + Phase 2]

A crypto-curious user who has a trading idea but no coding skills opens Vibe Trade, types their strategy in plain English (e.g., "Buy BTC when RSI drops below 30, sell when it goes above 70"), and receives a full backtest with professional analytics — candlestick chart with trade markers, performance metrics, and a trade log.

**Why this priority**: This is the core product loop. Without it, nothing else has value. It demonstrates Functionality, Usefulness, and Creativity in a single flow. Phase 1 delivers the engine (programmatic backtest), Phase 2 wires it to the UI.

**Independent Test**: Can be fully tested by typing a strategy prompt, confirming the parsed rules, and verifying that charts, metrics, and trade log appear with correct data.

**Acceptance Scenarios**:

1. **Given** the app is loaded with bundled OHLCV data, **When** the user types "Buy BTC when RSI drops below 30, sell when it goes above 70" and clicks Parse, **Then** the system returns a structured rule set showing entry condition "RSI(14) < 30" and exit condition "RSI(14) > 70" within 3 seconds.

2. **Given** parsed rules are displayed as readable cards, **When** the user clicks Confirm, **Then** the backtest runs client-side and results appear instantly (no loading spinner for computation) showing: candlestick chart with green/red trade markers, 12+ performance metrics, and a sortable trade log.

3. **Given** a completed backtest, **When** the user views the results, **Then** a buy-and-hold benchmark equity curve is overlaid using identical fee and slippage assumptions, and all execution assumptions are documented in an audit panel.

4. **Given** a strategy prompt that cannot be parsed, **When** the parse fails, **Then** a friendly error message appears with suggested example prompts and a one-click fallback to load a preset strategy.

5. **Given** any valid rule set and data inputs, **When** the backtest runs twice with identical inputs, **Then** the outputs (trades, metrics, equity curve) are byte-for-byte identical — proving determinism.

---

### User Story 2 — Run a Preset Strategy Without AI (Priority: P1) [Phase 1 + Phase 2]

A user (or a demo presenter under time pressure) selects a preset strategy from the gallery (e.g., "RSI Mean Reversion on BTC") and sees full results with one click — without any AI or network dependency.

**Why this priority**: Demo resilience is non-negotiable. If the AI parser is down during the demo, presets guarantee the app still works end-to-end. This is equally important as US1 because it underpins reliability.

**Independent Test**: Can be tested by disconnecting from the network, clicking a preset, and verifying that the full results dashboard renders correctly.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** the user clicks a preset strategy card (e.g., "RSI Mean Reversion"), **Then** the pre-built rule set loads directly into the confirmation screen without making any network call.

2. **Given** a known-good snapshot (preset + specific asset + date range), **When** the user clicks the "Quick Demo" button, **Then** the full results appear with visually interesting charts, non-zero trades, and reasonable metrics — guaranteed by pre-tested configurations.

3. **Given** the AI parser is unavailable (network down or API error), **When** the user tries to parse a custom strategy, **Then** the error message suggests "Use a preset instead" with a one-click fallback that works without AI.

4. **Given** 6 preset strategies are available (RSI Mean Reversion, Golden Cross, Dip Buyer with TP/SL, Bollinger Bounce, MACD Momentum, Weekly DCA), **When** each is run with its known-good snapshot configuration, **Then** each produces at least 1 trade and a visually distinct equity curve.

---

### User Story 3 — DCA Strategy Backtesting (Priority: P1) [Phase 1 + Phase 2]

A user describes a dollar-cost-averaging strategy (e.g., "DCA $100 into BTC every week") and sees how periodic fixed-dollar investments would have performed over time, compared to buying and holding.

**Why this priority**: DCA is the most common real-world crypto strategy. It validates a completely different engine path (additive position tracking, no entry/exit signals), demonstrating architectural depth.

**Independent Test**: Can be tested by running a DCA preset and verifying that the equity curve shows a smooth accumulation pattern, trades occur at fixed intervals, and metrics reflect DCA-specific behavior.

**Acceptance Scenarios**:

1. **Given** the user types "DCA $100 into BTC every week", **When** the parser processes this, **Then** the rule set has `mode.type = "dca"`, `intervalDays = 7`, `amountUsd = 100`, and empty entry/exit condition arrays.

2. **Given** a DCA rule set with $100 weekly buys and $10,000 initial capital, **When** the backtest runs, **Then** buys occur every 7 candles at the close price with adverse slippage, fees are deducted from available cash, and buying stops when cash is depleted.

3. **Given** a DCA backtest is complete, **When** the user views results, **Then** the equity curve shows the gradual accumulation pattern, the trade log shows each periodic purchase with the fill price and units bought, and the benchmark comparison uses identical fee assumptions.

---

### User Story 4 — Rule Review and Editing (Priority: P2) [Phase 2]

A user reviews the AI-parsed rules before running the backtest, notices a warning or wants to adjust a parameter, and edits the rule set using either the card UI or a JSON editor toggle.

**Why this priority**: Builds trust and serves power users. The confirmation step prevents blind execution and lets users catch parser errors. Serves the Usefulness judging criterion.

**Independent Test**: Can be tested by parsing a strategy, toggling to the JSON editor, modifying a condition value, and verifying that the backtest uses the modified rule set.

**Acceptance Scenarios**:

1. **Given** the AI parser returns a rule set, **When** the confirmation screen renders, **Then** each condition is displayed as a readable card showing the human-readable label (e.g., "RSI(14) < 30"), and the user MUST explicitly confirm before the backtest runs.

2. **Given** a rule set with parser warnings (e.g., "No exit conditions specified"), **When** the confirmation screen renders, **Then** warnings are prominently displayed with explanatory text so the user can make an informed decision.

3. **Given** the confirmation screen is showing, **When** the user toggles to JSON editor mode, **Then** the raw JSON is displayed in an editable code editor, and changes to the JSON are reflected in the card view when toggling back.

4. **Given** a rule set with `parserConfidence: "low"` (score < 0.3), **When** the parse completes, **Then** the system shows an error message with suggestions instead of proceeding to confirmation.

---

### User Story 5 — Compare Two Strategies (Priority: P2) [Phase 3]

A user who has just run a backtest wants to compare their strategy against an alternative (e.g., RSI vs DCA) to see which performed better, with overlaid equity curves and side-by-side metric deltas.

**Why this priority**: Comparison is the "mic drop" moment in the demo. It turns a simple tool into a decision-making aid. Directly serves both Functionality and Creativity judging criteria.

**Independent Test**: Can be tested by running two strategies and verifying that overlaid equity curves and metric delta arrows render correctly.

**Acceptance Scenarios**:

1. **Given** a completed backtest result, **When** the user clicks "Compare with..." and enters a second strategy, **Then** both equity curves are overlaid on the same chart with distinct colors and a legend.

2. **Given** two completed backtests in comparison mode, **When** the results display, **Then** metrics are shown side-by-side with delta arrows (green up / red down) indicating which strategy performed better on each metric.

3. **Given** two strategies in comparison mode, **When** the user swaps the asset (e.g., BTC → ETH), **Then** both strategies re-run instantly on the new asset and the comparison updates without any loading spinner for computation.

---

### User Story 6 — Swap Asset and Re-Run (Priority: P2) [Phase 3]

A user who has backtest results wants to see how the same strategy performs on a different cryptocurrency, and gets instant results when switching assets.

**Why this priority**: Demonstrates the power of client-side computation. "Same strategies, different asset, different outcome" is a compelling demo moment that showcases Usefulness.

**Independent Test**: Can be tested by running a backtest on BTC, switching to ETH, and verifying that results update instantly with different metrics.

**Acceptance Scenarios**:

1. **Given** a completed backtest on BTC, **When** the user selects ETH from the asset dropdown, **Then** the backtest re-runs instantly with the same rule set and the results update without a loading spinner.

2. **Given** 8 available assets (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX), **When** the user switches between any two, **Then** the chart, metrics, and trade log reflect the new asset's data within the same date range.

---

### User Story 7 — Browse and Restore Run History (Priority: P3) [Phase 3]

A user who has run multiple backtests in a session wants to review previous results, compare them, or re-examine a specific run without re-entering the strategy.

**Why this priority**: Adds depth to the user experience and shows thoughtful UX design. Lower priority because the core value is delivered without it.

**Independent Test**: Can be tested by running 3+ backtests, clicking a history entry, and verifying that the full results are restored.

**Acceptance Scenarios**:

1. **Given** the user has run 3+ backtests in the current session, **When** they view the Run History sidebar, **Then** each entry shows the strategy name, asset, and key metrics preview (total return, Sharpe ratio, win rate, total trades).

2. **Given** a run history with entries, **When** the user clicks an entry, **Then** the full results (charts, metrics, trade log) are restored exactly as they appeared when the backtest was originally run.

---

### User Story 8 — Export and Share Results (Priority: P3) [Phase 3 + Days 6-7]

A user wants to save their backtest results to share with others or reference later, via a shareable URL or downloadable file.

**Why this priority**: Nice-to-have that adds polish and completes the feature set. Days 6-7 deliverable.

**Independent Test**: Can be tested by running a backtest, clicking export, and verifying that the downloaded JSON/CSV contains the correct data and that a generated URL restores the same configuration.

**Acceptance Scenarios**:

1. **Given** a completed backtest, **When** the user clicks "Export JSON", **Then** a JSON file downloads containing the full rule set, configuration, and results.

2. **Given** a completed backtest, **When** the user clicks "Export CSV", **Then** a CSV file downloads containing the trade log with all trade details.

3. **Given** a completed backtest, **When** the user clicks "Share", **Then** a URL is generated that encodes the rule set and configuration, and opening that URL in a new browser restores the same configuration and runs the backtest.

---

### Edge Cases

- **Zero trades**: Strategy conditions never trigger (e.g., RSI never drops below 5). The system MUST display "No trades were generated" with a clear message explaining why, not a blank or broken dashboard.
- **Single trade**: Only one entry and no exit signal fires. The position is force-closed at the last candle's close. Metrics that require 2+ trades (e.g., win rate) MUST show "N/A" or a meaningful value.
- **Warmup exceeds date range**: If indicator periods (e.g., SMA(200)) require more warmup candles than the selected date range provides, the system MUST display a warning: "Warmup period (N candles) exceeds the selected date range."
- **DCA capital depletion**: When remaining cash cannot cover the next DCA buy + fees, the system MUST skip the buy (or do a partial buy) and continue tracking equity from held units.
- **Parser returns nonsensical rules**: Zod validation catches malformed JSON. Post-Zod invariant validation catches semantic errors (e.g., DCA mode with non-empty entry conditions). The system MUST show specific error messages, not crash.
- **Very large date range with many trades**: The system MUST handle 100+ trades without UI degradation.
- **Identical entry and exit conditions**: If both fire on the same candle while not in a position, entry takes priority (you can't exit what you don't have).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (VT-REQ-1)**: System MUST parse natural language trading strategy descriptions into a validated JSON rule set via a single AI API call, returning either a valid rule set or a friendly error with example suggestions.
- **FR-002 (VT-REQ-2)**: System MUST display parsed rules as human-readable cards with warnings, parser confidence, and a JSON editor toggle. Users MUST explicitly confirm before any backtest executes.
- **FR-003 (VT-REQ-3)**: System MUST execute deterministic backtests where identical inputs always produce identical outputs, with no randomness and no network dependency for computation.
- **FR-004 (VT-REQ-4)**: System MUST support two strategy modes: standard (signal-based entry/exit with technical indicators) and DCA (fixed-dollar periodic buys with additive position tracking).
- **FR-005 (VT-REQ-5)**: System MUST render candlestick charts with trade entry/exit markers and indicator overlays, plus equity curve charts comparing strategy performance against a buy-and-hold benchmark using identical fee assumptions.
- **FR-006 (VT-REQ-6)**: System MUST compute and display 12+ performance metrics (total return, CAGR, Sharpe, Sortino, max drawdown, max DD duration, win rate, profit factor, avg win/loss, best/worst trade, avg holding period, exposure time, total trades) and a sortable trade log.
- **FR-007 (VT-REQ-7)**: System MUST display an audit panel showing all execution assumptions: fee/slippage rates, warmup candles, execution model, annualization factor, risk-free rate, benchmark model, and position model.
- **FR-008 (VT-REQ-8)**: System MUST support comparison mode showing two strategies side-by-side with overlaid equity curves and metric deltas.
- **FR-009 (VT-REQ-9)**: System MUST include Demo Mode with 6 preset strategies and known-good run snapshots that work end-to-end without any AI or network dependency.
- **FR-010 (VT-REQ-10)**: System MUST support exporting results as JSON/CSV downloads and generating shareable URL-encoded snapshots.
- **FR-011 (VT-REQ-11)**: System MUST maintain session-level run history allowing users to click any previous run and restore its full results.
- **FR-012**: System MUST model execution without look-ahead bias: signals evaluate on candle[i] close, orders execute at candle[i+1] open with adverse slippage.
- **FR-013**: System MUST provide bundled historical daily OHLCV data for 8 cryptocurrencies (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX) requiring no runtime API calls.
- **FR-014**: System MUST support 6 technical indicator families: SMA, EMA, RSI, MACD (line/signal/histogram), Bollinger Bands (upper/middle/lower), ATR, plus pct_change and position-scope indicators (pnl_pct, bars_in_trade).
- **FR-015**: System MUST allow users to swap assets and re-run backtests instantly without network calls for computation.

### Key Entities

- **StrategyRuleSet**: The core data structure representing a parsed trading strategy. Contains a name, description, strategy mode (standard or DCA), entry conditions, exit conditions, position sizing, and parser metadata (confidence, warnings). Validated by schema at all external boundaries.
- **Condition**: A single trading rule with left operand, comparison operator, and right operand. Operands are either indicator references (with type and parameters) or numeric literals. Conditions have a scope (candle-level or position-level).
- **BacktestConfig**: The configuration for a backtest run: selected asset, date range, initial capital, fee/slippage rates, and the rule set to execute.
- **BacktestResult**: The complete output of a backtest: trade list, equity curve, performance metrics, benchmark comparison, computed indicator data, and audit information.
- **Trade**: A single completed trade with entry/exit dates and prices, P&L, holding period, exit reason, and position size.
- **PerformanceMetrics**: The suite of 12+ computed metrics derived from the trade list and equity curve.
- **DemoSnapshot**: A pre-configured combination of preset strategy + asset + date range that guarantees visually interesting results.

### Non-Functional Requirements

- **NFR-001 (Determinism)**: Given identical rule set, asset, date range, and configuration, the backtest engine MUST produce byte-for-byte identical results across runs, browsers, and machines.
- **NFR-002 (Instant Re-Run)**: Asset swap and re-run MUST complete without a user-perceptible delay (no loading spinners for computation). All backtest computation is client-side.
- **NFR-003 (Demo Resilience)**: The app MUST function end-to-end without any network connection via Demo Mode presets and known-good snapshots. No blank screens, no unhandled errors, no console errors.
- **NFR-004 (Data Independence)**: Historical OHLCV data MUST be bundled as static files (~200KB total for 8 assets). No runtime data API calls.
- **NFR-005 (Parse Speed)**: The AI parsing step MUST complete within 5 seconds for typical prompts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from typing a strategy to seeing full backtest results in under 60 seconds.
- **SC-002**: All 6 preset strategies produce non-zero trades and visually interesting charts when run with their known-good snapshot configurations.
- **SC-003**: The 2:30 demo script (type strategy → confirm → results → compare → swap asset → presets) can be executed without any failure or unexpected behavior.
- **SC-004**: The backtest engine produces identical results when the same inputs are provided on two separate runs.
- **SC-005**: The app works end-to-end with the network disconnected, using only preset strategies and bundled data.
- **SC-006**: All 12+ performance metrics are computed correctly as verified by unit tests with hand-calculated expected values.
- **SC-007**: The app displays zero console errors and zero unhandled promise rejections during a full demo run-through.
- **SC-008**: Switching from one asset to another while viewing results updates the display without any visible loading state for computation.

### Assumptions

- Historical OHLCV data is pre-downloaded from Binance public API and committed to the repository before the competition starts.
- Daily (1D) candle timeframe only for MVP. No intraday support.
- Long-only strategies. No shorting, no multiple simultaneous positions.
- No server-side persistence. All state is in-memory per browser session.
- Dark mode is the default and primary design target.
- The AI parser uses Claude Sonnet via a single server-side API route to keep the API key secure.

### Non-Goals

- No live trading or exchange integration.
- No real-money transactions or wallet connections.
- No intraday timeframes (daily only).
- No AI predictions, market opinions, or trade recommendations.
- No server-side data persistence.
- No shorting, no multiple simultaneous positions, no portfolio optimization.
- No trailing stop orders (approximated as fixed stop-loss if requested).
- No `between` operator (expressed as two AND conditions).
- No limit or stop-limit order types.
