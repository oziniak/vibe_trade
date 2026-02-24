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
import { DatePicker } from '@/components/ui/date-picker';
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
  /** Seconds remaining on rate-limit cooldown (0 = no limit) */
  rateLimitSeconds?: number;
}

export function StrategyInput({
  onParse,
  config,
  onConfigChange,
  isParsing = false,
  rateLimitSeconds = 0,
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
  const isRateLimited = rateLimitSeconds > 0;
  const isParseDisabled = isPromptEmpty || hasValidationErrors || isParsing || isRateLimited;

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
        className="relative rounded-2xl border border-vt/15 bg-vt-bg2/50
          shadow-[0_0_80px_-20px_var(--vt-glow)]
          focus-within:border-vt/30 focus-within:shadow-[0_0_60px_-10px_var(--vt-glow)]
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
            onClick={() => {
                if (isListening) {
                  if (interimTranscript) {
                    setPrompt((prev) => prev + (prev ? ' ' : '') + interimTranscript);
                  }
                  stopListening();
                } else {
                  startListening();
                }
              }}
            aria-label={isListening ? 'Stop dictation' : 'Start voice input'}
            className={`absolute right-3 top-3 p-1.5 rounded-lg transition-all duration-150 ${
              isListening
                ? 'text-red-400 bg-red-500/10 ring-2 ring-red-500/30 animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-vt-bg3/60'
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
            <span className="text-[11px] text-vt-line hidden sm:inline select-none">
              Cmd+Enter
            </span>
            <button
              onClick={handleParse}
              disabled={isParseDisabled}
              className={`inline-flex items-center gap-2 rounded-xl text-sm font-medium px-4 h-8
                disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.97]
                ${isRateLimited
                  ? 'bg-amber-500/15 text-amber-400/70 border border-amber-500/20 disabled:opacity-70'
                  : 'bg-vt hover:bg-vt-hover text-white disabled:opacity-30'
                }`}
            >
              {isRateLimited ? (
                <>
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono tabular-nums text-xs">
                    {rateLimitSeconds >= 60
                      ? `${Math.floor(rateLimitSeconds / 60)}:${String(rateLimitSeconds % 60).padStart(2, '0')}`
                      : `0:${String(rateLimitSeconds).padStart(2, '0')}`}
                  </span>
                </>
              ) : isParsing ? (
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
            className="text-[12px] text-slate-500 hover:text-vt-dim
              bg-transparent hover:bg-vt/[0.05]
              border border-vt-line/40 hover:border-vt/25
              rounded-full px-3 py-1.5 transition-all duration-150
              max-w-[260px] truncate cursor-pointer"
          >
            {example}
          </button>
        ))}
      </div>

      {/* ── Config Controls (Booking Style) ──────────────────────── */}
      <div className="rounded-xl border border-vt/10 bg-vt-bg2/30 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-vt/[0.06]">
          {/* Asset */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-vt-line/30">
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
              Asset
            </label>
            <Select
              value={config.asset}
              onValueChange={(value) =>
                onConfigChange({ ...config, asset: value as AssetSymbol })
              }
            >
              <SelectTrigger className="data-[size=default]:h-6 w-full border-0 shadow-none bg-transparent p-0 text-sm text-slate-200 focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-vt-line">
                {ASSETS.map((asset) => (
                  <SelectItem
                    key={asset}
                    value={asset}
                    className="text-slate-100 focus:bg-vt-bg3"
                  >
                    {asset}/USD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-vt-line/30">
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
              From
            </label>
            <DatePicker
              value={config.startDate}
              onChange={(date) =>
                onConfigChange({ ...config, startDate: date })
              }
            />
          </div>

          {/* End Date */}
          <div className="px-3 py-2.5 col-span-1 border-b lg:border-b-0 border-vt-line/30">
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
              To
            </label>
            <DatePicker
              value={config.endDate}
              onChange={(date) =>
                onConfigChange({ ...config, endDate: date })
              }
            />
          </div>

          {/* Capital */}
          <div className="px-3 py-2.5 col-span-1 border-b sm:border-b-0 border-vt-line/30">
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
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
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
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
              <span className="text-[10px] text-slate-400 ml-0.5 shrink-0">bps</span>
            </div>
          </div>

          {/* Slippage */}
          <div className="px-3 py-2.5 col-span-1">
            <label className="text-[10px] text-vt-dim/60 uppercase tracking-wider font-medium block mb-1">
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
              <span className="text-[10px] text-slate-400 ml-0.5 shrink-0">bps</span>
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
