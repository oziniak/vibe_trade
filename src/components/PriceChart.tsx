'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candle, Trade } from '@/types/results';
import {
  determineBucketGranularity,
  clusterMarkers,
  formatMarkerLabel,
} from '@/lib/marker-clustering';

interface PriceChartProps {
  candles: Candle[];
  trades: Trade[];
  indicatorData?: Record<string, (number | null)[]>;
  allCandles?: Candle[]; // full unfiltered candles for indicator alignment
}

// Color palettes for indicator overlays (dark mode optimized)
const SMA_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899'];
const EMA_COLORS = ['#fbbf24', '#a78bfa', '#22d3ee', '#34d399', '#fb923c', '#f472b6'];
// BB_COLOR is read dynamically from CSS --vt variable at render time
function getBBColor(): string {
  if (typeof document === 'undefined') return '#22c55e';
  return getComputedStyle(document.documentElement).getPropertyValue('--vt').trim() || '#22c55e';
}

/** Classify an indicator key into a renderable type */
function classifyIndicator(key: string): 'sma' | 'ema' | 'bb_upper' | 'bb_middle' | 'bb_lower' | 'skip' {
  if (key.startsWith('sma_')) return 'sma';
  if (key.startsWith('ema_')) return 'ema';
  if (key.startsWith('bb_upper_')) return 'bb_upper';
  if (key.startsWith('bb_middle_')) return 'bb_middle';
  if (key.startsWith('bb_lower_')) return 'bb_lower';
  // Skip RSI, MACD, and anything else (would need subplots)
  return 'skip';
}

export function PriceChart({ candles, trades, indicatorData, allCandles }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) {
      setIsLoading(false);
      return;
    }

    let disposed = false;
    let cleanupFn: (() => void) | undefined;

    import('lightweight-charts').then((lc) => {
      if (disposed || !containerRef.current) return;

      const { createChart, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } = lc;

      const chartHeight = window.innerWidth < 640 ? 280 : 400;

      const chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: '#0f172a' },
          textColor: '#94a3b8',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        width: containerRef.current!.clientWidth,
        height: chartHeight,
        timeScale: {
          borderColor: '#334155',
          timeVisible: false,
        },
        rightPriceScale: {
          borderColor: '#334155',
        },
        crosshair: {
          vertLine: { color: '#475569', width: 1, style: 3 },
          horzLine: { color: '#475569', width: 1, style: 3 },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      const chartData = candles.map((c) => ({
        time: c.t as string,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }));

      candleSeries.setData(chartData);

      let markerCleanup: (() => void) | undefined;

      if (trades.length > 0) {
        const validDates = new Set(candles.map((c) => c.t));

        // Collect raw buy/sell entries
        const buys: { time: string; price: number }[] = [];
        const sells: { time: string; price: number }[] = [];

        for (const trade of trades) {
          if (validDates.has(trade.entryDate)) {
            buys.push({ time: trade.entryDate, price: trade.entryPrice });
          }
          if (validDates.has(trade.exitDate)) {
            sells.push({ time: trade.exitDate, price: trade.exitPrice });
          }
        }

        // Merge markers that share the same date (e.g. DCA sells all on last candle)
        function mergeByDate(items: { time: string; price: number }[], side: 'buy' | 'sell') {
          const grouped = new Map<string, { count: number; totalPrice: number }>();
          for (const item of items) {
            const existing = grouped.get(item.time);
            if (existing) {
              existing.count++;
              existing.totalPrice += item.price;
            } else {
              grouped.set(item.time, { count: 1, totalPrice: item.price });
            }
          }
          return Array.from(grouped.entries()).map(([time, { count, totalPrice }]) => ({
            time,
            avgPrice: totalPrice / count,
            count,
            side,
          }));
        }

        const allMerged = [
          ...mergeByDate(buys, 'buy'),
          ...mergeByDate(sells, 'sell'),
        ].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

        // Create marker handle for efficient updates (no destroy/recreate)
        const markerHandle = createSeriesMarkers(candleSeries, []);

        let lastGranularity: string | null = null;

        function updateMarkers() {
          const logicalRange = chart.timeScale().getVisibleLogicalRange();
          const visibleBarCount = logicalRange
            ? Math.ceil(logicalRange.to - logicalRange.from)
            : candles.length;

          const granularity = determineBucketGranularity(visibleBarCount);

          // Skip recomputation if granularity unchanged (panning at same zoom)
          if (granularity === lastGranularity) return;
          lastGranularity = granularity;

          const buyMarkers = allMerged.filter((m) => m.side === 'buy');
          const sellMarkers = allMerged.filter((m) => m.side === 'sell');

          const clusteredBuys = clusterMarkers(buyMarkers, granularity);
          const clusteredSells = clusterMarkers(sellMarkers, granularity);

          type MarkerItem = {
            time: string;
            position: 'belowBar' | 'aboveBar';
            color: string;
            shape: 'arrowUp' | 'arrowDown';
            text: string;
          };

          const markers: MarkerItem[] = [];

          for (const c of clusteredBuys) {
            markers.push({
              time: c.time,
              position: 'belowBar',
              color: '#22c55e',
              shape: 'arrowUp',
              text: formatMarkerLabel(c),
            });
          }

          for (const c of clusteredSells) {
            markers.push({
              time: c.time,
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'arrowDown',
              text: formatMarkerLabel(c),
            });
          }

          markers.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
          markerHandle.setMarkers(markers);
        }

        // Initial render
        updateMarkers();

        // Debounced handler for zoom/pan changes
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedUpdate = () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(updateMarkers, 100);
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(debouncedUpdate);

        markerCleanup = () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(debouncedUpdate);
        };
      }

      if (indicatorData && allCandles && allCandles.length > 0) {
        // Build a date-to-index map for the full (unfiltered) candle set
        const allCandleDateToIdx = new Map<string, number>();
        allCandles.forEach((c, i) => allCandleDateToIdx.set(c.t, i));

        // Track color assignment for SMA/EMA
        let smaColorIdx = 0;
        let emaColorIdx = 0;

        const sortedKeys = Object.keys(indicatorData).sort();

        for (const key of sortedKeys) {
          const indicatorType = classifyIndicator(key);
          if (indicatorType === 'skip') continue;

          const values = indicatorData[key];
          if (!values || values.length === 0) continue;

          // Determine line style and color
          let color: string;
          let lineStyle = 0; // 0 = Solid
          let lineWidth = 1;

          switch (indicatorType) {
            case 'sma':
              color = SMA_COLORS[smaColorIdx % SMA_COLORS.length];
              smaColorIdx++;
              lineWidth = 1;
              break;
            case 'ema':
              color = EMA_COLORS[emaColorIdx % EMA_COLORS.length];
              emaColorIdx++;
              lineWidth = 1;
              break;
            case 'bb_upper':
              color = getBBColor();
              lineStyle = 2; // Dashed
              lineWidth = 1;
              break;
            case 'bb_lower':
              color = getBBColor();
              lineStyle = 2; // Dashed
              lineWidth = 1;
              break;
            case 'bb_middle':
              color = getBBColor();
              lineStyle = 0; // Solid
              lineWidth = 1;
              break;
          }

          // Build line data by aligning indicator array indices with filtered candle dates
          const lineData: { time: string; value: number }[] = [];

          for (const candle of candles) {
            const fullIdx = allCandleDateToIdx.get(candle.t);
            if (fullIdx === undefined) continue;
            if (fullIdx >= values.length) continue;

            const val = values[fullIdx];
            if (val === null || val === undefined) continue;

            lineData.push({ time: candle.t, value: val });
          }

          if (lineData.length === 0) continue;

          const lineSeries = chart.addSeries(LineSeries, {
            color,
            lineWidth: lineWidth as 1 | 2 | 3 | 4,
            lineStyle,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            title: key.replace(/_/g, ' ').toUpperCase(),
          });

          lineSeries.setData(lineData);
        }
      }

      chart.timeScale().fitContent();

      const container = containerRef.current!;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          if (width > 0) {
            chart.applyOptions({ width });
          }
        }
      });

      resizeObserver.observe(container);

      setIsLoading(false);

      cleanupFn = () => {
        if (markerCleanup) markerCleanup();
        resizeObserver.unobserve(container);
        resizeObserver.disconnect();
        chart.remove();
      };
    });

    return () => {
      disposed = true;
      if (cleanupFn) cleanupFn();
    };
  }, [candles, trades, indicatorData, allCandles]);

  if (candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-vt-line/50 bg-vt-bg2/50">
        <p className="text-sm text-slate-500">No candle data available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-vt-bg2/80 rounded-lg">
          <div className="flex items-center gap-2 text-slate-400">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading chart...
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-vt-line/50"
      />
    </div>
  );
}
