'use client';

import { useEffect, useState } from 'react';
import type { AssetSymbol } from '@/types/strategy';
import type { Candle, Trade } from '@/types/results';
import { loadCandles, getCachedCandles } from '@/data/loader';
import { PriceChart } from '@/components/PriceChart';

export function ChartWithData({
  asset,
  startDate,
  endDate,
  trades,
  indicatorData,
  lockZoom,
}: {
  asset: AssetSymbol;
  startDate: string;
  endDate: string;
  trades: Trade[];
  indicatorData?: Record<string, (number | null)[]>;
  lockZoom?: boolean;
}) {
  const [candles, setCandles] = useState<Candle[]>(() => {
    // Synchronous cache check — avoids loading flash for cached assets
    const cached = getCachedCandles(asset);
    if (cached) {
      return cached.filter((c) => c.t >= startDate && c.t <= endDate);
    }
    return [];
  });
  const [loading, setLoading] = useState(() => !getCachedCandles(asset));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    // Sync path: if data is already cached, set it immediately — no spinner
    const cached = getCachedCandles(asset);
    if (cached) {
      const filtered = cached.filter((c) => c.t >= startDate && c.t <= endDate);
      setCandles(filtered);
      setLoading(false);
      return;
    }

    // Async path: data not yet cached
    setLoading(true);

    loadCandles(asset)
      .then((allCandles) => {
        if (cancelled) return;
        const filtered = allCandles.filter((c) => c.t >= startDate && c.t <= endDate);
        setCandles(filtered);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [asset, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-vt-line/50 bg-vt-bg2/50">
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading chart data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-red-500/30 bg-red-500/5">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <PriceChart
      candles={candles}
      trades={trades}
      indicatorData={indicatorData}
      lockZoom={false}
    />
  );
}
