import type { StrategyRuleSet } from '@/types/strategy';
import type { BacktestResult, DemoSnapshot, RunSnapshot } from '@/types/results';
import { StrategyInput, type StrategyConfig } from '@/components/StrategyInput';
import { RateLimitBanner } from '@/components/RateLimitBanner';
import { PresetGallery } from '@/components/PresetGallery';
import { RunHistory } from '@/components/RunHistory';
import { SlidePanel } from '@/components/SlidePanel';

export function InputPhase({
  config,
  panelOpen,
  rateLimitSeconds,
  rateLimitType,
  historyCount,
  runHistory,
  onParse,
  onConfigChange,
  onClearRateLimit,
  onOpenPanel,
  onClosePanel,
  onSelectPreset,
  onSelectSnapshot,
  onRestore,
}: {
  config: StrategyConfig;
  panelOpen: boolean;
  rateLimitSeconds: number;
  rateLimitType: 'minute' | 'daily';
  historyCount: number;
  runHistory: RunSnapshot[];
  onParse: (prompt: string, config: StrategyConfig) => void;
  onConfigChange: (config: StrategyConfig) => void;
  onClearRateLimit: () => void;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  onSelectPreset: (ruleSet: StrategyRuleSet) => void;
  onSelectSnapshot: (snapshot: DemoSnapshot) => void;
  onRestore: (result: BacktestResult) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center pt-[8vh] sm:pt-[14vh] pb-12">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: 'var(--vt-glow-bg)' }} />

        <div className="relative text-center mb-8 space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-100 leading-snug">
            Describe a trading strategy.
            <br />
            <span className="text-vt">
              See if it would&apos;ve worked.
            </span>
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            AI-powered backtesting for <span className="text-vt-dim">8 crypto assets</span> — no code required.
          </p>
        </div>

        <StrategyInput
          onParse={onParse}
          config={config}
          onConfigChange={onConfigChange}
          isParsing={false}
          rateLimitSeconds={rateLimitSeconds}
        />

        {rateLimitSeconds > 0 && (
          <div className="mt-4">
            <RateLimitBanner
              retryAfter={rateLimitSeconds}
              limitType={rateLimitType}
              onExpired={onClearRateLimit}
              onBrowsePresets={onOpenPanel}
            />
          </div>
        )}

        <button
          onClick={onOpenPanel}
          className="mt-8 text-[13px] text-vt-dim/70 hover:text-vt transition-colors
            flex items-center gap-1.5 group"
        >
          <span>Or try a preset strategy</span>
          <svg
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      <SlidePanel
        isOpen={panelOpen}
        onClose={onClosePanel}
        title="Strategies & History"
      >
        <PresetGallery
          onSelectPreset={onSelectPreset}
          onSelectSnapshot={onSelectSnapshot}
        />
        {historyCount > 0 && (
          <div className="mt-6 pt-6 border-t border-vt-line/60">
            <RunHistory history={runHistory} onRestore={onRestore} />
          </div>
        )}
      </SlidePanel>
    </>
  );
}
