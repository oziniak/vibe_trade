# Vibe Trade

**Crypto Strategy Backtester** -- Describe a trading strategy in plain English, backtest it on real crypto data, and see professional analytics instantly.

Built as a competition entry for the [XBO Claude Code Challenge](https://xbo.com) (Feb 20-27, 2026).

## What It Does

1. **Describe** a strategy in natural language ("Buy BTC when RSI drops below 30, sell when it goes above 70")
2. **Review** AI-parsed rules displayed as readable cards with a JSON editor toggle
3. **Backtest** on real daily OHLCV data for 8 assets (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX) from 2020-2025
4. **Analyze** with professional charts (candlestick with trade markers, equity curve vs benchmark), 15 performance metrics, and full trade log
5. **Compare** two strategies side-by-side with overlaid equity curves and metric deltas
6. **Share** results via URL or export to CSV/JSON

## Key Features

- Two strategy modes: **Signal-based** (technical indicators) and **DCA** (dollar-cost averaging)
- 7 technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, % Change
- Anti-lookahead execution model: signal on close[i], execute at open[i+1]
- Fees and slippage modeled for credible results
- Buy-and-hold benchmark with identical fee assumptions
- Demo Mode with 6 presets and 4 known-good snapshots -- works fully offline
- Instant asset swap and re-run (all computation is client-side)
- Dark mode first design

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Charts**: TradingView lightweight-charts v5 (candlestick) + Recharts v3 (equity curves)
- **AI Parser**: Claude API (Sonnet) -- one network call, then pure deterministic math
- **Validation**: Zod v4 for all boundaries
- **Testing**: Vitest (203 unit tests across 14 test files)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
git clone <repo-url>
cd vibe-trade
pnpm install
```

### Environment

Create `.env.local` with:

```
ANTHROPIC_API_KEY=your-api-key-here
```

The API key is only needed for AI-powered strategy parsing. Demo mode presets work without it.

### Development

```bash
pnpm dev
```

### Testing

```bash
pnpm test           # Run all 203 unit tests
pnpm test:watch     # Watch mode
```

### Build

```bash
pnpm build
```

## Architecture

```
src/
├── types/          # Zod schemas + TypeScript types (strategy.ts, results.ts)
├── indicators/     # Pure functions: SMA, EMA, RSI, MACD, Bollinger, ATR, pctChange
├── engine/         # Backtest engine (standard + DCA modes), evaluator, benchmark
├── metrics/        # Performance metrics calculator (15 metrics)
├── data/           # Presets, snapshots, data loader
├── lib/            # AI parser, export utilities, formatting
├── components/     # React components (all UI)
└── app/            # Next.js App Router (page, layout, API route)
```

**Module dependency flow**: `types -> indicators -> engine -> metrics -> UI`

No circular dependencies. AI is the translator (NL -> JSON), not the engine.

## Testing

203 unit tests covering:

- All 7 indicator families with hand-calculated expected values
- Condition evaluator (53 tests) including cross detection
- Backtest engine: standard mode, DCA mode, no-lookahead verification
- Metrics calculator (31 tests) including edge cases
- Schema invariant validation (19 tests)

## License

MIT
