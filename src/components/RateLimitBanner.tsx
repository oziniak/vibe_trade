'use client';

import { Timer } from 'lucide-react';

interface RateLimitBannerProps {
  /** Seconds remaining (already ticking from parent useCountdown) */
  retryAfter: number;
  limitType: 'minute' | 'daily';
  onExpired: () => void;
  onBrowsePresets: () => void;
}

function formatTime(seconds: number) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `0:${String(seconds).padStart(2, '0')}`;
}

export function RateLimitBanner({
  retryAfter,
  limitType,
  onBrowsePresets,
}: RateLimitBannerProps) {
  const isDaily = limitType === 'daily';

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 w-full max-w-[680px] mx-auto">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-lg bg-amber-500/10 p-1.5">
            <Timer className="size-3.5 text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm text-amber-200/90 font-medium">
                {isDaily ? 'Daily limit reached' : 'Cooldown active'}
              </p>
              {retryAfter > 0 && (
                <span className="font-mono text-xs text-amber-400/80 tabular-nums tracking-wide">
                  {formatTime(retryAfter)}
                </span>
              )}
            </div>

            <p className="text-xs text-amber-300/50 mt-1 leading-relaxed">
              {isDaily
                ? 'You\'ve used all 10 AI parses for today. Limits reset at midnight UTC.'
                : `Rate limit: 5 requests per minute. ${retryAfter > 0 ? 'Ready soon.' : ''}`}
            </p>

            <button
              onClick={onBrowsePresets}
              className="mt-2 text-[11px] text-amber-400/60 hover:text-amber-300/80
                inline-flex items-center gap-1 transition-colors duration-150"
            >
              <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Try a preset strategy instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
