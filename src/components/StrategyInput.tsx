'use client';

import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import type { AssetSymbol } from '@/types/strategy';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const ASSETS: AssetSymbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'];

const EXAMPLE_PROMPTS = [
  'Buy when RSI drops below 30, sell when it rises above 70',
  'Buy when 50-day MA crosses above 200-day MA, sell on death cross',
  'DCA $100 into BTC every week',
  'Buy 10% weekly dips, take profit at 20%, stop loss at 5%',
];

export interface StrategyConfig {
  asset: AssetSymbol;
  startDate: string;
  endDate: string;
  initialCapital: number;
  feeBps: number;
  slippageBps: number;
}

interface StrategyInputProps {
  onParse: (prompt: string, config: StrategyConfig) => void;
  config: StrategyConfig;
  onConfigChange: (config: StrategyConfig) => void;
  isParsing?: boolean;
}

export function StrategyInput({
  onParse,
  config,
  onConfigChange,
  isParsing = false,
}: StrategyInputProps) {
  const [prompt, setPrompt] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    silenceTimeoutMs: 5000,
    onFinalTranscript: (text) =>
      setPrompt((prev) => prev + (prev ? ' ' : '') + text),
  });

  useEffect(() => {
    if (!speechError) {
      setVoiceError(null);
      return;
    }
    setVoiceError(speechError);
    const timer = setTimeout(() => setVoiceError(null), 5000);
    return () => clearTimeout(timer);
  }, [speechError]);

  // --- Validation ---
  const validationErrors: string[] = [];
  if (config.initialCapital <= 0) {
    validationErrors.push('Initial capital must be greater than 0.');
  }
  if (config.startDate && config.endDate && config.startDate >= config.endDate) {
    validationErrors.push('Start date must be before end date.');
  }
  if (config.feeBps < 0) {
    validationErrors.push('Fee must be zero or positive.');
  }
  if (config.slippageBps < 0) {
    validationErrors.push('Slippage must be zero or positive.');
  }

  const isPromptEmpty = !prompt.trim();
  const hasValidationErrors = validationErrors.length > 0;
  const isParseDisabled = isPromptEmpty || hasValidationErrors || isParsing;

  const handleParse = () => {
    if (isParseDisabled) return;
    onParse(prompt.trim(), config);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleParse();
    }
  };

  const displayValue =
    isListening && interimTranscript
      ? prompt + (prompt ? ' ' : '') + interimTranscript
      : prompt;

  return (
    <div className="w-full max-w-[680px] mx-auto space-y-4">
      {/* ── Command Bar ────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl border border-slate-700/40 bg-slate-900/50
          shadow-[0_0_80px_-20px_rgba(99,102,241,0.06)]
          focus-within:border-indigo-500/30 focus-within:shadow-[0_0_80px_-15px_rgba(99,102,241,0.12)]
          transition-all duration-300"
      >
        <textarea
          id="strategy-prompt"
          placeholder="Describe your trading strategy in plain English..."
          value={displayValue}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className={`w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-100
            placeholder:text-slate-500 border-none outline-none
            px-5 pt-4 pb-2 rounded-t-2xl
            ${isSupported ? 'pr-12' : ''}`}
        />

        {/* Mic button overlay (top-right of textarea) */}
        {isSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Stop dictation' : 'Start voice input'}
            className={`absolute right-3 top-3 p-1.5 rounded-lg transition-all duration-150 ${
              isListening
                ? 'text-red-400 bg-red-500/10 ring-2 ring-red-500/30 animate-pulse'
                : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Mic className="size-4" />
          </button>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            {isListening && (
              <span className="text-[11px] text-red-400/80 animate-pulse">
                Listening...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600 hidden sm:inline select-none">
              Cmd+Enter
            </span>
            <button
              onClick={handleParse}
              disabled={isParseDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                text-white text-sm font-medium px-4 h-8
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all duration-150 active:scale-[0.97]"
            >
              {isParsing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Parsing...
                </>
              ) : (
                <>
                  Parse
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Mic className="size-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300/90 leading-relaxed">{voiceError}</p>
        </div>
      )}

      {/* ── Example Prompts ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 justify-center px-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            onClick={() => setPrompt(example)}
            className="text-[12px] text-slate-500 hover:text-slate-300
              bg-transparent hover:bg-slate-800/40
              border border-slate-800/60 hover:border-slate-700/60
              rounded-full px-3 py-1.5 transition-all duration-150
              max-w-[260px] truncate"
          >
            {example}
          </button>
        ))}
      </div>

      {/* ── Config Controls (Booking Style) ──────────────────────── */}
      <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 overflow-hidden">
        <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-slate-800/50">
          {/* Asset */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-slate-800/50">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              Asset
            </label>
            <Select
              value={config.asset}
              onValueChange={(value) =>
                onConfigChange({ ...config, asset: value as AssetSymbol })
              }
            >
              <SelectTrigger className="h-6 w-full border-0 shadow-none bg-transparent p-0 text-sm text-slate-200 focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {ASSETS.map((asset) => (
                  <SelectItem
                    key={asset}
                    value={asset}
                    className="text-slate-100 focus:bg-slate-700"
                  >
                    {asset}/USD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-slate-800/50">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              From
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) =>
                onConfigChange({ ...config, startDate: e.target.value })
              }
              className="h-6 w-full bg-transparent text-sm text-slate-200 border-none p-0 outline-none [color-scheme:dark]"
            />
          </div>

          {/* End Date */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-slate-800/50">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              To
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) =>
                onConfigChange({ ...config, endDate: e.target.value })
              }
              className="h-6 w-full bg-transparent text-sm text-slate-200 border-none p-0 outline-none [color-scheme:dark]"
            />
          </div>

          {/* Capital */}
          <div className="px-3 py-2.5 col-span-1">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              Capital
            </label>
            <div className="flex items-center h-6">
              <span className="text-sm text-slate-500">$</span>
              <input
                type="number"
                min={100}
                step={100}
                value={config.initialCapital}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    initialCapital: Math.max(100, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-transparent text-sm text-slate-200 border-none p-0 pl-0.5 outline-none
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Fee */}
          <div className="px-3 py-2.5 col-span-1">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              Fee
            </label>
            <div className="flex items-center h-6">
              <input
                type="number"
                min={0}
                max={100}
                value={config.feeBps}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    feeBps: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-transparent text-sm text-slate-200 border-none p-0 outline-none
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-600 ml-0.5 shrink-0">bps</span>
            </div>
          </div>

          {/* Slippage */}
          <div className="px-3 py-2.5 col-span-1">
            <label className="text-[10px] text-slate-600 uppercase tracking-wider font-medium block mb-1">
              Slippage
            </label>
            <div className="flex items-center h-6">
              <input
                type="number"
                min={0}
                max={100}
                value={config.slippageBps}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    slippageBps: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-transparent text-sm text-slate-200 border-none p-0 outline-none
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-600 ml-0.5 shrink-0">bps</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation errors */}
      {hasValidationErrors && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-amber-300 flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-amber-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
