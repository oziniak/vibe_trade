# Quickstart: Vibe Trade — Crypto Strategy Backtester

**Date**: 2026-02-21
**Feature**: [spec.md](./spec.md)

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Anthropic API key (for AI parsing; not needed for Demo Mode)

## Setup

```bash
# Clone and install
git clone <repo-url>
cd vibe-trade
pnpm install

# Environment variables
cp .env.example .env.local
# Add ANTHROPIC_API_KEY=sk-ant-... to .env.local

# Start development server
pnpm dev
```

App runs at `http://localhost:3000`.

## Project Initialization (from scratch)

```bash
# Create Next.js app
pnpm create next-app@latest vibe-trade --typescript --tailwind --eslint --app --src-dir
cd vibe-trade

# Install core dependencies
pnpm add zod @anthropic-ai/sdk recharts lightweight-charts

# Install dev dependencies
pnpm add -D vitest @testing-library/react

# Initialize shadcn/ui
pnpm dlx shadcn@latest init
# Select: New York style, Slate base, CSS variables

# Install shadcn components
pnpm dlx shadcn@latest add button card input label select tabs badge table dialog collapsible textarea tooltip

# Create project structure
mkdir -p src/{engine,indicators,metrics,types,data,lib}
mkdir -p src/app/api/parse
mkdir -p public/data
mkdir -p __tests__/{indicators,engine,metrics}
mkdir -p scripts
```

## Data Setup

Historical OHLCV data for 8 assets must be placed in `/public/data/`:

```
public/data/
├── BTC_1D.json
├── ETH_1D.json
├── SOL_1D.json
├── BNB_1D.json
├── XRP_1D.json
├── DOGE_1D.json
├── ADA_1D.json
└── AVAX_1D.json
```

Data format: `[{ "t": "YYYY-MM-DD", "o": float, "h": float, "l": float, "c": float, "v": float }, ...]`

To regenerate data:
```bash
pnpm ts-node scripts/fetch-data.ts
```

## Testing

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test -- __tests__/indicators/sma.test.ts
```

## Build & Deploy

```bash
# Build for production
pnpm build

# Deploy to Vercel
pnpm i -g vercel
vercel --prod
```

Set `ANTHROPIC_API_KEY` in Vercel dashboard: Settings → Environment Variables.

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests |
| `pnpm lint` | Run ESLint |

## Module Dependency Order

Implementation should follow this dependency chain:

```
types/ (Zod schemas + TS types)
  → indicators/ (pure functions, no deps except types)
  → engine/ (imports types + indicators)
  → metrics/ (imports types, operates on engine output)
  → data/ (loader + presets, imports types)
  → lib/ (parser, imports types + data)
  → components/ (imports everything above)
  → app/ (imports components + lib)
```

No circular dependencies. Lower layers never import from higher layers.
