'use client';

import { useCallback } from 'react';
import type { RunSnapshot, BacktestResult } from '@/types/results';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatPercent, formatRatio } from '@/lib/utils';

interface RunHistoryProps {
  history: RunSnapshot[];
  onRestore: (result: BacktestResult) => void;
}

/** Truncate a string to a max length, appending ellipsis if needed. */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '\u2026';
}

/** Format a timestamp as a relative time string (e.g., "2 min ago"). */
function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

function RunHistoryEntry({
  snapshot,
  onRestore,
}: {
  snapshot: RunSnapshot;
  onRestore: (result: BacktestResult) => void;
}) {
  const { metricsPreview } = snapshot;
  const isPositive = metricsPreview.totalReturn >= 0;

  const handleClick = useCallback(() => {
    onRestore(snapshot.fullResult);
  }, [onRestore, snapshot.fullResult]);

  return (
    <Card
      className="bg-vt-bg3/30 border-vt-line/50 py-2 gap-0 cursor-pointer hover:border-vt-line hover:bg-vt-bg3/50 transition-colors"
      onClick={handleClick}
    >
      <CardContent className="px-3 py-0 space-y-1.5">
        {/* Top row: prompt + asset badge */}
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-xs text-slate-300 leading-tight flex-1 min-w-0"
            title={snapshot.prompt}
          >
            {truncate(snapshot.prompt, 40)}
          </p>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 shrink-0"
          >
            {snapshot.asset}
          </Badge>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-1">
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">
              Return
            </p>
            <p
              className={cn(
                'text-xs font-semibold leading-tight mt-0.5',
                isPositive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {formatPercent(metricsPreview.totalReturn)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">
              Sharpe
            </p>
            <p className="text-xs font-semibold text-slate-200 leading-tight mt-0.5">
              {formatRatio(metricsPreview.sharpeRatio)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">
              Win Rate
            </p>
            <p className="text-xs font-semibold text-slate-200 leading-tight mt-0.5">
              {formatPercent(metricsPreview.winRate, 1)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider leading-none">
              Trades
            </p>
            <p className="text-xs font-semibold text-slate-200 leading-tight mt-0.5">
              {metricsPreview.totalTrades}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-[10px] text-slate-500 text-right">
          {timeAgo(snapshot.timestamp)}
        </p>
      </CardContent>
    </Card>
  );
}

export function RunHistory({ history, onRestore }: RunHistoryProps) {
  // Sort by most recent first
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Run History
        </h2>
        {sorted.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {sorted.length}
          </Badge>
        )}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500 text-center">
            No runs yet.
            <br />
            <span className="text-xs">
              Results will appear here after your first backtest.
            </span>
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
          {sorted.map((snapshot) => (
            <RunHistoryEntry
              key={snapshot.id}
              snapshot={snapshot}
              onRestore={onRestore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
