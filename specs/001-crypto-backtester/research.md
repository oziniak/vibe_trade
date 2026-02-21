# Research: Vibe Trade — Crypto Strategy Backtester

**Date**: 2026-02-21
**Feature**: [spec.md](./spec.md)

## 1. TradingView lightweight-charts v5

### API Surface

- **Package**: `lightweight-charts` (v5.x)
- **Import**: `import { createChart, ColorType, LineStyle } from 'lightweight-charts'`
- **Chart creation**: `createChart(containerRef, { width, height, layout, grid, ... })`
- **Candlestick series**: `chart.addCandlestickSeries({ upColor, downColor, borderUpColor, borderDownColor, wickUpColor, wickDownColor })`
- **Data format**: `{ time: 'YYYY-MM-DD', open, high, low, close }` — `time` accepts ISO date strings directly.

### Markers (Trade Entry/Exit)

```typescript
series.setMarkers([
  {
    time: '2023-01-15',
    position: 'belowBar',   // 'aboveBar' | 'belowBar' | 'inBar'
    color: '#22c55e',
    shape: 'arrowUp',       // 'arrowUp' | 'arrowDown' | 'circle' | 'square'
    text: 'BUY',
  },
  {
    time: '2023-03-20',
    position: 'aboveBar',
    color: '#ef4444',
    shape: 'arrowDown',
    text: 'SELL',
  },
]);
```

Markers must be sorted by `time` in ascending order.

### Line Overlays (SMA/EMA/Bollinger)

```typescript
const smaLine = chart.addLineSeries({
  color: '#f59e0b',
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
});
smaLine.setData(smaData.map((v, i) => ({
  time: candles[i].time,
  value: v,
})).filter(d => d.value !== null));
```

Bollinger Bands: add 3 `LineSeries` (upper, middle, lower) with different colors/styles.

### Dark Mode Configuration

```typescript
const chart = createChart(container, {
  layout: {
    background: { type: ColorType.Solid, color: '#0f172a' },
    textColor: '#94a3b8',
  },
  grid: {
    vertLines: { color: '#1e293b' },
    horzLines: { color: '#1e293b' },
  },
  crosshair: {
    vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
    horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
  },
  timeScale: {
    borderColor: '#334155',
    timeVisible: false,
  },
  rightPriceScale: {
    borderColor: '#334155',
  },
});
```

### React Integration

Use a `useRef` for the container div, create chart in `useEffect`, and return a cleanup function calling `chart.remove()`. The chart is imperative (not declarative React) — this is the standard approach.

```typescript
useEffect(() => {
  const chart = createChart(containerRef.current!, { ... });
  const series = chart.addCandlestickSeries({ ... });
  series.setData(data);
  chart.timeScale().fitContent();
  return () => chart.remove();
}, [data]);
```

### Responsive Sizing

```typescript
const resizeObserver = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  chart.applyOptions({ width, height });
});
resizeObserver.observe(containerRef.current!);
// Clean up in useEffect return
```

---

## 2. shadcn/ui + Next.js App Router

### Setup

```bash
pnpm create next-app@latest vibe-trade --typescript --tailwind --eslint --app --src-dir
pnpm dlx shadcn@latest init
```

Configuration: New York style, Slate base, CSS variables enabled.

### Key Components to Install

```bash
pnpm dlx shadcn@latest add button card input label select tabs badge
pnpm dlx shadcn@latest add table dialog collapsible textarea tooltip
```

Components install to `src/components/ui/` as editable source files.

### Dark Mode

Configure in `tailwind.config.ts`:
```typescript
darkMode: 'class'
```

Add `className="dark"` to `<html>` tag in `layout.tsx`. Dark mode is the default.

### Layout Pattern

- Use CSS Grid or Flexbox for the two-panel layout (left sidebar + main area).
- `<Card>` for metric displays, preset cards, audit panel.
- `<Tabs>` for switching between card view and JSON editor in rule confirmation.
- `<Table>` for trade log.
- `<Collapsible>` for audit panel.
- `<Select>` for asset dropdown.
- `<Badge>` for confidence indicators and strategy mode tags.

---

## 3. Recharts for Equity Curves & Analytics

### Import Pattern

```typescript
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
```

### Equity Curve (Strategy vs Benchmark)

- Use `<ComposedChart>` with two `<Area>` children.
- Strategy: solid green line with gradient fill (`#22c55e`).
- Benchmark: dashed indigo line with subtle gradient (`#6366f1`, `strokeDasharray="5 3"`).
- SVG `<defs>` with `<linearGradient>` for fade-to-transparent fills.
- `type="monotone"` for smooth curves, `dot={false}` for dense data.

### Drawdown Chart

- `<Area baseValue={0}>` fills between the data line and y=0.
- `domain={['dataMin', 0]}` on YAxis locks top at zero.
- `<ReferenceLine y={0}>` draws a clean zero line.
- Red color scheme (`#ef4444`).

### Dark Mode Styling

Recharts has no built-in dark mode. Style via props on each component:
- `CartesianGrid`: `stroke="#334155"`, `vertical={false}`
- `XAxis/YAxis`: `stroke="#94a3b8"`, `tick={{ fill: '#94a3b8' }}`
- Custom `<Tooltip>` with dark background (`#1e293b`), border (`#475569`)

### Synchronized Charts

Use `syncId="backtest"` on both equity and drawdown charts for linked hover tooltips.

### Responsive Container

```typescript
<div className="h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={data}>...</ComposedChart>
  </ResponsiveContainer>
</div>
```

Must have explicit parent height. `ResponsiveContainer` needs exactly one child.

---

## 4. Claude API — Next.js API Route

### API Route Structure

```typescript
// src/app/api/parse/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function POST(request: NextRequest) {
  const { prompt, asset, timeframe } = await request.json();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,  // full system prompt with schema + few-shot examples
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content
  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Strip markdown fences if present
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();

  // Parse → Zod validate → invariant check → confidence check
  // Return success/failure response
}
```

### Key Points

- `@anthropic-ai/sdk` reads `ANTHROPIC_API_KEY` from `process.env` automatically.
- Server-side only (App Router `route.ts`) — API key never exposed to client.
- Use `claude-sonnet-4-20250514` for fast structured output (~1s).
- Validation pipeline: `JSON.parse()` → `StrategyRuleSet.safeParse()` → `validateRuleSetInvariants()` → confidence check.
- Retry once on JSON parse failure with a correction prompt.

---

## 5. Vercel Deployment

### Configuration

- Next.js App Router deploys to Vercel with zero config (`vercel` CLI or `git push`).
- Environment variable: `ANTHROPIC_API_KEY` set in Vercel dashboard (Settings → Environment Variables).
- API route (`/api/parse`) runs as a serverless function automatically.
- Static files in `/public/data/` are served from Vercel's CDN.

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // No special config needed for MVP
  // Static data files in /public/ are served automatically
};
module.exports = nextConfig;
```

### Deployment Steps

```bash
pnpm i -g vercel
vercel --prod
```

Or connect GitHub repo for auto-deploy on push.

### Performance Considerations

- `/public/data/*.json` files (~200KB total) are cached by Vercel CDN.
- API route cold start is ~1-2s, but subsequent calls are fast.
- Client-side computation has no serverless function timeout concerns.
