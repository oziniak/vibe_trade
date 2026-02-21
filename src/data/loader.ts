import type { Candle } from '@/types/results';
import type { AssetSymbol } from '@/types/strategy';

const cache = new Map<AssetSymbol, Candle[]>();

/** Load OHLCV data for an asset, caching in memory */
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

/** Clear the candle cache */
export function clearCandleCache(): void {
  cache.clear();
}
