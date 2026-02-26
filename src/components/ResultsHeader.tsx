import type { AssetSymbol } from '@/types/strategy';
import type { BacktestResult } from '@/types/results';
import { ASSETS } from '@/app/state';
import { Button } from '@/components/ui/button';

export function ResultsHeader({
  result,
  strategyName,
  activeAsset,
  onAssetSwap,
  onBack,
}: {
  result: BacktestResult;
  strategyName: string;
  activeAsset: AssetSymbol;
  onAssetSwap: (asset: AssetSymbol) => void;
  onBack: () => void;
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
      <div className="flex items-center gap-2 self-start flex-wrap">
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
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="border-vt-line text-slate-300 hover:bg-vt-bg3"
        >
          New
        </Button>
      </div>
    </div>
  );
}
