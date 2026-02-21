'use client';

import { useReducer, useCallback, useEffect, useState } from 'react';
import type { AssetSymbol, StrategyRuleSet } from '@/types/strategy';
import type {
  AppState,
  AppPhase,
  BacktestConfig,
  BacktestResult,
  Candle,
  DemoSnapshot,
  RunSnapshot,
  Trade,
} from '@/types/results';
import { runBacktest } from '@/engine/backtest';
import { loadCandles } from '@/data/loader';
import { getPresetById } from '@/data/presets';
import type { ParseResponse } from '@/lib/parser';

import { StrategyInput, type StrategyConfig } from '@/components/StrategyInput';
import { RuleConfirmation } from '@/components/RuleConfirmation';
import { PriceChart } from '@/components/PriceChart';
import { MetricsGrid } from '@/components/MetricsGrid';
import { TradeLog } from '@/components/TradeLog';
import { PresetGallery } from '@/components/PresetGallery';
import { EquityCurve } from '@/components/EquityCurve';
import { AuditPanel } from '@/components/AuditPanel';
import { LandingHero } from '@/components/LandingHero';
import { RunHistory } from '@/components/RunHistory';
import { ComparisonView } from '@/components/ComparisonView';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import {
  tradesToCSV,
  resultToJSON,
  generateShareURL,
  decodeShareURL,
  downloadFile,
} from '@/lib/export';

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

const ASSETS: AssetSymbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'];

type AppAction =
  | { type: 'SET_PHASE'; phase: AppPhase }
  | { type: 'SET_CONFIG'; config: AppState['config'] }
  | { type: 'SET_RULES'; rules: StrategyRuleSet }
  | { type: 'SET_RESULTS'; results: BacktestResult }
  | { type: 'SET_COMPARISON'; results: BacktestResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_PROMPT'; prompt: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_HISTORY'; snapshot: RunSnapshot }
  | { type: 'RESTORE_RESULT'; result: BacktestResult };

const initialConfig: AppState['config'] = {
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10000,
  feeBps: 10,
  slippageBps: 5,
};

const initialState: AppState = {
  phase: 'input',
  config: initialConfig,
  currentPrompt: '',
  currentRules: null,
  results: [null, null],
  runHistory: [],
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase, error: null };
    case 'SET_CONFIG':
      return { ...state, config: action.config };
    case 'SET_RULES':
      return { ...state, currentRules: action.rules };
    case 'SET_RESULTS':
      return { ...state, results: [action.results, state.results[1]] };
    case 'SET_COMPARISON':
      return { ...state, results: [state.results[0], action.results], phase: 'comparing' };
    case 'SET_ERROR':
      return { ...state, error: action.error, phase: state.phase === 'parsing' ? 'input' : state.phase };
    case 'SET_PROMPT':
      return { ...state, currentPrompt: action.prompt };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'ADD_HISTORY':
      return { ...state, runHistory: [action.snapshot, ...state.runHistory] };
    case 'RESTORE_RESULT':
      return {
        ...state,
        results: [action.result, null],
        currentRules: action.result.config.rules,
        config: {
          asset: action.result.config.asset,
          startDate: action.result.config.startDate,
          endDate: action.result.config.endDate,
          initialCapital: action.result.config.initialCapital,
          feeBps: action.result.config.feeBps,
          slippageBps: action.result.config.slippageBps,
        },
        phase: 'results',
        error: null,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Loading Spinner
// ---------------------------------------------------------------------------

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-t-indigo-500 animate-spin" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [comparePrompt, setComparePrompt] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoaded, setShareLoaded] = useState(false);

  // ── Run backtest helper ─────────────────────────────────────────────
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
    []
  );

  // ── Add to run history ──────────────────────────────────────────────
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
    []
  );

  // ── Handle parse ──────────────────────────────────────────────────────
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
        const data: ParseResponse = await res.json();

        if (!data.success) {
          dispatch({ type: 'SET_ERROR', error: data.error });
          return;
        }

        dispatch({ type: 'SET_RULES', rules: data.ruleSet });
        dispatch({ type: 'SET_PHASE', phase: 'confirming' });
      } catch {
        dispatch({
          type: 'SET_ERROR',
          error: 'Failed to connect to the AI parser. Try a preset strategy instead.',
        });
      }
    },
    []
  );

  // ── Handle confirm (run backtest) ─────────────────────────────────────
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
  }, [state.currentRules, state.config, state.currentPrompt, executeBacktest, addToHistory]);

  // ── Handle preset selection ───────────────────────────────────────────
  const handlePreset = useCallback((ruleSet: StrategyRuleSet) => {
    dispatch({ type: 'SET_RULES', rules: ruleSet });
    dispatch({ type: 'SET_PROMPT', prompt: ruleSet.description || ruleSet.name });
    dispatch({ type: 'SET_PHASE', phase: 'confirming' });
  }, []);

  // ── Handle demo snapshot ──────────────────────────────────────────────
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
    [executeBacktest, addToHistory]
  );

  // ── Handle back ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'input' });
    setIsComparing(false);
    setComparePrompt('');
  }, []);

  // ── Handle config changes ─────────────────────────────────────────────
  const handleConfigChange = useCallback((config: StrategyConfig) => {
    dispatch({ type: 'SET_CONFIG', config });
  }, []);

  // ── Handle restore from history ─────────────────────────────────────
  const handleRestore = useCallback((result: BacktestResult) => {
    dispatch({ type: 'RESTORE_RESULT', result });
    setIsComparing(false);
    setComparePrompt('');
  }, []);

  // ── Handle asset swap ──────────────────────────────────────────────
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
    [state.currentRules, state.config, state.currentPrompt, state.results, state.phase, executeBacktest, addToHistory]
  );

  // ── Handle compare ─────────────────────────────────────────────────
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
    [state.config, executeBacktest, addToHistory]
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
        const data: ParseResponse = await res.json();
        setIsComparing(false);

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
    [state.config.asset, handleCompare]
  );

  // ── Load shared config from URL ────────────────────────────────────
  useEffect(() => {
    if (shareLoaded) return;

    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (!shareParam) return;

    const decoded = decodeShareURL(shareParam);
    if (!decoded) return;

    setShareLoaded(true);

    // Clean the URL without reloading the page
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Set config and rules, then auto-run the backtest
    dispatch({
      type: 'SET_CONFIG',
      config: {
        asset: decoded.asset,
        startDate: decoded.startDate,
        endDate: decoded.endDate,
        initialCapital: decoded.initialCapital,
        feeBps: decoded.feeBps,
        slippageBps: decoded.slippageBps,
      },
    });
    dispatch({ type: 'SET_RULES', rules: decoded.rules });
    dispatch({ type: 'SET_PROMPT', prompt: decoded.rules.description || decoded.rules.name });
    dispatch({ type: 'SET_PHASE', phase: 'running' });

    // Run the backtest
    executeBacktest(decoded.rules, {
      asset: decoded.asset,
      startDate: decoded.startDate,
      endDate: decoded.endDate,
      initialCapital: decoded.initialCapital,
      feeBps: decoded.feeBps,
      slippageBps: decoded.slippageBps,
    })
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
  }, [shareLoaded, executeBacktest, addToHistory]);

  // ── Render ────────────────────────────────────────────────────────────

  const result = state.results[0];
  const comparisonResult = state.results[1];
  const showResults = (state.phase === 'results' || state.phase === 'comparing') && result;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
              Vibe Trade
            </h1>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Crypto Strategy Backtester
            </span>
          </button>
          {state.phase !== 'input' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-slate-400 hover:text-slate-200"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              New Strategy
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {/* Error toast */}
        {state.error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
            <svg className="h-5 w-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-300">{state.error}</p>
              {state.error.includes('preset') && state.phase === 'input' && (
                <button
                  onClick={() => {
                    dispatch({ type: 'CLEAR_ERROR' });
                    document.getElementById('preset-gallery')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                >
                  Browse preset strategies
                </button>
              )}
            </div>
            <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })} className="text-red-400 hover:text-red-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Phase: Input */}
        {state.phase === 'input' && (
          <div>
            <LandingHero />
            <div className="mt-8 flex flex-col lg:flex-row gap-6">
              <div className="lg:w-[380px] shrink-0 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-200 mb-1">Define Your Strategy</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Describe a trading strategy in plain English, or pick a preset below.
                  </p>
                  <StrategyInput
                    onParse={handleParse}
                    config={state.config}
                    onConfigChange={handleConfigChange}
                    isParsing={false}
                  />
                </div>
                {state.runHistory.length > 0 && (
                  <RunHistory history={state.runHistory} onRestore={handleRestore} />
                )}
              </div>
              <div className="flex-1 min-w-0" id="preset-gallery">
                <PresetGallery onSelectPreset={handlePreset} onSelectSnapshot={handleSnapshot} />
              </div>
            </div>
          </div>
        )}

        {/* Phase: Parsing */}
        {state.phase === 'parsing' && <LoadingSpinner message="AI is parsing your strategy..." />}

        {/* Phase: Confirming */}
        {state.phase === 'confirming' && state.currentRules && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-[440px] shrink-0">
              <RuleConfirmation
                rules={state.currentRules}
                onConfirm={handleConfirm}
                onBack={handleBack}
                isRunning={false}
              />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <div className="text-center space-y-3 py-16">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                  <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">
                  Review the parsed rules, then click &quot;Run Backtest&quot; to see results.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Phase: Running */}
        {state.phase === 'running' && <LoadingSpinner message="Running backtest..." />}

        {/* Phase: Results / Comparing */}
        {showResults && (
          <div className="space-y-6">
            {/* Result header with asset swap */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {state.currentRules?.name ?? 'Backtest Results'}
                </h2>
                <p className="text-sm text-slate-500">
                  {result.config.startDate} to {result.config.endDate} &middot;
                  Capital: ${result.config.initialCapital.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start flex-wrap">
                {/* Asset swap buttons */}
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/30 p-0.5">
                  {ASSETS.map((a) => (
                    <button
                      key={a}
                      onClick={() => handleAssetSwap(a)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        a === state.config.asset
                          ? 'bg-indigo-600 text-white'
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
                  onClick={handleBack}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  New
                </Button>
              </div>
            </div>

            {/* Export toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200 h-8 px-3 text-xs"
                onClick={() => {
                  const csv = tradesToCSV(result.trades);
                  const filename = `${result.config.asset}-trades-${result.config.startDate}-to-${result.config.endDate}.csv`;
                  downloadFile(csv, filename, 'text/csv');
                }}
              >
                <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200 h-8 px-3 text-xs"
                onClick={() => {
                  const json = resultToJSON(result);
                  const filename = `${result.config.asset}-backtest-${result.config.startDate}-to-${result.config.endDate}.json`;
                  downloadFile(json, filename, 'application/json');
                }}
              >
                <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export JSON
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200 h-8 px-3 text-xs"
                onClick={async () => {
                  try {
                    const url = generateShareURL(result);
                    await navigator.clipboard.writeText(url);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  } catch {
                    // Fallback: select from a temporary input
                    const url = generateShareURL(result);
                    const input = document.createElement('input');
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
              >
                <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
                </svg>
                {shareCopied ? 'Copied!' : 'Copy Share Link'}
              </Button>
            </div>

            {/* Metrics */}
            <MetricsGrid metrics={result.metrics} benchmarkReturn={result.benchmark.totalReturn} />

            {/* Comparison view (overlaid equity curves + metrics table with deltas) */}
            {comparisonResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => dispatch({ type: 'SET_PHASE', phase: 'results' })}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Remove Comparison
                  </button>
                </div>
                <ComparisonView resultA={result} resultB={comparisonResult} />
              </div>
            )}

            {/* Equity curve */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Equity Curve
              </h3>
              <EquityCurve equityCurve={result.equityCurve} />
            </div>

            {/* Price chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Price Chart
              </h3>
              <ChartWithData
                asset={result.config.asset}
                startDate={result.config.startDate}
                endDate={result.config.endDate}
                trades={result.trades}
                indicatorData={result.indicatorData}
              />
            </div>

            {/* Warmup exceeds range warning */}
            {result.trades.length === 0 && result.audit.warmupCandles > 0 && result.audit.warmupCandles >= result.audit.totalCandles * 0.8 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-300">Warmup period consumed most of the data</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    The indicator warmup period ({result.audit.warmupCandles} candles) consumed most of the available data range
                    ({result.audit.totalCandles} total candles), leaving only {result.audit.tradableCandles} tradable candles.
                    Try using shorter indicator periods or a wider date range.
                  </p>
                </div>
              </div>
            )}

            {/* Trade log */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Trade Log ({result.trades.length} trades)
              </h3>
              {result.trades.length === 0 ? (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-6 text-center">
                  <p className="text-slate-400">No trades were generated by this strategy.</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Try adjusting the indicator parameters or date range.
                  </p>
                </div>
              ) : (
                <TradeLog trades={result.trades} />
              )}
            </div>

            {/* Audit panel */}
            <AuditPanel audit={result.audit} />

            {/* Compare section */}
            {!comparisonResult && (
              <div className="rounded-lg border border-slate-700/30 bg-slate-800/10 p-4">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Compare with another strategy</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={comparePrompt}
                    onChange={(e) => setComparePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCompareWithPrompt(comparePrompt)}
                    placeholder='e.g., "DCA $100 into BTC every week"'
                    className="flex-1 rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCompareWithPrompt(comparePrompt)}
                    disabled={isComparing || !comparePrompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isComparing ? 'Parsing...' : 'Compare'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: 'Weekly DCA', id: 'preset-weekly-dca' },
                    { label: 'Golden Cross', id: 'preset-golden-cross' },
                    { label: 'MACD Momentum', id: 'preset-macd-momentum' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const preset = getPresetById(p.id);
                        if (preset) handleCompare(preset);
                      }}
                      className="text-xs px-2 py-1 rounded border border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
                    >
                      vs {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Run history (in results view) */}
            {state.runHistory.length > 0 && (
              <RunHistory history={state.runHistory} onRestore={handleRestore} />
            )}
          </div>
        )}
      </main>
    </div>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// ChartWithData: loads candles for the chart
// ---------------------------------------------------------------------------

function ChartWithData({
  asset,
  startDate,
  endDate,
  trades,
  indicatorData,
}: {
  asset: AssetSymbol;
  startDate: string;
  endDate: string;
  trades: Trade[];
  indicatorData?: Record<string, (number | null)[]>;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [allCandlesState, setAllCandlesState] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadCandles(asset)
      .then((allCandles) => {
        if (cancelled) return;
        setAllCandlesState(allCandles);
        const filtered = allCandles.filter((c) => c.t >= startDate && c.t <= endDate);
        setCandles(filtered);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [asset, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-slate-700/50 bg-slate-900/50">
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading chart data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] rounded-lg border border-red-500/30 bg-red-500/5">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <PriceChart
      candles={candles}
      trades={trades}
      indicatorData={indicatorData}
      allCandles={allCandlesState}
    />
  );
}
