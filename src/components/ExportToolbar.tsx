'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { BacktestResult } from '@/types/results';
import { Button } from '@/components/ui/button';
import {
  tradesToCSV,
  resultToJSON,
  generateShareURL,
  downloadFile,
} from '@/lib/export';

export function ExportToolbar({ result }: { result: BacktestResult }) {
  const [shareCopied, setShareCopied] = useState(false);

  return (
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
        <Link2 className="h-3.5 w-3.5 mr-1.5" />
        {shareCopied ? 'Copied!' : 'Copy Share Link'}
      </Button>
    </div>
  );
}
