import type { StrategyRuleSet } from '@/types/strategy';
import { RuleConfirmation } from '@/components/RuleConfirmation';

export function ConfirmingPhase({
  rules,
  onConfirm,
  onBack,
}: {
  rules: StrategyRuleSet;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-[440px] shrink-0">
        <RuleConfirmation
          rules={rules}
          onConfirm={onConfirm}
          onBack={onBack}
          isRunning={false}
        />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <div className="text-center space-y-3 py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-vt-bg3/50 border border-vt-line/50 flex items-center justify-center">
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
  );
}
