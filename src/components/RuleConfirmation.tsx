'use client';

import { useState } from 'react';
import type { StrategyRuleSet, Condition } from '@/types/strategy';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface RuleConfirmationProps {
  rules: StrategyRuleSet;
  onConfirm: () => void;
  onBack: () => void;
  isRunning?: boolean;
}

function ConfidenceBadge({
  confidence,
}: {
  confidence?: 'low' | 'medium' | 'high';
}) {
  if (!confidence) return null;

  const styles = {
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[confidence]}`}
    >
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
    </span>
  );
}

function ConditionCard({
  condition,
  type,
}: {
  condition: Condition;
  type: 'entry' | 'exit';
}) {
  const borderColor =
    type === 'entry'
      ? 'border-l-emerald-500'
      : 'border-l-red-400';

  return (
    <div
      className={`rounded-lg border border-vt-line/50 bg-vt-bg3/50 p-3 border-l-2 ${borderColor}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-200">{condition.label}</span>
        {condition.scope === 'position' && (
          <Badge variant="outline" className="text-xs border-vt-line text-slate-400">
            Position
          </Badge>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        ID: {condition.id}
      </p>
    </div>
  );
}

export function RuleConfirmation({
  rules,
  onConfirm,
  onBack,
  isRunning = false,
}: RuleConfirmationProps) {
  const [editedJson, setEditedJson] = useState(
    JSON.stringify(rules, null, 2)
  );

  const metadata = rules.metadata;
  const warnings = metadata?.warnings ?? [];

  return (
    <div className="flex flex-col gap-5">
      {metadata?.parserConfidence === 'low' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <svg
            className="h-5 w-5 text-red-400 mt-0.5 shrink-0"
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
          <p className="text-sm text-red-300">
            The AI parser had low confidence in interpreting your strategy.
            Please carefully review the rules below before confirming.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-100">
            {rules.name}
          </h2>
          <Badge
            className={
              rules.mode.type === 'dca'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-violet-500/20 text-violet-400 border-violet-500/30'
            }
            variant="outline"
          >
            {rules.mode.type === 'dca' ? 'DCA' : 'Standard'}
          </Badge>
          <ConfidenceBadge confidence={metadata?.parserConfidence} />
        </div>
        {rules.description && (
          <p className="text-sm text-slate-400">{rules.description}</p>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <svg
              className="h-4 w-4 text-amber-400"
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
            <span className="text-sm font-medium text-amber-400">
              Warnings
            </span>
          </div>
          <ul className="space-y-1">
            {warnings.map((warning, i) => (
              <li key={i} className="text-xs text-amber-300/80">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="w-full bg-vt-bg3/50 border border-vt-line/50">
          <TabsTrigger value="rules" className="flex-1">
            Rules
          </TabsTrigger>
          <TabsTrigger value="json" className="flex-1">
            JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card className="bg-vt-bg3/30 border-vt-line/50 py-4 gap-3">
            <CardHeader className="py-0">
              <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Entry Conditions
                <Badge variant="outline" className="text-xs border-vt-line text-slate-400">
                  {rules.entry.op}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-0">
              {rules.entry.conditions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {rules.mode.type === 'dca'
                    ? 'DCA mode: automatic periodic entries'
                    : 'No entry conditions specified'}
                </p>
              ) : (
                rules.entry.conditions.map((cond) => (
                  <ConditionCard
                    key={cond.id}
                    condition={cond}
                    type="entry"
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-vt-bg3/30 border-vt-line/50 py-4 gap-3">
            <CardHeader className="py-0">
              <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Exit Conditions
                <Badge variant="outline" className="text-xs border-vt-line text-slate-400">
                  {rules.exit.op}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-0">
              {rules.exit.conditions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {rules.mode.type === 'dca'
                    ? 'DCA mode: positions held until end of period'
                    : 'No exit conditions. Positions held until end of data.'}
                </p>
              ) : (
                rules.exit.conditions.map((cond) => (
                  <ConditionCard
                    key={cond.id}
                    condition={cond}
                    type="exit"
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-vt-bg3/30 border-vt-line/50 py-4 gap-3">
            <CardHeader className="py-0">
              <CardTitle className="text-sm font-medium text-slate-300">
                Position Sizing
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0">
              <p className="text-sm text-slate-400">
                {rules.sizing.type === 'percent_equity'
                  ? `${rules.sizing.valuePct}% of equity per trade`
                  : `$${rules.sizing.valueUsd.toLocaleString()} fixed amount per trade`}
              </p>
              {rules.mode.type === 'dca' && (
                <p className="text-sm text-slate-400 mt-1">
                  DCA: ${rules.mode.amountUsd} every {rules.mode.intervalDays} days
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          <Textarea
            value={editedJson}
            onChange={(e) => setEditedJson(e.target.value)}
            rows={18}
            className="font-mono text-xs bg-vt-bg2/50 border-vt-line text-slate-300 resize-none"
            readOnly
          />
          <p className="text-xs text-slate-500 mt-2">
            Read-only view of the parsed rule set JSON.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isRunning}
          className="flex-1 border-vt-line text-slate-300 hover:bg-vt-bg3 hover:text-slate-100"
        >
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isRunning}
          className="flex-1 bg-vt hover:bg-vt-hover text-white"
        >
          {isRunning ? (
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
              Running backtest...
            </span>
          ) : (
            'Run Backtest'
          )}
        </Button>
      </div>
    </div>
  );
}
