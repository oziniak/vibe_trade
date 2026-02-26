import type { AssetSymbol } from '@/types/strategy';
import type { BacktestResult } from '@/types/results';
import { ASSETS } from '@/app/state';

export function ResultsHeader({
  result,
  strategyName,
  activeAsset,
  onAssetSwap,
  onViewRules,
}: {
  result: BacktestResult;
  strategyName: string;
  activeAsset: AssetSymbol;
  onAssetSwap: (asset: AssetSymbol) => void;
  onViewRules?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{strategyName}</h2>
        <p className="text-sm text-slate-500">
          {result.config.startDate} to {result.config.endDate} &middot;
          Capital: ${result.config.initialCapital.toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3 self-start flex-wrap">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-vt-line/50 bg-vt-bg3/30 p-0.5">
          {ASSETS.map((a) => (
            <button
              key={a}
              onClick={() => onAssetSwap(a)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                a === activeAsset
                  ? 'bg-vt text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {onViewRules && (
          <>
            <div className="w-px h-6 bg-vt-line/40" />
            <button
              onClick={onViewRules}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-vt/15 text-vt border border-vt/30 hover:bg-vt/25 hover:border-vt/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Rules
            </button>
          </>
        )}
      </div>
    </div>
  );
}
