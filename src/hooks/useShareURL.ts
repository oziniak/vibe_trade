'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from '@/app/state';
import type { AppState, BacktestResult } from '@/types/results';
import type { StrategyRuleSet } from '@/types/strategy';
import { decodeShareURL } from '@/lib/export';

export function useShareURL(
  dispatch: Dispatch<AppAction>,
  executeBacktest: (rules: StrategyRuleSet, config: AppState['config']) => Promise<BacktestResult>,
  addToHistory: (result: BacktestResult, prompt: string) => void,
) {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;

    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (!shareParam) return;

    const decoded = decodeShareURL(shareParam);
    if (!decoded) return;

    loaded.current = true;

    // Clean the URL without reloading the page
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    const config: AppState['config'] = {
      asset: decoded.asset,
      startDate: decoded.startDate,
      endDate: decoded.endDate,
      initialCapital: decoded.initialCapital,
      feeBps: decoded.feeBps,
      slippageBps: decoded.slippageBps,
    };

    // Set config and rules, then auto-run the backtest
    dispatch({ type: 'SET_CONFIG', config });
    dispatch({ type: 'SET_RULES', rules: decoded.rules });
    dispatch({ type: 'SET_PROMPT', prompt: decoded.rules.description || decoded.rules.name });
    dispatch({ type: 'SET_PHASE', phase: 'running' });

    executeBacktest(decoded.rules, config)
      .then((backtestResult) => {
        dispatch({ type: 'SET_RESULTS', results: backtestResult });
        dispatch({ type: 'SET_PHASE', phase: 'results' });
        addToHistory(backtestResult, decoded.rules.description || decoded.rules.name);
      })
      .catch((err) => {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? `Shared backtest failed: ${err.message}` : 'Shared backtest failed.',
        });
      });
  }, [dispatch, executeBacktest, addToHistory]);
}
