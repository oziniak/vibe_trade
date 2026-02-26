'use client';

import { useState } from 'react';
import type { StrategyRuleSet } from '@/types/strategy';
import { getPresetById } from '@/data/presets';
import { Button } from '@/components/ui/button';

const COMPARE_PRESETS = [
  { label: 'Weekly DCA', id: 'preset-weekly-dca' },
  { label: 'Golden Cross', id: 'preset-golden-cross' },
  { label: 'MACD Momentum', id: 'preset-macd-momentum' },
] as const;

export function CompareSection({
  isComparing,
  onCompareWithPrompt,
  onCompareWithPreset,
}: {
  isComparing: boolean;
  onCompareWithPrompt: (prompt: string) => void;
  onCompareWithPreset: (ruleSet: StrategyRuleSet) => void;
}) {
  const [comparePrompt, setComparePrompt] = useState('');

  return (
    <div className="rounded-lg border border-vt-line/30 bg-vt-bg3/10 p-4">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Compare with another strategy</h3>
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <input
          type="text"
          value={comparePrompt}
          onChange={(e) => setComparePrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCompareWithPrompt(comparePrompt)}
          placeholder='e.g., "DCA $100 into BTC every week"'
          className="flex-1 rounded-md border border-vt-line bg-vt-bg2/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-vt"
        />
        <Button
          size="sm"
          onClick={() => onCompareWithPrompt(comparePrompt)}
          disabled={isComparing || !comparePrompt.trim()}
          className="bg-vt hover:bg-vt-hover text-white"
        >
          {isComparing ? 'Parsing...' : 'Compare'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {COMPARE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              const preset = getPresetById(p.id);
              if (preset) onCompareWithPreset(preset);
            }}
            className="text-xs px-2 py-1 rounded border border-vt-line/50 text-slate-500 hover:text-slate-300 hover:border-vt-line transition-colors"
          >
            vs {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
