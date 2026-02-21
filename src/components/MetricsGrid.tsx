'use client';

import type { PerformanceMetrics } from '@/types/results';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatPercent,
  formatRatio,
  formatNumber,
  formatCurrency,
} from '@/lib/utils';

interface MetricsGridProps {
  metrics: PerformanceMetrics;
  benchmarkReturn: number;
}

interface MetricDefinition {
  key: keyof PerformanceMetrics;
  label: string;
  format: (value: number) => string;
  colorMode: 'pnl' | 'inverted' | 'neutral';
}

const METRIC_DEFS: MetricDefinition[] = [
  {
    key: 'totalReturn',
    label: 'Total Return',
    format: formatPercent,
    colorMode: 'pnl',
  },
  {
    key: 'annualizedReturn',
    label: 'Ann. Return',
    format: formatPercent,
    colorMode: 'pnl',
  },
  {
    key: 'sharpeRatio',
    label: 'Sharpe Ratio',
    format: formatRatio,
    colorMode: 'pnl',
  },
  {
    key: 'sortinoRatio',
    label: 'Sortino Ratio',
    format: formatRatio,
    colorMode: 'pnl',
  },
  {
    key: 'maxDrawdown',
    label: 'Max Drawdown',
    format: (v) => formatPercent(v),
    colorMode: 'inverted',
  },
  {
    key: 'maxDrawdownDurationDays',
    label: 'Max DD Duration',
    format: (v) => `${formatNumber(v)} days`,
    colorMode: 'neutral',
  },
  {
    key: 'winRate',
    label: 'Win Rate',
    format: (v) => formatPercent(v),
    colorMode: 'pnl',
  },
  {
    key: 'profitFactor',
    label: 'Profit Factor',
    format: formatRatio,
    colorMode: 'pnl',
  },
  {
    key: 'totalTrades',
    label: 'Total Trades',
    format: (v) => formatNumber(v),
    colorMode: 'neutral',
  },
  {
    key: 'avgWinPct',
    label: 'Avg Win',
    format: formatPercent,
    colorMode: 'pnl',
  },
  {
    key: 'avgLossPct',
    label: 'Avg Loss',
    format: formatPercent,
    colorMode: 'inverted',
  },
  {
    key: 'bestTradePct',
    label: 'Best Trade',
    format: formatPercent,
    colorMode: 'pnl',
  },
  {
    key: 'worstTradePct',
    label: 'Worst Trade',
    format: formatPercent,
    colorMode: 'inverted',
  },
  {
    key: 'avgHoldingDays',
    label: 'Avg Hold',
    format: (v) => `${formatNumber(v, 1)} days`,
    colorMode: 'neutral',
  },
  {
    key: 'exposureTimePct',
    label: 'Exposure',
    format: (v) => formatPercent(v),
    colorMode: 'neutral',
  },
];

function getValueColor(value: number, colorMode: MetricDefinition['colorMode']): string {
  if (colorMode === 'neutral') return 'text-slate-200';

  if (colorMode === 'inverted') {
    // For drawdown and losses: negative values are expected, so color by their magnitude
    // More negative = worse = red; zero or positive = green
    if (value < 0) return 'text-red-400';
    if (value > 0) return 'text-emerald-400';
    return 'text-slate-200';
  }

  // Normal: positive = green, negative = red
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-200';
}

export function MetricsGrid({ metrics, benchmarkReturn }: MetricsGridProps) {
  return (
    <div className="space-y-4">
      {/* Benchmark comparison bar */}
      <div className="flex items-center gap-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
        <div className="flex-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Strategy Return</p>
          <p className={`text-lg font-semibold tabular-nums ${metrics.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(metrics.totalReturn)}
          </p>
        </div>
        <div className="text-slate-600">vs</div>
        <div className="flex-1 text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Buy &amp; Hold</p>
          <p className={`text-lg font-semibold tabular-nums ${benchmarkReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(benchmarkReturn)}
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {METRIC_DEFS.map((def) => {
          const value = metrics[def.key];
          const colorClass = getValueColor(value, def.colorMode);

          return (
            <Card
              key={def.key}
              className="bg-slate-800/30 border-slate-700/50 py-2.5 gap-0"
            >
              <CardContent className="px-3 py-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">
                  {def.label}
                </p>
                <p className={`text-sm font-semibold mt-0.5 tabular-nums ${colorClass}`}>
                  {def.format(value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
