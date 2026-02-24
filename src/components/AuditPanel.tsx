'use client';

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AuditInfo } from '@/types/results';

interface AuditPanelProps {
  audit: AuditInfo;
}

interface AuditRow {
  label: string;
  value: string;
}

function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${bps} bps (${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%)`;
}

function buildRows(audit: AuditInfo): AuditRow[] {
  return [
    { label: 'Execution Model', value: audit.executionModel },
    { label: 'Fee', value: formatBps(audit.feeBps) },
    { label: 'Slippage', value: formatBps(audit.slippageBps) },
    { label: 'Warmup', value: `${audit.warmupCandles} candles skipped` },
    { label: 'Data Range', value: audit.dataRange },
    { label: 'Total Candles', value: audit.totalCandles.toLocaleString() },
    { label: 'Tradable Candles', value: audit.tradableCandles.toLocaleString() },
    { label: 'Annualization Factor', value: String(audit.annualizationFactor) },
    { label: 'Risk-Free Rate', value: `${audit.riskFreeRate}%` },
    { label: 'Benchmark Model', value: audit.benchmarkModel },
    { label: 'Position Model', value: audit.positionModel },
  ];
}

export function AuditPanel({ audit }: AuditPanelProps) {
  const [open, setOpen] = useState(false);
  const rows = buildRows(audit);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between',
          'rounded-lg border border-vt-line/50 bg-vt-bg3/30',
          'px-4 py-3 text-left',
          'transition-colors hover:bg-vt-bg3/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
        )}
      >
        <span className="text-sm font-medium text-slate-300">
          Audit Panel &mdash; Execution Assumptions
        </span>
        <span
          className={cn(
            'text-xs text-slate-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        >
          &#x25BC;
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-vt-line/50 bg-vt-bg2/30 overflow-hidden">
          <div className="divide-y divide-vt-line/30">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 px-4 py-2.5"
              >
                <span className="text-xs text-slate-500 shrink-0">
                  {row.label}
                </span>
                <span className="text-xs text-slate-200 text-right font-mono">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
