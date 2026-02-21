'use client';

import { useState, useMemo } from 'react';
import type { Trade } from '@/types/results';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface TradeLogProps {
  trades: Trade[];
}

type SortKey = 'id' | 'entryDate' | 'exitDate' | 'pnlAbs' | 'pnlPct' | 'holdingDays';
type SortDir = 'asc' | 'desc';

export function TradeLog({ trades }: TradeLogProps) {
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sortedTrades = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'id':
          cmp = a.id - b.id;
          break;
        case 'entryDate':
          cmp = a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0;
          break;
        case 'exitDate':
          cmp = a.exitDate < b.exitDate ? -1 : a.exitDate > b.exitDate ? 1 : 0;
          break;
        case 'pnlAbs':
          cmp = a.pnlAbs - b.pnlAbs;
          break;
        case 'pnlPct':
          cmp = a.pnlPct - b.pnlPct;
          break;
        case 'holdingDays':
          cmp = a.holdingDays - b.holdingDays;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'pnlPct' || key === 'pnlAbs' ? 'desc' : 'asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-slate-700/50 bg-slate-900/50">
        <p className="text-sm text-slate-500">No trades executed</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader className="sticky top-0 bg-slate-800/90 backdrop-blur-sm z-10">
            <TableRow className="border-b-slate-700/50 hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200"
                onClick={() => handleSort('id')}
              >
                #{sortIndicator('id')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200"
                onClick={() => handleSort('entryDate')}
              >
                Entry{sortIndicator('entryDate')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200"
                onClick={() => handleSort('exitDate')}
              >
                Exit{sortIndicator('exitDate')}
              </TableHead>
              <TableHead className="text-slate-400 text-right">Entry $</TableHead>
              <TableHead className="text-slate-400 text-right">Exit $</TableHead>
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200 text-right"
                onClick={() => handleSort('pnlAbs')}
              >
                P&amp;L ${sortIndicator('pnlAbs')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200 text-right"
                onClick={() => handleSort('pnlPct')}
              >
                P&amp;L %{sortIndicator('pnlPct')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-slate-400 hover:text-slate-200 text-right"
                onClick={() => handleSort('holdingDays')}
              >
                Days{sortIndicator('holdingDays')}
              </TableHead>
              <TableHead className="text-slate-400">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTrades.map((trade) => {
              const pnlColor =
                trade.pnlAbs > 0
                  ? 'text-emerald-400'
                  : trade.pnlAbs < 0
                    ? 'text-red-400'
                    : 'text-slate-400';

              return (
                <TableRow
                  key={trade.id}
                  className="border-b-slate-700/30 hover:bg-slate-800/30 even:bg-slate-800/15"
                >
                  <TableCell className="text-slate-500 text-xs tabular-nums">
                    {trade.id}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs font-mono tabular-nums">
                    {trade.entryDate}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs font-mono tabular-nums">
                    {trade.exitDate}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs text-right font-mono tabular-nums">
                    {formatCurrency(trade.entryPrice)}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs text-right font-mono tabular-nums">
                    {formatCurrency(trade.exitPrice)}
                  </TableCell>
                  <TableCell
                    className={`text-xs text-right font-mono tabular-nums font-medium ${pnlColor}`}
                  >
                    {formatCurrency(trade.pnlAbs)}
                  </TableCell>
                  <TableCell
                    className={`text-xs text-right font-mono tabular-nums font-medium ${pnlColor}`}
                  >
                    {formatPercent(trade.pnlPct)}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs text-right tabular-nums">
                    {trade.holdingDays}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs max-w-[120px] truncate">
                    {trade.exitReason}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-slate-700/50 px-3 py-2 bg-slate-800/30">
        <p className="text-xs text-slate-500">
          {trades.length} trade{trades.length !== 1 ? 's' : ''} total.
          Click column headers to sort.
        </p>
      </div>
    </div>
  );
}
