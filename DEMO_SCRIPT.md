# Vibe Trade Demo Script — 2:30 Produced Video

## Format: Text Cards + Music + Optional AI Voiceover

**Base layer:** Text cards between screen recordings + ambient/lo-fi music throughout.

**AI Voiceover (optional, recommended):** AI-generated narration layered on top. This gives you the best of both worlds — professional-sounding voice without recording pressure. Tools like ElevenLabs, CapCut's built-in AI voice, or PlayHT can generate natural narration from text. You can always record text-cards-only first, then add AI voice as a second pass.

**Music:** Something with a clean beat drop around 0:08 when the app appears. Lo-fi hip hop or minimal electronic. CapCut has royalty-free options.

---

## The Script

> Each section shows: timestamp, screen actions, text overlay, and narration (if using AI voice).

### [0:00 – 0:05] TITLE CARD (black screen)
**Text:** *"Everyone has trading ideas. Almost nobody tests them."*
Fade in. Hold 3 seconds. Fade to app.

**Narration:** "Everyone in crypto has trading ideas. Almost nobody tests them."

### [0:05 – 0:08] APP REVEAL
- App loads. Animated candlestick background is visible, particles floating.
- Empty input screen. Clean dark UI.
- **No text overlay** — let the design speak.

### [0:08 – 0:30] FIRST STRATEGY — THE CORE LOOP
1. **Type** (sped up slightly in CapCut): `Buy BTC when RSI drops below 30, sell when it goes above 70`
2. Click **Parse Strategy**
3. Show the custom loading spinner (candlestick bars + scanning laser) — hold ~2 sec, it looks great
4. **Rules appear** as cards: Entry: RSI(14) < 30 / Exit: RSI(14) > 70
5. Click **Run Backtest**
6. **Results explode in:**
   - Metrics animate with NumberFlow (staggered counting-up)
   - Candlestick chart renders with green/red trade markers
   - Equity curve draws: strategy line vs buy-and-hold dashed line

**Text overlay:** *"Type a strategy in plain English. AI parses it. Math does the rest."*

**Narration:** "Vibe Trade lets you describe a trading strategy in plain English. AI parses it into structured rules. Then pure math does the rest."

### [0:30 – 0:50] RESULTS TOUR — QUICK CUTS
Quick cuts through the dashboard (3-4 seconds each):

1. **Candlestick chart** — zoom in to show trade markers (green arrows = buys, red = sells). Zoom out to show marker clustering.
2. **Equity curve** — hover to show tooltip syncing between equity and drawdown panels
3. **Metrics grid** — brief pause on the headline: "Strategy: +XX% vs Buy & Hold: +XX%"
4. **Click "Rules"** — slide panel opens. Click the JSON tab to flash the raw validated schema.

**Text overlay:** *"15 metrics. Trade-by-trade log. Every number is auditable."*

**Narration:** "Candlestick chart with every trade marked. Equity curve versus buy-and-hold. Fifteen performance metrics, and every number is auditable."

### [0:50 – 1:00] AUDIT PANEL — THE TRUST MOMENT
This section shows the app is serious, not a toy.

1. **Expand the Audit Panel** at the bottom of results
2. Hold for 3–4 seconds so viewers can read:
   - "Signal on close[i], execution on open[i+1]" (no lookahead)
   - Fee: 10 bps / Slippage: 5 bps
   - "Benchmark uses identical fee assumptions"

**Text overlay:** *"No lookahead bias. Fees modeled. Benchmark uses the same assumptions."*

**Narration:** "No lookahead bias. Fees and slippage modeled. The benchmark uses the exact same assumptions. Transparent and honest."

### [1:00 – 1:15] TITLE CARD + COMPARISON
**Text card (1.5 sec):** *"But how does it compare to just DCAing?"*

1. Scroll to **Compare section**
2. Click the **"Weekly DCA"** preset chip (one click — fast)
3. Loading spinner briefly
4. **Comparison view appears:**
   - Three overlaid equity curves (Strategy A, Strategy B, Buy & Hold)
   - Side-by-side metrics with delta arrows (green/red showing which wins)

**Text overlay:** *"Compare any two strategies. See exactly where one beats the other."*

**Narration:** "But what if you just DCA'd instead? One click — both strategies run side by side. Overlaid equity curves. Metric-by-metric comparison with arrows showing who wins."

### [1:15 – 1:35] THE INSTANT SWAP — THE FLEX
This is the money shot. Record it clean.

1. Click **ETH** in the asset pill bar
2. **Both strategies re-run INSTANTLY** — no spinner, no network call, results just change
3. Metrics re-animate. Charts redraw. Different numbers.
4. Click **SOL** — instant again
5. Click **DOGE** — instant again

**Text overlay:** *"Swap asset. Instant re-run. Zero network calls. Pure client-side math."*

**Narration:** "Now swap the asset. Ethereum — instant. Solana — instant. Dogecoin — instant. No loading, no network calls. The entire backtest engine runs in your browser."

### [1:35 – 1:50] THEME + PRESETS + HISTORY
1. Click through the **4 theme colors** in the header (green → amber → cyan → copper) — the entire UI shifts instantly
2. Open the **slide panel**
3. Show the 6 preset strategies + 4 quick demos
4. Scroll to **Run History** — click one item, results restore instantly

**Text overlay:** *"4 themes. 6 presets. Full run history. Share via URL."*

**Narration:** "Four color themes. Six built-in presets for beginners. Your full run history, one click to restore. And you can share any result as a URL."

### [1:50 – 2:00] THE ARCHITECTURE — WHY THIS ISN'T A TOY
**Black screen. Animated diagram builds step by step:**

```
  "Buy when RSI < 30"  →  AI Parser  →  Validated JSON Schema  →  ENGINE
                                              (Zod)                  ↓
                                                              ┌──────────────┐
                                                              │  Backtesting │ ← you are here
                                                              │  Live Trading│
                                                              │  Alerts      │
                                                              │  Screening   │
                                                              └──────────────┘
```

**Text overlay:** *"AI translates. The engine executes. Same schema powers everything."*

**Narration:** "Here's the key insight. AI only does one thing — translate plain English into a validated rule schema. Everything after that is a deterministic engine. No AI in the loop. No hallucinations. Pure math. And that same schema — the exact same JSON — can power live trading, real-time alerts, portfolio screening. The backtest demo is one interface. The engine is the product."

### [2:00 – 2:08] TITLE CARD — THE CLOSER
**Black screen. Text fades in line by line:**
*"AI is the translator, not the engine."*
Hold 2 seconds.
*"The engine is the product."*

**Narration:** "AI is the translator — not the engine. The engine is the product."

### [2:08 – 2:20] STATS CARD
**Black screen. Stats appear one by one (staggered fade-in):**
- 203 unit tests — production-grade reliability
- 8 crypto assets, 6 years of daily data
- 15 performance metrics
- 7 indicator families
- Zero runtime dependencies for compute
- One validated JSON schema to rule them all

**Narration:** "Two hundred and three unit tests. Eight assets. Fifteen metrics. Seven indicator families. Zero runtime dependencies. And one validated schema that can plug into anything."

### [2:20 – 2:30] END CARD
**Logo + links:**
- Vibe Trade logo
- `vibe-trade-lime.vercel.app`
- `github.com/oziniak/vibe_trade`
- *"One week. One developer. Claude Code."*
- *Built with Claude Code*

---

## Recording Tips for CapCut

1. **Record each section separately** — easier to re-take and edit
2. **Speed up typing in CapCut** (1.5–2x) — nobody wants to watch you type
3. **Use CapCut's zoom/crop** to focus on specific UI areas during quick cuts
4. **The asset swap sequence (1:15–1:35) is THE money shot** — record it clean, 2-3 takes
5. **Screen resolution:** Record at highest resolution. The dark UI looks gorgeous.
6. **Browser:** Chrome. Hide bookmarks bar. Clean URL bar. No extensions visible.
7. **Before recording:** Clear notifications, hide dock, Do Not Disturb mode
8. **Pre-warm the app:** Run one backtest before recording so data is cached and the first run is snappy

## AI Voiceover Tips

- **CapCut has built-in AI narration** — paste the narration text, pick a voice, done
- Alternatively: ElevenLabs or PlayHT for more natural voices
- Record the video with text cards first, then add voice as a second pass
- Keep the voice calm and confident, not hype-y — let the product do the flexing
- Total narration is ~200 words = well under 2 minutes of speaking at natural pace

## Why This Script Wins

| Timestamp | Moment | Why It Hits |
|-----------|--------|-------------|
| 0:05 | App reveal with particle background | Visually different from every other demo |
| 0:25 | NumberFlow metrics counting up | Satisfying, polished, memorable |
| 0:50 | Audit panel | Shows engineering rigor, not just pretty UI |
| 1:05 | Comparison with overlaid curves | "Oh, you can do THAT?" moment |
| 1:15 | Instant asset swap × 3 | The technical flex — no spinner, pure client-side |
| 1:50 | Architecture diagram: schema → many outputs | **THE selling point** — judges see this isn't a toy, it's a platform |
| 2:00 | "The engine is the product" | Reframes the entire demo — what they saw was just one UI |
| 2:08 | "One schema to rule them all" | Signals unlimited extensibility with zero AI risk |
