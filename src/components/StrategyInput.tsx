'use client';

import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import type { AssetSymbol } from '@/types/strategy';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // --- Voice input hook ---
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

  // Sync voice errors with auto-dismiss
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

  // Compute displayed textarea value: show interim transcript while listening
  const displayValue =
    isListening && interimTranscript
      ? prompt + (prompt ? ' ' : '') + interimTranscript
      : prompt;

  return (
    <div className="flex flex-col gap-5">
      {/* Strategy prompt */}
      <div className="space-y-2">
        <Label htmlFor="strategy-prompt" className="text-sm font-medium text-slate-300">
          Describe your strategy
        </Label>

        {/* Textarea with mic button overlay */}
        <div className="relative">
          <Textarea
            id="strategy-prompt"
            placeholder="e.g., Buy when RSI drops below 30, sell when it rises above 70"
            value={displayValue}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className={`resize-none bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 ${isSupported ? 'pr-11' : ''}`}
          />

          {isSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? 'Stop dictation' : 'Start voice input'}
              className={`absolute right-2 top-2 rounded-full transition-all duration-150 ${
                isListening
                  ? 'text-red-400 bg-red-500/10 ring-2 ring-red-500/30 animate-pulse hover:bg-red-500/20 hover:text-red-300'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Mic className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Voice error notification */}
        {voiceError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <svg
              className="size-3.5 text-red-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
            <p className="text-xs text-red-300/90 leading-relaxed">{voiceError}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              onClick={() => setPrompt(example)}
              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-md px-2.5 py-1.5 transition-colors truncate max-w-[250px] min-h-[36px]"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Asset selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-300">Asset</Label>
        <Select
          value={config.asset}
          onValueChange={(value) =>
            onConfigChange({ ...config, asset: value as AssetSymbol })
          }
        >
          <SelectTrigger className="w-full bg-slate-900/50 border-slate-700 text-slate-100">
            <SelectValue placeholder="Select asset" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {ASSETS.map((asset) => (
              <SelectItem key={asset} value={asset} className="text-slate-100 focus:bg-slate-700">
                {asset}/USD
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start-date" className="text-sm font-medium text-slate-300">
            Start Date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={config.startDate}
            onChange={(e) =>
              onConfigChange({ ...config, startDate: e.target.value })
            }
            className="bg-slate-900/50 border-slate-700 text-slate-100 [color-scheme:dark] min-h-[44px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date" className="text-sm font-medium text-slate-300">
            End Date
          </Label>
          <Input
            id="end-date"
            type="date"
            value={config.endDate}
            onChange={(e) =>
              onConfigChange({ ...config, endDate: e.target.value })
            }
            className="bg-slate-900/50 border-slate-700 text-slate-100 [color-scheme:dark] min-h-[44px]"
          />
        </div>
      </div>

      {/* Capital */}
      <div className="space-y-2">
        <Label htmlFor="initial-capital" className="text-sm font-medium text-slate-300">
          Initial Capital (USD)
        </Label>
        <Input
          id="initial-capital"
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
          className="bg-slate-900/50 border-slate-700 text-slate-100 min-h-[44px]"
        />
      </div>

      {/* Fees */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="fee-bps" className="text-sm font-medium text-slate-300">
            Fee (bps)
          </Label>
          <Input
            id="fee-bps"
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
            className="bg-slate-900/50 border-slate-700 text-slate-100 min-h-[44px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slippage-bps" className="text-sm font-medium text-slate-300">
            Slippage (bps)
          </Label>
          <Input
            id="slippage-bps"
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
            className="bg-slate-900/50 border-slate-700 text-slate-100 min-h-[44px]"
          />
        </div>
      </div>

      {/* Validation errors */}
      {hasValidationErrors && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-amber-300 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Parse button */}
      <Button
        onClick={handleParse}
        disabled={isParseDisabled}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 mt-1"
        size="lg"
      >
        {isParsing ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Parsing strategy...
          </span>
        ) : (
          'Parse Strategy'
        )}
      </Button>

      <p className="text-xs text-slate-500 text-center">
        Press Cmd+Enter to parse. AI will convert your description into trading rules.
      </p>
    </div>
  );
}
