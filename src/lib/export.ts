import type { BacktestResult, Trade } from '@/types/results';

export function tradesToCSV(trades: Trade[]): string {
  const header = 'ID,Entry Date,Entry Price,Exit Date,Exit Price,P&L ($),P&L (%),Holding Days,Exit Reason,Position Size';

  const rows = trades.map((t) =>
    [
      t.id,
      t.entryDate,
      t.entryPrice.toFixed(2),
      t.exitDate,
      t.exitPrice.toFixed(2),
      t.pnlAbs.toFixed(2),
      t.pnlPct.toFixed(2),
      t.holdingDays,
      `"${t.exitReason.replace(/"/g, '""')}"`,
      t.positionSize.toFixed(2),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function resultToJSON(result: BacktestResult): string {
  return JSON.stringify(result, null, 2);
}

export function generateShareURL(result: BacktestResult): string {
  const sharePayload = {
    rules: result.config.rules,
    asset: result.config.asset,
    startDate: result.config.startDate,
    endDate: result.config.endDate,
    initialCapital: result.config.initialCapital,
    feeBps: result.config.feeBps,
    slippageBps: result.config.slippageBps,
  };

  const json = JSON.stringify(sharePayload);
  const base64 = btoa(unescape(encodeURIComponent(json)));

  return window.location.origin + window.location.pathname + '?share=' + encodeURIComponent(base64);
}

export function decodeShareURL(encoded: string): {
  rules: BacktestResult['config']['rules'];
  asset: BacktestResult['config']['asset'];
  startDate: string;
  endDate: string;
  initialCapital: number;
  feeBps: number;
  slippageBps: number;
} | null {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
