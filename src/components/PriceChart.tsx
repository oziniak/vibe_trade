'use client';

import { useEffect, useRef, useState, memo } from 'react';
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
}

// Color palettes for indicator overlays (dark mode optimized)
const SMA_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899'];
const EMA_COLORS = ['#fbbf24', '#a78bfa', '#22d3ee', '#34d399', '#fb923c', '#f472b6'];
// Bollinger Band color — hardcoded hex because lightweight-charts cannot parse
// CSS LAB/OKLCH color strings returned by getComputedStyle for --vt.
const BB_COLOR = '#22c55e';

/** Classify an indicator key into a renderable type */
function classifyIndicator(key: string): 'sma' | 'ema' | 'bb_upper' | 'bb_middle' | 'bb_lower' | 'skip' {
  if (key.startsWith('sma_')) return 'sma';
  if (key.startsWith('ema_')) return 'ema';
  if (key.startsWith('bb_upper_')) return 'bb_upper';
  if (key.startsWith('bb_middle_')) return 'bb_middle';
  if (key.startsWith('bb_lower_')) return 'bb_lower';
  return 'skip';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LCModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeriesInstance = any;

interface PendingData {
  candles: Candle[];
  trades: Trade[];
  indicatorData?: Record<string, (number | null)[]>;
}

/**
 * Apply candle data, markers, and indicator overlays to the chart.
 * Called both on initial mount and on subsequent data updates.
 */
function applyData(
  chart: ChartInstance,
  candleSeries: SeriesInstance,
  lc: LCModule,
  candles: Candle[],
  trades: Trade[],
  indicatorData: Record<string, (number | null)[]> | undefined,
  indicatorSeriesRef: React.MutableRefObject<SeriesInstance[]>,
  markerHandleRef: React.MutableRefObject<{ setMarkers: (m: unknown[]) => void } | null>,
  markerCleanupRef: React.MutableRefObject<(() => void) | null>,
) {
  const { LineSeries, createSeriesMarkers } = lc;

  // 1. Update candle data in-place
  const chartData = candles.map((c) => ({
    time: c.t as string,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
  candleSeries.setData(chartData);

  // 2. Clean up old marker subscription (but keep the handle alive)
  if (markerCleanupRef.current) {
    markerCleanupRef.current();
    markerCleanupRef.current = null;
  }

  // 3. Clean up old indicator line series
  for (const series of indicatorSeriesRef.current) {
    chart.removeSeries(series);
  }
  indicatorSeriesRef.current = [];

  // 4. Create/update markers
  if (trades.length > 0) {
    const validDates = new Set(candles.map((c) => c.t));
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

    // Reuse existing marker handle to avoid stacking primitives on the series
    const markerHandle = markerHandleRef.current ?? createSeriesMarkers(candleSeries, []);
    markerHandleRef.current = markerHandle;

    let lastGranularity: string | null = null;

    function updateMarkers() {
      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      const visibleBarCount = logicalRange
        ? Math.ceil(logicalRange.to - logicalRange.from)
        : candles.length;

      const granularity = determineBucketGranularity(visibleBarCount);
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

    updateMarkers();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateMarkers, 100);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(debouncedUpdate);

    markerCleanupRef.current = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(debouncedUpdate);
    };
  } else if (markerHandleRef.current) {
    // No trades for this asset — clear stale markers from previous data
    markerHandleRef.current.setMarkers([]);
  }

  // 5. Add indicator overlays
  if (indicatorData && candles.length > 0) {
    let smaColorIdx = 0;
    let emaColorIdx = 0;

    const sortedKeys = Object.keys(indicatorData).sort();

    for (const key of sortedKeys) {
      const indicatorType = classifyIndicator(key);
      if (indicatorType === 'skip') continue;

      const values = indicatorData[key];
      if (!values || values.length === 0) continue;

      let color: string;
      let lineStyle = 0;
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
          color = BB_COLOR;
          lineStyle = 2;
          lineWidth = 1;
          break;
        case 'bb_lower':
          color = BB_COLOR;
          lineStyle = 2;
          lineWidth = 1;
          break;
        case 'bb_middle':
          color = BB_COLOR;
          lineStyle = 0;
          lineWidth = 1;
          break;
      }

      const lineData: { time: string; value: number }[] = [];
      for (let i = 0; i < candles.length && i < values.length; i++) {
        const val = values[i];
        if (val === null || val === undefined) continue;
        lineData.push({ time: candles[i].t, value: val });
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
      indicatorSeriesRef.current.push(lineSeries);
    }
  }

  // 6. Set visible range
  const totalBars = chartData.length;
  if (totalBars > 30) {
    chart.timeScale().setVisibleLogicalRange({
      from: Math.floor(totalBars * 0.2),
      to: totalBars - 1,
    });
  } else {
    chart.timeScale().fitContent();
  }
}

function PriceChartInner({ candles, trades, indicatorData }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Persistent refs — survive across data changes
  const chartRef = useRef<ChartInstance>(null);
  const candleSeriesRef = useRef<SeriesInstance>(null);
  const lcModuleRef = useRef<LCModule>(null);
  const indicatorSeriesRef = useRef<SeriesInstance[]>([]);
  const markerHandleRef = useRef<{ setMarkers: (m: unknown[]) => void } | null>(null);
  const markerCleanupRef = useRef<(() => void) | null>(null);
  const pendingDataRef = useRef<PendingData | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Effect A: mount-only — create chart instance once
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    import('lightweight-charts').then((lc) => {
      if (disposed || !containerRef.current) return;

      lcModuleRef.current = lc;
      const { createChart, ColorType, CandlestickSeries } = lc;

      const chartHeight = window.innerWidth < 640 ? 280 : 400;

      const chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: '#0f172a' },
          textColor: '#94a3b8',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          attributionLogo: false,
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
          fixLeftEdge: true,
          fixRightEdge: true,
          minBarSpacing: 0.5,
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

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

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

      cleanupRef.current = () => {
        if (markerCleanupRef.current) markerCleanupRef.current();
        resizeObserver.unobserve(container);
        resizeObserver.disconnect();
        chart.remove();
      };

      setIsLoading(false);

      // If data arrived before chart was ready, apply it now
      if (pendingDataRef.current) {
        const { candles: pc, trades: pt, indicatorData: pi } = pendingDataRef.current;
        pendingDataRef.current = null;
        if (pc.length > 0) {
          applyData(chart, candleSeries, lc, pc, pt, pi, indicatorSeriesRef, markerHandleRef, markerCleanupRef);
        }
      }
    });

    return () => {
      disposed = true;
      if (cleanupRef.current) cleanupRef.current();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lcModuleRef.current = null;
    };
  }, []); // mount-only

  // Effect B: data update — reuse existing chart instance
  useEffect(() => {
    if (candles.length === 0) return;

    // Chart not ready yet — stash data for when it is
    if (!chartRef.current || !candleSeriesRef.current || !lcModuleRef.current) {
      pendingDataRef.current = { candles, trades, indicatorData };
      return;
    }

    applyData(
      chartRef.current,
      candleSeriesRef.current,
      lcModuleRef.current,
      candles,
      trades,
      indicatorData,
      indicatorSeriesRef,
      markerHandleRef,
      markerCleanupRef,
    );
  }, [candles, trades, indicatorData]);

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt="Vibe Trade"
        className="absolute bottom-2 left-2 w-8 h-8 opacity-30 pointer-events-none z-10"
      />
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);
