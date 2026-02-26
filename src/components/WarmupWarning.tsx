import type { BacktestResult } from '@/types/results';

export function WarmupWarning({ audit }: { audit: BacktestResult['audit'] }) {
  if (
    !(audit.warmupCandles > 0 && audit.warmupCandles >= audit.totalCandles * 0.8)
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
      <svg className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div>
        <p className="text-sm font-medium text-amber-300">Warmup period consumed most of the data</p>
        <p className="text-xs text-amber-300/80 mt-1">
          The indicator warmup period ({audit.warmupCandles} candles) consumed most of the available data range
          ({audit.totalCandles} total candles), leaving only {audit.tradableCandles} tradable candles.
          Try using shorter indicator periods or a wider date range.
        </p>
      </div>
    </div>
  );
}
