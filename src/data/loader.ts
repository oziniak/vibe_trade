import type { Candle } from '@/types/results';
import type { AssetSymbol } from '@/types/strategy';
import { AssetSymbolSchema } from '@/types/strategy';

const cache = new Map<AssetSymbol, Candle[]>();

export async function loadCandles(asset: AssetSymbol): Promise<Candle[]> {
  const cached = cache.get(asset);
  if (cached) return cached;

  const res = await fetch(`/data/${asset}_1D.json`);
  if (!res.ok) {
    throw new Error(`Failed to load data for ${asset}: ${res.status}`);
  }
  const candles: Candle[] = await res.json();
  cache.set(asset, candles);
  return candles;
}

/** Synchronous cache lookup — returns undefined if not yet fetched. */
export function getCachedCandles(asset: AssetSymbol): Candle[] | undefined {
  return cache.get(asset);
}

/** Fire-and-forget: prefetch OHLCV data for all 8 assets into cache. */
export function prefetchAllCandles(): void {
  for (const asset of AssetSymbolSchema.options) {
    if (!cache.has(asset)) {
      loadCandles(asset).catch(() => {/* swallow — non-critical */});
    }
  }
}

export function clearCandleCache(): void {
  cache.clear();
}
