/**
 * Fetch historical daily OHLCV data from Binance public API.
 *
 * Assets: BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX
 * Interval: 1d
 * Range: 2020-01-01 to present
 *
 * Output: public/data/{ASSET}_1D.json
 *
 * Usage: npx tsx scripts/fetch-data.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"];
const INTERVAL = "1d";
const LIMIT = 1000; // Binance max per request
const START_MS = new Date("2020-01-01T00:00:00Z").getTime();
const BASE_URL = "https://api.binance.com/api/v3/klines";
const OUT_DIR = join(__dirname, "..", "public", "data");
const DELAY_MS = 350; // pause between HTTP requests to avoid rate-limits

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Candle {
  t: string; // "YYYY-MM-DD"
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// Binance kline tuple indices
// [0] openTime, [1] open, [2] high, [3] low, [4] close, [5] volume,
// [6] closeTime, ...

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Fetch all klines for one asset (paginated)
// ---------------------------------------------------------------------------

async function fetchAsset(asset: string): Promise<Candle[]> {
  const symbol = `${asset}USDT`;
  const candles: Candle[] = [];
  let startTime = START_MS;

  while (true) {
    const url = `${BASE_URL}?symbol=${symbol}&interval=${INTERVAL}&limit=${LIMIT}&startTime=${startTime}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Binance API error for ${symbol}: ${res.status} ${res.statusText} – ${body}`
      );
    }

    const klines: unknown[][] = await res.json();

    if (klines.length === 0) break;

    for (const k of klines) {
      candles.push({
        t: formatDate(k[0] as number),
        o: parseFloat(k[1] as string),
        h: parseFloat(k[2] as string),
        l: parseFloat(k[3] as string),
        c: parseFloat(k[4] as string),
        v: parseFloat(k[5] as string),
      });
    }

    // Next page: start right after the last closeTime
    const lastCloseTime = klines[klines.length - 1][6] as number;
    startTime = lastCloseTime + 1;

    // If we received fewer than LIMIT rows, we've reached the end
    if (klines.length < LIMIT) break;

    await sleep(DELAY_MS);
  }

  return candles;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching daily OHLCV data for ${ASSETS.length} assets …`);
  console.log(`Output directory: ${OUT_DIR}\n`);

  for (const asset of ASSETS) {
    process.stdout.write(`  ${asset} … `);
    const candles = await fetchAsset(asset);
    const outPath = join(OUT_DIR, `${asset}_1D.json`);
    writeFileSync(outPath, JSON.stringify(candles, null, 2));
    console.log(
      `${candles.length} candles  (${candles[0]?.t} → ${candles[candles.length - 1]?.t})`
    );

    // Delay before next asset
    await sleep(DELAY_MS);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
