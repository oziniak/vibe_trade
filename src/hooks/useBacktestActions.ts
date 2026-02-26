'use client';

import { useCallback, useState, type Dispatch } from 'react';
import type { AssetSymbol, StrategyRuleSet } from '@/types/strategy';
import type {
  AppState,
  BacktestConfig,
  BacktestResult,
  DemoSnapshot,
  RunSnapshot,
} from '@/types/results';
import { runBacktest } from '@/engine/backtest';
import { loadCandles } from '@/data/loader';
import { getPresetById } from '@/data/presets';
import type { ParseResponse } from '@/lib/parser';
import type { AppAction } from '@/app/state';
import type { StrategyConfig } from '@/components/StrategyInput';

export function useBacktestActions(
  state: AppState,
  dispatch: Dispatch<AppAction>,
  rateLimitControls: {
    setRateLimitType: (type: 'minute' | 'daily') => void;
    startRateLimitCountdown: (seconds: number) => void;
  },
) {
  const [isComparing, setIsComparing] = useState(false);

  const executeBacktest = useCallback(
    async (rules: StrategyRuleSet, config: AppState['config']): Promise<BacktestResult> => {
      const candles = await loadCandles(config.asset);
      const backtestConfig: BacktestConfig = {
        asset: config.asset,
        timeframe: '1D',
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital,
        feeBps: config.feeBps,
        slippageBps: config.slippageBps,
        rules,
      };
      return runBacktest(backtestConfig, candles);
    },
    [],
  );

  const addToHistory = useCallback(
    (result: BacktestResult, prompt: string) => {
      const snapshot: RunSnapshot = {
        id: `run-${Date.now()}`,
        timestamp: Date.now(),
        prompt,
        asset: result.config.asset,
        metricsPreview: {
          totalReturn: result.metrics.totalReturn,
          sharpeRatio: result.metrics.sharpeRatio,
          winRate: result.metrics.winRate,
          totalTrades: result.metrics.totalTrades,
        },
        fullResult: result,
      };
      dispatch({ type: 'ADD_HISTORY', snapshot });
    },
    [dispatch],
  );

  const handleParse = useCallback(
    async (prompt: string, config: StrategyConfig) => {
      dispatch({ type: 'SET_PROMPT', prompt });
      dispatch({ type: 'SET_CONFIG', config });
      dispatch({ type: 'SET_PHASE', phase: 'parsing' });

      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, asset: config.asset, timeframe: '1D' }),
        });
        const data = await res.json();

        if (res.status === 429 && data.retryAfter) {
          rateLimitControls.setRateLimitType(data.limitType ?? 'minute');
          rateLimitControls.startRateLimitCountdown(data.retryAfter);
          dispatch({ type: 'SET_PHASE', phase: 'input' });
          return;
        }

        if (!data.success) {
          dispatch({ type: 'SET_ERROR', error: data.error });
          return;
        }

        dispatch({ type: 'SET_RULES', rules: (data as ParseResponse & { success: true }).ruleSet });
        dispatch({ type: 'SET_PHASE', phase: 'confirming' });
      } catch {
        dispatch({
          type: 'SET_ERROR',
          error: 'Failed to connect to the AI parser. Try a preset strategy instead.',
        });
      }
    },
    [dispatch, rateLimitControls],
  );

  const handleConfirm = useCallback(async () => {
    if (!state.currentRules) return;
    dispatch({ type: 'SET_PHASE', phase: 'running' });

    try {
      const result = await executeBacktest(state.currentRules, state.config);
      dispatch({ type: 'SET_RESULTS', results: result });
      dispatch({ type: 'SET_PHASE', phase: 'results' });
      addToHistory(result, state.currentPrompt || state.currentRules.name);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? `Backtest failed: ${err.message}` : 'Backtest failed.',
      });
    }
  }, [state.currentRules, state.config, state.currentPrompt, dispatch, executeBacktest, addToHistory]);

  const handlePreset = useCallback(
    (ruleSet: StrategyRuleSet) => {
      dispatch({ type: 'SET_RULES', rules: ruleSet });
      dispatch({ type: 'SET_PROMPT', prompt: ruleSet.description || ruleSet.name });
      dispatch({ type: 'SET_PHASE', phase: 'confirming' });
    },
    [dispatch],
  );

  const handleSnapshot = useCallback(
    async (snapshot: DemoSnapshot) => {
      const preset = getPresetById(snapshot.presetId);
      if (!preset) {
        dispatch({ type: 'SET_ERROR', error: 'Preset not found for snapshot.' });
        return;
      }

      dispatch({ type: 'SET_CONFIG', config: snapshot.config });
      dispatch({ type: 'SET_RULES', rules: preset });
      dispatch({ type: 'SET_PROMPT', prompt: snapshot.displayName });
      dispatch({ type: 'SET_PHASE', phase: 'running' });

      try {
        const result = await executeBacktest(preset, snapshot.config);
        dispatch({ type: 'SET_RESULTS', results: result });
        dispatch({ type: 'SET_PHASE', phase: 'results' });
        addToHistory(result, snapshot.displayName);
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? `Demo failed: ${err.message}` : 'Demo failed.',
        });
      }
    },
    [dispatch, executeBacktest, addToHistory],
  );

  const handleBack = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPARISON' });
    dispatch({ type: 'SET_PHASE', phase: 'input' });
    setIsComparing(false);
  }, [dispatch]);

  const handleConfigChange = useCallback(
    (config: StrategyConfig) => {
      dispatch({ type: 'SET_CONFIG', config });
    },
    [dispatch],
  );

  const handleRestore = useCallback(
    (result: BacktestResult) => {
      dispatch({ type: 'RESTORE_RESULT', result });
      setIsComparing(false);
    },
    [dispatch],
  );

  const handleAssetSwap = useCallback(
    async (newAsset: AssetSymbol) => {
      if (!state.currentRules) return;
      const newConfig = { ...state.config, asset: newAsset };
      dispatch({ type: 'SET_CONFIG', config: newConfig });

      try {
        const result = await executeBacktest(state.currentRules, newConfig);
        dispatch({ type: 'SET_RESULTS', results: result });
        addToHistory(result, state.currentPrompt || state.currentRules.name);

        // Re-run comparison if active
        if (state.results[1] && state.phase === 'comparing') {
          const compareResult = await executeBacktest(state.results[1].config.rules, newConfig);
          dispatch({ type: 'SET_COMPARISON', results: compareResult });
        }
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Asset swap failed.',
        });
      }
    },
    [state.currentRules, state.config, state.currentPrompt, state.results, state.phase, dispatch, executeBacktest, addToHistory],
  );

  const handleCompare = useCallback(
    async (compareRules: StrategyRuleSet) => {
      try {
        const result = await executeBacktest(compareRules, state.config);
        dispatch({ type: 'SET_COMPARISON', results: result });
        addToHistory(result, compareRules.description || compareRules.name);
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Comparison backtest failed.',
        });
      }
    },
    [state.config, dispatch, executeBacktest, addToHistory],
  );

  const handleCompareWithPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      setIsComparing(true);
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, asset: state.config.asset, timeframe: '1D' }),
        });
        const data = await res.json();
        setIsComparing(false);

        if (res.status === 429 && data.retryAfter) {
          rateLimitControls.setRateLimitType(data.limitType ?? 'minute');
          rateLimitControls.startRateLimitCountdown(data.retryAfter);
          return;
        }

        if (!data.success) {
          dispatch({ type: 'SET_ERROR', error: data.error });
          return;
        }

        await handleCompare(data.ruleSet);
      } catch {
        setIsComparing(false);
        dispatch({
          type: 'SET_ERROR',
          error: 'Failed to parse comparison strategy.',
        });
      }
    },
    [state.config.asset, dispatch, handleCompare, rateLimitControls],
  );

  return {
    executeBacktest,
    addToHistory,
    isComparing,
    handleParse,
    handleConfirm,
    handlePreset,
    handleSnapshot,
    handleBack,
    handleConfigChange,
    handleRestore,
    handleAssetSwap,
    handleCompare,
    handleCompareWithPrompt,
  };
}
