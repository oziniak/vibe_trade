'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { BacktestResult, EquityPoint } from '@/types/results';
import type { PerformanceMetrics } from '@/types/results';
import {
  formatPercent,
  formatRatio,
  formatNumber,
  formatCurrency,
} from '@/lib/utils';
import { useTheme } from '@/lib/theme';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComparisonViewProps {
  resultA: BacktestResult;
  resultB: BacktestResult;
}

interface MergedEquityPoint {
  date: string;
  equityA: number | null;
  equityB: number | null;
  benchmarkEquity: number | null;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

type ComparisonDirection = 'higher_better' | 'lower_better' | 'neutral';

interface MetricComparisonDef {
  key: keyof PerformanceMetrics;
  label: string;
  format: (value: number) => string;
  direction: ComparisonDirection;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// COLOR_A and COLOR_B are now derived from theme in the component
const COLOR_BENCHMARK = '#475569'; // slate

const METRIC_COMPARISON_DEFS: MetricComparisonDef[] = [
  {
    key: 'totalReturn',
    label: 'Total Return',
    format: formatPercent,
    direction: 'higher_better',
  },
  {
    key: 'annualizedReturn',
    label: 'Ann. Return',
    format: formatPercent,
    direction: 'higher_better',
  },
  {
    key: 'sharpeRatio',
    label: 'Sharpe Ratio',
    format: formatRatio,
    direction: 'higher_better',
  },
  {
    key: 'sortinoRatio',
    label: 'Sortino Ratio',
    format: formatRatio,
    direction: 'higher_better',
  },
  {
    key: 'maxDrawdown',
    label: 'Max Drawdown',
    format: (v) => formatPercent(v),
    direction: 'lower_better',
  },
  {
    key: 'maxDrawdownDurationDays',
    label: 'Max DD Duration',
    format: (v) => `${formatNumber(v)} days`,
    direction: 'lower_better',
  },
  {
    key: 'winRate',
    label: 'Win Rate',
    format: (v) => formatPercent(v),
    direction: 'higher_better',
  },
  {
    key: 'profitFactor',
    label: 'Profit Factor',
    format: formatRatio,
    direction: 'higher_better',
  },
  {
    key: 'totalTrades',
    label: 'Total Trades',
    format: (v) => formatNumber(v),
    direction: 'neutral',
  },
  {
    key: 'avgWinPct',
    label: 'Avg Win',
    format: formatPercent,
    direction: 'higher_better',
  },
  {
    key: 'avgLossPct',
    label: 'Avg Loss',
    format: formatPercent,
    direction: 'lower_better',
  },
  {
    key: 'bestTradePct',
    label: 'Best Trade',
    format: formatPercent,
    direction: 'higher_better',
  },
  {
    key: 'worstTradePct',
    label: 'Worst Trade',
    format: formatPercent,
    direction: 'lower_better',
  },
  {
    key: 'avgHoldingDays',
    label: 'Avg Hold',
    format: (v) => `${formatNumber(v, 1)} days`,
    direction: 'neutral',
  },
  {
    key: 'exposureTimePct',
    label: 'Exposure',
    format: (v) => formatPercent(v),
    direction: 'neutral',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a date string (YYYY-MM-DD) to "MMM YY" for axis ticks. */
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Format a date string (YYYY-MM-DD) to a more readable tooltip format. */
function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Compute a reasonable tick interval so axis labels don't overlap. */
function computeTickInterval(dataLength: number): number {
  if (dataLength <= 12) return 1;
  return Math.ceil(dataLength / 10);
}

/**
 * Merge two equity curves by date into a single combined array.
 * Each point has: date, equityA, equityB, benchmarkEquity.
 * Benchmark is taken from strategy A (they share the same asset/period).
 */
function mergeEquityCurves(
  curveA: EquityPoint[],
  curveB: EquityPoint[]
): MergedEquityPoint[] {
  const map = new Map<string, MergedEquityPoint>();

  for (const point of curveA) {
    map.set(point.date, {
      date: point.date,
      equityA: point.equity,
      equityB: null,
      benchmarkEquity: point.benchmarkEquity,
    });
  }

  for (const point of curveB) {
    const existing = map.get(point.date);
    if (existing) {
      existing.equityB = point.equity;
    } else {
      map.set(point.date, {
        date: point.date,
        equityA: null,
        equityB: point.equity,
        benchmarkEquity: point.benchmarkEquity,
      });
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

/**
 * Determine the delta arrow for a metric comparison.
 * Returns: { arrow, colorClass } where arrow is a unicode arrow and colorClass is a Tailwind class.
 */
function getDeltaDisplay(
  valueA: number,
  valueB: number,
  direction: ComparisonDirection
): { arrow: string; colorClass: string; delta: number } {
  const delta = valueA - valueB;

  if (direction === 'neutral') {
    if (delta === 0) return { arrow: '=', colorClass: 'text-slate-500', delta };
    return {
      arrow: delta > 0 ? '\u2191' : '\u2193',
      colorClass: 'text-slate-400',
      delta,
    };
  }

  if (delta === 0) {
    return { arrow: '=', colorClass: 'text-slate-500', delta };
  }

  if (direction === 'higher_better') {
    // A > B means A is better
    return delta > 0
      ? { arrow: '\u2191', colorClass: 'text-emerald-400', delta }
      : { arrow: '\u2193', colorClass: 'text-red-400', delta };
  }

  // direction === 'lower_better'
  // For metrics like maxDrawdown (which are negative), A < B means A is better
  // (less negative = closer to 0 = better for drawdown)
  // But for maxDrawdownDurationDays (positive), A < B means A is better
  return delta < 0
    ? { arrow: '\u2191', colorClass: 'text-emerald-400', delta }
    : { arrow: '\u2193', colorClass: 'text-red-400', delta };
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ComparisonTooltip({ active, payload, label, colorA, colorB }: CustomTooltipProps & { colorA?: string; colorB?: string }) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const equityAEntry = payload.find((p) => p.dataKey === 'equityA');
  const equityBEntry = payload.find((p) => p.dataKey === 'equityB');
  const benchmarkEntry = payload.find((p) => p.dataKey === 'benchmarkEquity');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-medium text-slate-300 mb-1.5">
        {formatDateFull(label)}
      </p>
      <div className="space-y-1">
        {equityAEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: colorA }}
            />
            <span className="text-slate-400">Strategy A:</span>
            <span className="font-medium text-slate-200">
              {formatCurrency(equityAEntry.value)}
            </span>
          </div>
        )}
        {equityBEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: colorB }}
            />
            <span className="text-slate-400">Strategy B:</span>
            <span className="font-medium text-slate-200">
              {formatCurrency(equityBEntry.value)}
            </span>
          </div>
        )}
        {benchmarkEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: COLOR_BENCHMARK }}
            />
            <span className="text-slate-400">Benchmark:</span>
            <span className="font-medium text-slate-200">
              {formatCurrency(benchmarkEntry.value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

function ComparisonLegend({
  nameA,
  nameB,
  colorA,
  colorB,
}: {
  nameA: string;
  nameB: string;
  colorA?: string;
  colorB?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-5 pt-1 pb-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: colorA }}
        />
        <span className="text-slate-400">{nameA}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: colorB }}
        />
        <span className="text-slate-400">{nameB}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm border border-vt-line"
          style={{ backgroundColor: 'transparent' }}
        />
        <span className="text-slate-400">Buy &amp; Hold</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlaid Equity Curves Chart
// ---------------------------------------------------------------------------

function OverlaidEquityChart({
  data,
  nameA,
  nameB,
  colorA,
  colorB,
}: {
  data: MergedEquityPoint[];
  nameA: string;
  nameB: string;
  colorA: string;
  colorB: string;
}) {
  const isMobile = useIsMobile();
  const tickInterval = computeTickInterval(data.length);
  const chartHeight = isMobile ? 280 : 400;
  const yAxisWidth = isMobile ? 60 : 90;

  return (
    <div className="rounded-lg border border-vt-line/50 bg-vt-bg2/50 overflow-hidden">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="compEquityGradientA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorA} stopOpacity={0.15} />
              <stop offset="100%" stopColor={colorA} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="compEquityGradientB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorB} stopOpacity={0.15} />
              <stop offset="100%" stopColor={colorB} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1e293b"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={{ stroke: '#64748b' }}
            axisLine={{ stroke: '#1e293b' }}
            tickFormatter={formatDateShort}
            interval={tickInterval}
            minTickGap={40}
          />

          <YAxis
            tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }}
            tickLine={{ stroke: '#64748b' }}
            axisLine={{ stroke: '#1e293b' }}
            tickFormatter={(value: number) => formatCurrency(value)}
            width={yAxisWidth}
            domain={['auto', 'auto']}
          />

          <Tooltip
            content={<ComparisonTooltip colorA={colorA} colorB={colorB} />}
            cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
          />

          <Legend content={<ComparisonLegend nameA={nameA} nameB={nameB} colorA={colorA} colorB={colorB} />} />

          {/* Strategy A equity */}
          <Area
            type="monotone"
            dataKey="equityA"
            name={nameA}
            stroke={colorA}
            strokeWidth={2}
            fill="url(#compEquityGradientA)"
            dot={false}
            connectNulls
            activeDot={{
              r: 4,
              fill: colorA,
              stroke: '#0f172a',
              strokeWidth: 2,
            }}
          />

          {/* Strategy B equity */}
          <Area
            type="monotone"
            dataKey="equityB"
            name={nameB}
            stroke={colorB}
            strokeWidth={2}
            fill="url(#compEquityGradientB)"
            dot={false}
            connectNulls
            activeDot={{
              r: 4,
              fill: colorB,
              stroke: '#0f172a',
              strokeWidth: 2,
            }}
          />

          {/* Benchmark equity - dashed */}
          <Line
            type="monotone"
            dataKey="benchmarkEquity"
            name="Buy & Hold"
            stroke={COLOR_BENCHMARK}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
            activeDot={{
              r: 4,
              fill: COLOR_BENCHMARK,
              stroke: '#0f172a',
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-by-Side Metrics Table
// ---------------------------------------------------------------------------

function MetricsComparisonTable({
  metricsA,
  metricsB,
  nameA,
  nameB,
  colorA,
  colorB,
}: {
  metricsA: PerformanceMetrics;
  metricsB: PerformanceMetrics;
  nameA: string;
  nameB: string;
  colorA: string;
  colorB: string;
}) {
  return (
    <div className="rounded-lg border border-vt-line/50 bg-vt-bg2/50 overflow-x-auto">
      <div className="min-w-[540px]">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-vt-line/50 bg-vt-bg3/30">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Metric
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-right min-w-[90px]" style={{ color: colorA }}>
          {nameA}
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-right min-w-[90px]" style={{ color: colorB }}>
          {nameB}
        </div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right min-w-[90px]">
          Delta
        </div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider text-center w-6">
          {/* Arrow column */}
        </div>
      </div>

      {/* Table body */}
      <div className="divide-y divide-vt-line/50">
        {METRIC_COMPARISON_DEFS.map((def) => {
          const valueA = metricsA[def.key];
          const valueB = metricsB[def.key];
          const { arrow, colorClass, delta } = getDeltaDisplay(
            valueA,
            valueB,
            def.direction
          );

          return (
            <div
              key={def.key}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 px-4 py-2 hover:bg-vt-bg3/20 transition-colors"
            >
              <div className="text-sm text-slate-400">{def.label}</div>
              <div className="text-sm font-medium text-slate-200 text-right min-w-[90px] tabular-nums">
                {def.format(valueA)}
              </div>
              <div className="text-sm font-medium text-slate-200 text-right min-w-[90px] tabular-nums">
                {def.format(valueB)}
              </div>
              <div className="text-sm font-medium text-slate-400 text-right min-w-[90px] tabular-nums">
                {def.format(delta)}
              </div>
              <div className={`text-sm font-bold text-center w-6 ${colorClass}`}>
                {arrow}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ComparisonView Component
// ---------------------------------------------------------------------------

export function ComparisonView({ resultA, resultB }: ComparisonViewProps) {
  const { accentHex, secondaryHex } = useTheme();
  const nameA = resultA.config.rules.name || 'Strategy A';
  const nameB = resultB.config.rules.name || 'Strategy B';

  const mergedData = useMemo(
    () => mergeEquityCurves(resultA.equityCurve, resultB.equityCurve),
    [resultA.equityCurve, resultB.equityCurve]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: accentHex }}
          />
          <span className="text-sm font-medium text-slate-300">{nameA}</span>
        </div>
        <span className="text-slate-600 text-sm">vs</span>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: secondaryHex }}
          />
          <span className="text-sm font-medium text-slate-300">{nameB}</span>
        </div>
      </div>

      {/* Overlaid Equity Curves */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
          Overlaid Equity Curves
        </h3>
        <OverlaidEquityChart data={mergedData} nameA={nameA} nameB={nameB} colorA={accentHex} colorB={secondaryHex} />
      </div>

      {/* Side-by-Side Metrics */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
          Metrics Comparison
        </h3>
        <MetricsComparisonTable
          metricsA={resultA.metrics}
          metricsB={resultB.metrics}
          nameA={nameA}
          nameB={nameB}
          colorA={accentHex}
          colorB={secondaryHex}
        />
      </div>
    </div>
  );
}
