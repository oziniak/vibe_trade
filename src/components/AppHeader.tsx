import type { AppPhase } from '@/types/results';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';

export function AppHeader({
  phase,
  panelOpen,
  historyCount,
  onTogglePanel,
  onBack,
}: {
  phase: AppPhase;
  panelOpen: boolean;
  historyCount: number;
  onTogglePanel: () => void;
  onBack: () => void;
}) {
  return (
    <header className="border-b border-vt-line bg-vt-bg1/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-vt">Vibe</span>{' '}
            <span className="text-slate-100">Trade</span>
          </h1>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Crypto Strategy Backtester
          </span>
        </button>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {phase === 'input' && (
            <button
              onClick={onTogglePanel}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-vt-dim
                px-3 py-1.5 rounded-lg hover:bg-vt/[0.05] transition-all"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              <span className="hidden sm:inline">Presets</span>
              {historyCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-vt/20 text-vt-dim text-[10px] font-medium px-1">
                  {historyCount}
                </span>
              )}
            </button>
          )}
          {phase !== 'input' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-400 hover:text-slate-200"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              New Strategy
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
