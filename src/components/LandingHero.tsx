'use client';

import { cn } from '@/lib/utils';

const steps = [
  {
    number: '01',
    title: 'Describe',
    description: 'Type your trading idea in plain English',
    icon: (
      <svg
        className="size-5 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Parse',
    description: 'AI converts it into validated trading rules',
    icon: (
      <svg
        className="size-5 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
        />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Analyze',
    description: 'See charts, metrics, and trade logs',
    icon: (
      <svg
        className="size-5 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle background gradient accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/[0.07] rounded-full blur-3xl" />
      </div>

      <div className="py-12 sm:py-16 space-y-10">
        {/* Headline block */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100 leading-snug">
            Describe a trading strategy in plain English.
            <br />
            <span className="text-indigo-400">
              See if it would&apos;ve made money.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
            AI-powered backtesting for 8 crypto assets with professional
            analytics &mdash; no code required.
          </p>
        </div>

        {/* How it works steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={cn(
                'relative rounded-lg border border-slate-800/80 bg-slate-900/60 p-4',
                'transition-colors hover:border-slate-700/80 hover:bg-slate-800/40'
              )}
            >
              {/* Connector line between steps (hidden on mobile) */}
              {i < steps.length - 1 && (
                <div className="absolute top-1/2 -right-2 hidden sm:block w-4 h-px bg-slate-700/60" />
              )}

              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/20">
                  {step.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-600 tracking-wider">
                      {step.number}
                    </span>
                    <span className="text-sm font-medium text-slate-200">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
