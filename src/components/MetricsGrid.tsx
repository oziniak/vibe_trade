'use client';

import NumberFlow, { type Format } from '@number-flow/react';
import { useEffect, useState } from 'react';
import type { PerformanceMetrics } from '@/types/results';
import { Card, CardContent } from '@/components/ui/card';

interface MetricsGridProps {
  metrics: PerformanceMetrics;
  benchmarkReturn: number;
}

interface MetricDefinition {
  key: keyof PerformanceMetrics;
  label: string;
  format: Format;
  suffix?: string;
  colorMode: 'pnl' | 'inverted' | 'neutral';
}

const PCT: Format = {
  signDisplay: 'exceptZero',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const RATIO: Format = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const INT: Format = {
  maximumFractionDigits: 0,
};

const DEC1: Format = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};

// Pre-generated once per page load: staggered base delay + small random jitter
// so each number animates slightly differently on mount and on value changes.
const jitter = () => Math.random() * 40 - 20; // ±20ms
const BENCHMARK_TIMING = [
  { delay:  0 + jitter(), duration: 520 + jitter() },
  { delay: 30 + jitter(), duration: 520 + jitter() },
];
const METRIC_TIMING = Array.from({ length: 15 }, (_, i) => ({
  delay:    60 + i * 28 + jitter(), // 60–452ms stagger base
  duration: 500 + jitter(),         // ~480–520ms
}));

const METRIC_DEFS: MetricDefinition[] = [
  { key: 'totalReturn',            label: 'Total Return',    format: PCT,   suffix: '%',     colorMode: 'pnl'      },
  { key: 'annualizedReturn',       label: 'Ann. Return',     format: PCT,   suffix: '%',     colorMode: 'pnl'      },
  { key: 'sharpeRatio',            label: 'Sharpe Ratio',    format: RATIO,                  colorMode: 'pnl'      },
  { key: 'sortinoRatio',           label: 'Sortino Ratio',   format: RATIO,                  colorMode: 'pnl'      },
  { key: 'maxDrawdown',            label: 'Max Drawdown',    format: PCT,   suffix: '%',     colorMode: 'inverted' },
  { key: 'maxDrawdownDurationDays',label: 'Max DD Duration', format: INT,   suffix: ' days', colorMode: 'neutral'  },
  { key: 'winRate',                label: 'Win Rate',        format: PCT,   suffix: '%',     colorMode: 'pnl'      },
  { key: 'profitFactor',           label: 'Profit Factor',   format: RATIO,                  colorMode: 'pnl'      },
  { key: 'totalTrades',            label: 'Total Trades',    format: INT,                    colorMode: 'neutral'  },
  { key: 'avgWinPct',              label: 'Avg Win',         format: PCT,   suffix: '%',     colorMode: 'pnl'      },
  { key: 'avgLossPct',             label: 'Avg Loss',        format: PCT,   suffix: '%',     colorMode: 'inverted' },
  { key: 'bestTradePct',           label: 'Best Trade',      format: PCT,   suffix: '%',     colorMode: 'pnl'      },
  { key: 'worstTradePct',          label: 'Worst Trade',     format: PCT,   suffix: '%',     colorMode: 'inverted' },
  { key: 'avgHoldingDays',         label: 'Avg Hold',        format: DEC1,  suffix: ' days', colorMode: 'neutral'  },
  { key: 'exposureTimePct',        label: 'Exposure',        format: PCT,   suffix: '%',     colorMode: 'neutral'  },
];

function getValueColor(value: number, colorMode: MetricDefinition['colorMode']): string {
  if (colorMode === 'neutral') return 'text-slate-200';

  if (colorMode === 'inverted') {
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
  const [animatedMetrics, setAnimatedMetrics] = useState<PerformanceMetrics | null>(null);
  const [animatedBenchmark, setAnimatedBenchmark] = useState(0);

  useEffect(() => {
    setAnimatedMetrics(metrics);
    setAnimatedBenchmark(benchmarkReturn);
  }, [metrics, benchmarkReturn]);

  const displayed = animatedMetrics ?? metrics;

  return (
    <div className="space-y-4">
      {/* Benchmark comparison bar */}
      <div className="flex items-center gap-4 rounded-lg border border-vt-line/50 bg-vt-bg3/30 p-3">
        <div className="flex-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Strategy Return</p>
          <p className={`text-lg font-semibold tabular-nums ${metrics.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <NumberFlow
              value={animatedMetrics?.totalReturn ?? 0}
              format={PCT} suffix="%"
              transformTiming={BENCHMARK_TIMING[0]}
              spinTiming={BENCHMARK_TIMING[0]}
            />
          </p>
        </div>
        <div className="text-slate-600">vs</div>
        <div className="flex-1 text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Buy &amp; Hold</p>
          <p className={`text-lg font-semibold tabular-nums ${benchmarkReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <NumberFlow
              value={animatedBenchmark}
              format={PCT} suffix="%"
              transformTiming={BENCHMARK_TIMING[1]}
              spinTiming={BENCHMARK_TIMING[1]}
            />
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {METRIC_DEFS.map((def, i) => {
          const value = metrics[def.key];
          const animatedValue = displayed[def.key];
          const colorClass = getValueColor(value, def.colorMode);
          const timing = METRIC_TIMING[i];

          return (
            <Card key={def.key} className="bg-vt-bg3/30 border-vt-line/50 py-2.5 gap-0">
              <CardContent className="px-3 py-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">
                  {def.label}
                </p>
                <p className={`text-sm font-semibold mt-0.5 tabular-nums ${colorClass}`}>
                  {isFinite(value) ? (
                    <NumberFlow
                      value={animatedMetrics ? animatedValue : 0}
                      format={def.format}
                      suffix={def.suffix}
                      transformTiming={timing}
                      spinTiming={timing}
                    />
                  ) : '∞'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
