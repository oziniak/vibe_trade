'use client';

import type { StrategyRuleSet } from '@/types/strategy';
import type { DemoSnapshot } from '@/types/results';
import { PRESETS } from '@/data/presets';
import { DEMO_SNAPSHOTS } from '@/data/snapshots';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface PresetGalleryProps {
  onSelectPreset: (ruleSet: StrategyRuleSet) => void;
  onSelectSnapshot: (snapshot: DemoSnapshot) => void;
}

export function PresetGallery({
  onSelectPreset,
  onSelectSnapshot,
}: PresetGalleryProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">
          Preset Strategies
        </h3>
        <p className="text-xs text-slate-600 mb-3">
          Runs with your current asset &amp; date range settings
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <Card
              key={preset.id}
              className="bg-vt-bg3/30 border-vt-line/50 hover:border-vt-line hover:bg-vt-bg3/50 cursor-pointer transition-all py-3 gap-1 min-h-[48px]"
              onClick={() => onSelectPreset(preset)}
            >
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {preset.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      preset.mode.type === 'dca'
                        ? 'border-blue-500/40 text-blue-400'
                        : 'border-violet-500/40 text-violet-400'
                    }`}
                  >
                    {preset.mode.type === 'dca' ? 'DCA' : 'Standard'}
                  </Badge>
                </div>
                {preset.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {preset.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">
          Quick Demos
        </h3>
        <p className="text-xs text-slate-600 mb-3">
          Pre-configured strategy + asset + date range, one click
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEMO_SNAPSHOTS.map((snapshot) => (
            <Card
              key={snapshot.id}
              className="bg-vt-bg3/30 border-vt-line/50 hover:border-vt/40 hover:bg-vt-bg3/50 cursor-pointer transition-all py-3 gap-1 min-h-[48px]"
              onClick={() => onSelectSnapshot(snapshot)}
            >
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-vt-dim shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                    />
                  </svg>
                  <span className="text-xs text-slate-300">
                    {snapshot.displayName}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
