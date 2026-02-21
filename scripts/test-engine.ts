/**
 * CLI test script: validates the backtest engine end-to-end.
 *
 * Runs the RSI Mean Reversion preset on BTC daily data and prints
 * a full results report. Exits with code 0 on PASS, 1 on FAIL.
 *
 * Usage: npx tsx scripts/test-engine.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { runBacktest } from '@/engine/backtest';
import { getPresetById } from '@/data/presets';
import type { BacktestConfig, Candle, PerformanceMetrics } from '@/types/results';

// ---------------------------------------------------------------------------
// 1. Load BTC candle data
// ---------------------------------------------------------------------------

const dataPath = resolve(process.cwd(), 'public/data/BTC_1D.json');
let candles: Candle[];

try {
  const raw = readFileSync(dataPath, 'utf-8');
  candles = JSON.parse(raw) as Candle[];
  console.log(`Loaded ${candles.length} candles from ${dataPath}`);
} catch (err) {
  console.error(`FAIL: could not load candle data from ${dataPath}`);
  console.error(err);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Get the RSI Mean Reversion preset
// ---------------------------------------------------------------------------

const preset = getPresetById('preset-rsi-mean-reversion');

if (!preset) {
  console.error('FAIL: preset "preset-rsi-mean-reversion" not found');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Build backtest config
// ---------------------------------------------------------------------------

const config: BacktestConfig = {
  asset: 'BTC',
  timeframe: '1D',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10000,
  feeBps: 10,
  slippageBps: 5,
  rules: preset,
};

// ---------------------------------------------------------------------------
// 4. Run the backtest
// ---------------------------------------------------------------------------

console.log('\nRunning backtest...\n');
const result = runBacktest(config, candles);

// ---------------------------------------------------------------------------
// 5. Print results
// ---------------------------------------------------------------------------

const SEP = '─'.repeat(60);

console.log('=== Backtest Results: RSI Mean Reversion on BTC ===\n');

// -- Config summary --------------------------------------------------------
console.log(SEP);
console.log('CONFIG');
console.log(SEP);
console.log(`  Asset:           ${config.asset}`);
console.log(`  Timeframe:       ${config.timeframe}`);
console.log(`  Date range:      ${config.startDate}  ->  ${config.endDate}`);
console.log(`  Initial capital: $${config.initialCapital.toLocaleString()}`);
console.log(`  Fee:             ${config.feeBps} bps`);
console.log(`  Slippage:        ${config.slippageBps} bps`);
console.log(`  Strategy:        ${preset.name}`);
console.log(`  Description:     ${preset.description ?? '—'}`);
console.log();

// -- Trade summary ---------------------------------------------------------
console.log(SEP);
console.log(`TRADES  (${result.trades.length} total)`);
console.log(SEP);

if (result.trades.length > 0) {
  // Header
  console.log(
    '  #   Entry Date    Exit Date     Entry $      Exit $    P&L%    Days  Reason',
  );
  console.log('  ' + '—'.repeat(90));

  for (const t of result.trades) {
    const id = String(t.id).padStart(3);
    const pnl = t.pnlPct >= 0
      ? `+${t.pnlPct.toFixed(2)}%`
      : `${t.pnlPct.toFixed(2)}%`;
    console.log(
      `  ${id}  ${t.entryDate}   ${t.exitDate}   ${t.entryPrice.toFixed(2).padStart(10)}  ${t.exitPrice.toFixed(2).padStart(10)}  ${pnl.padStart(8)}  ${String(t.holdingDays).padStart(5)}  ${t.exitReason}`,
    );
  }
} else {
  console.log('  (no trades)');
}
console.log();

// -- Performance metrics ---------------------------------------------------
console.log(SEP);
console.log('PERFORMANCE METRICS');
console.log(SEP);

const m = result.metrics;
const metricLines: [string, string][] = [
  ['Total Return',             `${m.totalReturn.toFixed(2)}%`],
  ['Annualized Return',        `${m.annualizedReturn.toFixed(2)}%`],
  ['Sharpe Ratio',             m.sharpeRatio.toFixed(3)],
  ['Sortino Ratio',            m.sortinoRatio.toFixed(3)],
  ['Max Drawdown',             `${m.maxDrawdown.toFixed(2)}%`],
  ['Max DD Duration',          `${m.maxDrawdownDurationDays} days`],
  ['Win Rate',                 `${m.winRate.toFixed(2)}%`],
  ['Profit Factor',            m.profitFactor.toFixed(3)],
  ['Total Trades',             String(m.totalTrades)],
  ['Avg Win',                  `${m.avgWinPct.toFixed(2)}%`],
  ['Avg Loss',                 `${m.avgLossPct.toFixed(2)}%`],
  ['Best Trade',               `${m.bestTradePct.toFixed(2)}%`],
  ['Worst Trade',              `${m.worstTradePct.toFixed(2)}%`],
  ['Avg Holding Days',         m.avgHoldingDays.toFixed(1)],
  ['Exposure Time',            `${m.exposureTimePct.toFixed(2)}%`],
];

for (const [label, value] of metricLines) {
  console.log(`  ${label.padEnd(24)} ${value}`);
}
console.log();

// -- Benchmark -------------------------------------------------------------
console.log(SEP);
console.log('BENCHMARK (Buy & Hold)');
console.log(SEP);
console.log(`  Total Return:  ${result.benchmark.totalReturn.toFixed(2)}%`);
console.log(`  Description:   ${result.benchmark.description}`);
console.log();

// -- Audit info ------------------------------------------------------------
console.log(SEP);
console.log('AUDIT');
console.log(SEP);
const a = result.audit;
console.log(`  Execution model:        ${a.executionModel}`);
console.log(`  Fee:                    ${a.feeBps} bps`);
console.log(`  Slippage:               ${a.slippageBps} bps`);
console.log(`  Warmup candles:         ${a.warmupCandles}`);
console.log(`  Data range:             ${a.dataRange}`);
console.log(`  Total candles:          ${a.totalCandles}`);
console.log(`  Tradable candles:       ${a.tradableCandles}`);
console.log(`  Annualization factor:   ${a.annualizationFactor}`);
console.log(`  Risk-free rate:         ${a.riskFreeRate}`);
console.log(`  Benchmark model:        ${a.benchmarkModel}`);
console.log(`  Position model:         ${a.positionModel}`);
console.log();

// ---------------------------------------------------------------------------
// 6. PASS / FAIL verdict
// ---------------------------------------------------------------------------

console.log(SEP);

const hasTrades = result.trades.length > 0;
const metricsFinite = (Object.keys(m) as (keyof PerformanceMetrics)[]).every(
  (k) => Number.isFinite(m[k]),
);

if (hasTrades && metricsFinite) {
  console.log('VERDICT:  PASS');
  console.log(SEP);
  process.exit(0);
} else {
  const reasons: string[] = [];
  if (!hasTrades) reasons.push('no trades generated');
  if (!metricsFinite) reasons.push('some metrics are not finite numbers');
  console.log(`VERDICT:  FAIL  (${reasons.join('; ')})`);
  console.log(SEP);
  process.exit(1);
}
