'use client';

import { useReducer, useCallback, useState, useMemo } from 'react';
import type { StrategyRuleSet } from '@/types/strategy';
import type { BacktestResult, DemoSnapshot } from '@/types/results';

import { appReducer, initialState } from '@/app/state';
import { useCountdown } from '@/hooks/useCountdown';
import { useShareURL } from '@/hooks/useShareURL';
import { useBacktestActions } from '@/hooks/useBacktestActions';
import { AppHeader } from '@/components/AppHeader';
import { InputPhase } from '@/components/InputPhase';

import { ResultsPhase } from '@/components/ResultsPhase';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorToast } from '@/components/ErrorToast';
import { BackgroundShader } from '@/components/BackgroundShader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rateLimitType, setRateLimitType] = useState<'minute' | 'daily'>('minute');
  const [rateLimitSeconds, startRateLimitCountdown, clearRateLimit] = useCountdown();

  const rateLimitControls = useMemo(
    () => ({ setRateLimitType, startRateLimitCountdown }),
    [startRateLimitCountdown],
  );

  const {
    executeBacktest,
    addToHistory,
    isComparing,
    handleParse,
    handlePreset,
    handleSnapshot,
    handleBack,
    handleConfigChange,
    handleRestore,
    handleAssetSwap,
    handleCompare,
    handleCompareWithPrompt,
  } = useBacktestActions(state, dispatch, rateLimitControls);

  // ── Panel wrappers (close panel, then delegate)
  const handlePresetFromPanel = useCallback(
    (ruleSet: StrategyRuleSet) => { setPanelOpen(false); handlePreset(ruleSet); },
    [handlePreset],
  );
  const handleSnapshotFromPanel = useCallback(
    (snapshot: DemoSnapshot) => { setPanelOpen(false); handleSnapshot(snapshot); },
    [handleSnapshot],
  );
  const handleRestoreFromPanel = useCallback(
    (result: BacktestResult) => { setPanelOpen(false); handleRestore(result); },
    [handleRestore],
  );

  useShareURL(dispatch, executeBacktest, addToHistory);

  const result = state.results[0];
  const comparisonResult = state.results[1];
  const showResults = (state.phase === 'results' || state.phase === 'comparing') && result;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-vt-bg1 isolate overflow-x-hidden">
      <BackgroundShader dimmed={!!showResults} />

      <AppHeader
        phase={state.phase}
        panelOpen={panelOpen}
        historyCount={state.runHistory.length}
        onTogglePanel={() => setPanelOpen(!panelOpen)}
        onBack={handleBack}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        {state.error && (
          <ErrorToast
            error={state.error}
            showPresetLink={state.error.includes('preset') && state.phase === 'input'}
            onBrowsePresets={() => {
              dispatch({ type: 'CLEAR_ERROR' });
              setPanelOpen(true);
            }}
            onDismiss={() => dispatch({ type: 'CLEAR_ERROR' })}
          />
        )}

        {state.phase === 'input' && (
          <InputPhase
            config={state.config}
            panelOpen={panelOpen}
            rateLimitSeconds={rateLimitSeconds}
            rateLimitType={rateLimitType}
            historyCount={state.runHistory.length}
            runHistory={state.runHistory}
            onParse={handleParse}
            onConfigChange={handleConfigChange}
            onClearRateLimit={clearRateLimit}
            onOpenPanel={() => setPanelOpen(true)}
            onClosePanel={() => setPanelOpen(false)}
            onSelectPreset={handlePresetFromPanel}
            onSelectSnapshot={handleSnapshotFromPanel}
            onRestore={handleRestoreFromPanel}
          />
        )}

        {state.phase === 'parsing' && <LoadingSpinner message="AI is parsing your strategy..." />}

        {state.phase === 'running' && <LoadingSpinner message="Running backtest..." />}

        {showResults && (
          <ResultsPhase
            result={result}
            comparisonResult={comparisonResult}
            strategyName={state.currentRules?.name ?? 'Backtest Results'}
            activeAsset={state.config.asset}
            isComparing={isComparing}
            runHistory={state.runHistory}
            rules={state.currentRules}
            onAssetSwap={handleAssetSwap}
            onClearComparison={() => dispatch({ type: 'CLEAR_COMPARISON' })}
            onCompareWithPrompt={handleCompareWithPrompt}
            onCompareWithPreset={handleCompare}
            onRestore={handleRestore}
          />
        )}
      </main>
    </div>
    </ErrorBoundary>
  );
}
