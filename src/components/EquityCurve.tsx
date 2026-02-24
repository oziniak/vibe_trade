'use client';

import { useState, useEffect } from 'react';
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
  ReferenceLine,
} from 'recharts';
import type { EquityPoint } from '@/types/results';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const BENCHMARK_COLOR = '#94a3b8'; // neutral slate for Buy & Hold

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

interface EquityCurveProps {
  equityCurve: EquityPoint[];
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
  accentColor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a date string (YYYY-MM-DD) to "MMM YYYY" for axis ticks. */
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

/**
 * Compute a reasonable tick interval so axis labels don't overlap.
 * Targets roughly 8-12 visible ticks on the axis.
 */
function computeTickInterval(dataLength: number): number {
  if (dataLength <= 12) return 1;
  return Math.ceil(dataLength / 10);
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function EquityTooltip({ active, payload, label, accentColor }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const equityEntry = payload.find((p) => p.dataKey === 'equity');
  const benchmarkEntry = payload.find((p) => p.dataKey === 'benchmarkEquity');
  const drawdownEntry = payload.find((p) => p.dataKey === 'drawdownPct');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-medium text-slate-300 mb-1.5">
        {formatDateFull(label)}
      </p>
      <div className="space-y-1">
        {equityEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-slate-400">Strategy:</span>
            <span className="font-medium text-slate-200">
              {formatCurrency(equityEntry.value)}
            </span>
          </div>
        )}
        {benchmarkEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: BENCHMARK_COLOR }}
            />
            <span className="text-slate-400">Buy &amp; Hold:</span>
            <span className="font-medium text-slate-200">
              {formatCurrency(benchmarkEntry.value)}
            </span>
          </div>
        )}
        {drawdownEntry != null && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="text-slate-400">Drawdown:</span>
            <span className="font-medium text-red-400">
              {formatPercent(drawdownEntry.value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawdownTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const drawdownEntry = payload.find((p) => p.dataKey === 'drawdownPct');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-medium text-slate-300 mb-1">
        {formatDateFull(label)}
      </p>
      {drawdownEntry != null && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#ef4444' }}
          />
          <span className="text-slate-400">Drawdown:</span>
          <span className="font-medium text-red-400">
            {formatPercent(drawdownEntry.value)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

function EquityLegend({ accentColor }: { accentColor?: string }) {
  return (
    <div className="flex items-center justify-center gap-5 pt-1 pb-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-slate-400">Strategy</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: BENCHMARK_COLOR }}
        />
        <span className="text-slate-400">Buy &amp; Hold</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EquityCurve({ equityCurve }: EquityCurveProps) {
  const isMobile = useIsMobile();
  const { accentHex } = useTheme();

  // ── Empty state ──────────────────────────────────────────────────────
  if (!equityCurve || equityCurve.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-vt-line/50 bg-vt-bg2/50">
        <p className="text-sm text-slate-500">No equity data available</p>
      </div>
    );
  }

  const tickInterval = computeTickInterval(equityCurve.length);

  // Compute Y-axis domain for drawdown to keep it visually consistent.
  // drawdownPct values are typically negative (e.g. -12.5 meaning -12.5%).
  const minDrawdown = Math.min(...equityCurve.map((p) => p.drawdownPct));
  // Add a small buffer below the minimum drawdown for visual padding.
  const drawdownDomainMin = Math.floor(minDrawdown * 1.1);

  const equityHeight = isMobile ? 240 : 350;
  const drawdownHeight = isMobile ? 100 : 150;
  const yAxisWidth = isMobile ? 60 : 90;

  return (
    <div className="w-full space-y-0">
      {/* ── Equity Chart (top, 70%) ─────────────────────────────────────── */}
      <div className="rounded-t-lg border border-vt-line/50 overflow-hidden">
        <ResponsiveContainer width="100%" height={equityHeight}>
          <ComposedChart
            data={equityCurve}
            syncId="backtest"
            margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
          >
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentHex} stopOpacity={0.3} />
                <stop offset="100%" stopColor={accentHex} stopOpacity={0} />
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
              content={<EquityTooltip accentColor={accentHex} />}
              cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
            />

            <Legend content={<EquityLegend accentColor={accentHex} />} />

            {/* Strategy equity - area with gradient fill */}
            <Area
              type="monotone"
              dataKey="equity"
              name="Strategy"
              stroke={accentHex}
              strokeWidth={2}
              fill="url(#equityGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: accentHex,
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
            />

            {/* Benchmark equity - dashed line, no fill */}
            <Line
              type="monotone"
              dataKey="benchmarkEquity"
              name="Buy & Hold"
              stroke={BENCHMARK_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{
                r: 4,
                fill: BENCHMARK_COLOR,
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Drawdown Chart (bottom, 30%) ────────────────────────────────── */}
      <div className="rounded-b-lg border border-t-0 border-vt-line/50 overflow-hidden">
        <ResponsiveContainer width="100%" height={drawdownHeight}>
          <ComposedChart
            data={equityCurve}
            syncId="backtest"
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <defs>
              <linearGradient
                id="drawdownGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
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
              tickFormatter={(value: number) => `${value.toFixed(0)}%`}
              width={yAxisWidth}
              domain={[drawdownDomainMin, 0]}
            />

            <Tooltip
              content={<DrawdownTooltip />}
              cursor={{ stroke: '#475569', strokeDasharray: '4 4' }}
            />

            <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />

            {/* Drawdown area - fills downward from 0 */}
            <Area
              type="monotone"
              dataKey="drawdownPct"
              name="Drawdown"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#drawdownGradient)"
              baseValue={0}
              dot={false}
              activeDot={{
                r: 3,
                fill: '#ef4444',
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
