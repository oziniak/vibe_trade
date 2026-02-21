/**
 * VT-TASK-32: Stress test script for the backtest engine.
 *
 * Runs 15+ diverse strategy scenarios using preset strategies and direct
 * backtest engine calls (deterministic — no AI parser involved).
 *
 * Usage: npx tsx scripts/stress-test.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { runBacktest } from '@/engine/backtest';
import { PRESETS, getPresetById } from '@/data/presets';
import type { BacktestConfig, BacktestResult, Candle, PerformanceMetrics } from '@/types/results';
import type { StrategyRuleSet } from '@/types/strategy';

// ---------------------------------------------------------------------------
// 1. Load candle data for multiple assets
// ---------------------------------------------------------------------------

const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'AVAX'] as const;
type Asset = (typeof ASSETS)[number];

const candleCache: Record<string, Candle[]> = {};

function loadCandles(asset: string): Candle[] {
  if (candleCache[asset]) return candleCache[asset];
  const dataPath = resolve(process.cwd(), `public/data/${asset}_1D.json`);
  try {
    const raw = readFileSync(dataPath, 'utf-8');
    const candles = JSON.parse(raw) as Candle[];
    candleCache[asset] = candles;
    return candles;
  } catch (err) {
    console.error(`FAIL: could not load candle data for ${asset} from ${dataPath}`);
    process.exit(1);
  }
}

// Pre-load all assets
for (const asset of ASSETS) {
  const c = loadCandles(asset);
  console.log(`  Loaded ${asset}: ${c.length} candles (${c[0].t} -> ${c[c.length - 1].t})`);
}

// ---------------------------------------------------------------------------
// 2. Helper: build a DCA preset with a custom amount
// ---------------------------------------------------------------------------

function makeDCAPreset(amountUsd: number): StrategyRuleSet {
  return {
    id: `stress-dca-${amountUsd}`,
    name: `Weekly DCA $${amountUsd}`,
    description: `Dollar-cost average $${amountUsd} every week`,
    mode: { type: 'dca', intervalDays: 7, amountUsd },
    entry: { op: 'AND', conditions: [] },
    exit: { op: 'AND', conditions: [] },
    sizing: { type: 'percent_equity', valuePct: 100 },
  };
}

// ---------------------------------------------------------------------------
// 3. Define test cases
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  asset: Asset;
  startDate: string;
  endDate: string;
  initialCapital: number;
  rules: StrategyRuleSet;
}

const testCases: TestCase[] = [];

// --- 3a. Each of the 6 presets on BTC (2021-2024) ---
for (const preset of PRESETS) {
  testCases.push({
    name: `${preset.name} / BTC`,
    asset: 'BTC',
    startDate: '2021-01-01',
    endDate: '2024-12-31',
    initialCapital: 10_000,
    rules: preset,
  });
}

// --- 3b. RSI preset on ETH, SOL, BNB ---
const rsiPreset = getPresetById('preset-rsi-mean-reversion')!;

for (const asset of ['ETH', 'SOL', 'BNB'] as const) {
  testCases.push({
    name: `RSI Mean Reversion / ${asset}`,
    asset,
    startDate: '2021-01-01',
    endDate: '2024-12-31',
    initialCapital: 10_000,
    rules: rsiPreset,
  });
}

// --- 3c. Golden Cross with different date ranges ---
const goldenCross = getPresetById('preset-golden-cross')!;

testCases.push({
  name: 'Golden Cross / BTC 2020-2022',
  asset: 'BTC',
  startDate: '2020-01-01',
  endDate: '2022-12-31',
  initialCapital: 10_000,
  rules: goldenCross,
});

testCases.push({
  name: 'Golden Cross / BTC 2022-2024',
  asset: 'BTC',
  startDate: '2022-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
  rules: goldenCross,
});

testCases.push({
  name: 'Golden Cross / BTC 2021-2023',
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2023-12-31',
  initialCapital: 10_000,
  rules: goldenCross,
});

// --- 3d. DCA with different amounts ---
testCases.push({
  name: 'DCA $50 / BTC',
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
  rules: makeDCAPreset(50),
});

testCases.push({
  name: 'DCA $200 / BTC',
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
  rules: makeDCAPreset(200),
});

// --- 3e. Very short date range (might produce 0 trades) ---
testCases.push({
  name: 'RSI / BTC short range (7 days)',
  asset: 'BTC',
  startDate: '2023-06-01',
  endDate: '2023-06-07',
  initialCapital: 10_000,
  rules: rsiPreset,
});

testCases.push({
  name: 'Golden Cross / BTC short range (30 days)',
  asset: 'BTC',
  startDate: '2023-06-01',
  endDate: '2023-06-30',
  initialCapital: 10_000,
  rules: goldenCross,
});

// --- 3f. Edge case capital: very high ($1M) and very low ($100) ---
testCases.push({
  name: 'RSI / BTC $1M capital',
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 1_000_000,
  rules: rsiPreset,
});

testCases.push({
  name: 'RSI / BTC $100 capital',
  asset: 'BTC',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 100,
  rules: rsiPreset,
});

// --- 3g. DCA on additional assets (ADA, AVAX) ---
const dcaPreset = getPresetById('preset-weekly-dca')!;

testCases.push({
  name: 'Weekly DCA / ADA',
  asset: 'ADA',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
  rules: dcaPreset,
});

testCases.push({
  name: 'Weekly DCA / AVAX',
  asset: 'AVAX',
  startDate: '2021-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
  rules: dcaPreset,
});

// ---------------------------------------------------------------------------
// 4. Validation helpers
// ---------------------------------------------------------------------------

interface TestResult {
  name: string;
  asset: string;
  status: 'PASS' | 'FAIL';
  trades: number;
  totalReturn: string;
  sharpe: string;
  errors: string[];
}

function isFiniteOrInfinity(n: number): boolean {
  return !Number.isNaN(n);
}

function validateResult(tc: TestCase, result: BacktestResult): TestResult {
  const errors: string[] = [];
  const m = result.metrics;

  // Check equity curve length
  // Note: short date ranges may have 0 tradable candles if warmup exceeds data,
  // which yields an empty equity curve. That is acceptable (no crash).
  if (result.equityCurve.length === 0 && result.trades.length > 0) {
    errors.push('Equity curve is empty but trades > 0');
  }

  // Check all metrics are finite or Infinity (no NaN)
  const metricKeys = Object.keys(m) as (keyof PerformanceMetrics)[];
  for (const key of metricKeys) {
    const val = m[key];
    if (!isFiniteOrInfinity(val)) {
      errors.push(`Metric ${key} is NaN`);
    }
  }

  // If trades > 0, check that all trade fields are populated
  if (result.trades.length > 0) {
    for (const trade of result.trades) {
      if (!trade.entryDate) errors.push(`Trade ${trade.id}: missing entryDate`);
      if (!trade.exitDate) errors.push(`Trade ${trade.id}: missing exitDate`);
      if (typeof trade.entryPrice !== 'number' || Number.isNaN(trade.entryPrice)) {
        errors.push(`Trade ${trade.id}: invalid entryPrice`);
      }
      if (typeof trade.exitPrice !== 'number' || Number.isNaN(trade.exitPrice)) {
        errors.push(`Trade ${trade.id}: invalid exitPrice`);
      }
      if (typeof trade.pnlAbs !== 'number' || Number.isNaN(trade.pnlAbs)) {
        errors.push(`Trade ${trade.id}: invalid pnlAbs`);
      }
      if (typeof trade.pnlPct !== 'number' || Number.isNaN(trade.pnlPct)) {
        errors.push(`Trade ${trade.id}: invalid pnlPct`);
      }
      if (typeof trade.holdingDays !== 'number' || Number.isNaN(trade.holdingDays)) {
        errors.push(`Trade ${trade.id}: invalid holdingDays`);
      }
      if (!trade.exitReason) {
        errors.push(`Trade ${trade.id}: missing exitReason`);
      }
      if (typeof trade.positionSize !== 'number' || Number.isNaN(trade.positionSize)) {
        errors.push(`Trade ${trade.id}: invalid positionSize`);
      }
    }
  }

  return {
    name: tc.name,
    asset: tc.asset,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    trades: result.trades.length,
    totalReturn: m.totalReturn.toFixed(2) + '%',
    sharpe: isFiniteOrInfinity(m.sharpeRatio) ? m.sharpeRatio.toFixed(3) : 'NaN',
    errors,
  };
}

// ---------------------------------------------------------------------------
// 5. Run all test cases
// ---------------------------------------------------------------------------

console.log(`\nRunning ${testCases.length} stress test cases...\n`);

const results: TestResult[] = [];

for (const tc of testCases) {
  const candles = loadCandles(tc.asset);

  const config: BacktestConfig = {
    asset: tc.asset as any,
    timeframe: '1D',
    startDate: tc.startDate,
    endDate: tc.endDate,
    initialCapital: tc.initialCapital,
    feeBps: 10,
    slippageBps: 5,
    rules: tc.rules,
  };

  let testResult: TestResult;

  try {
    const backtestResult = runBacktest(config, candles);
    testResult = validateResult(tc, backtestResult);
  } catch (err) {
    testResult = {
      name: tc.name,
      asset: tc.asset,
      status: 'FAIL',
      trades: -1,
      totalReturn: 'ERR',
      sharpe: 'ERR',
      errors: [`Exception: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  results.push(testResult);
}

// ---------------------------------------------------------------------------
// 6. Print results table
// ---------------------------------------------------------------------------

console.log('='.repeat(110));
console.log(
  '  #  ' +
  'Test Name'.padEnd(40) +
  'Asset '.padEnd(7) +
  'Trades '.padEnd(8) +
  'Return'.padStart(10) +
  '  ' +
  'Sharpe'.padStart(8) +
  '  ' +
  'Status',
);
console.log('='.repeat(110));

for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const idx = String(i + 1).padStart(3);
  const name = r.name.padEnd(40).substring(0, 40);
  const asset = r.asset.padEnd(7).substring(0, 7);
  const trades = String(r.trades).padStart(6);
  const ret = r.totalReturn.padStart(10);
  const sharpe = r.sharpe.padStart(8);
  const status = r.status === 'PASS' ? 'PASS' : 'FAIL';

  console.log(`${idx}  ${name}${asset}${trades}  ${ret}  ${sharpe}  ${status}`);

  if (r.errors.length > 0) {
    for (const err of r.errors) {
      console.log(`       -> ${err}`);
    }
  }
}

console.log('='.repeat(110));

// ---------------------------------------------------------------------------
// 7. Summary and exit
// ---------------------------------------------------------------------------

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const total = results.length;

console.log();
console.log(`Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log();

if (failed > 0) {
  console.log('OVERALL RESULT: FAIL');
  console.log();
  console.log('Failed tests:');
  for (const r of results.filter((r) => r.status === 'FAIL')) {
    console.log(`  - ${r.name}`);
    for (const err of r.errors) {
      console.log(`    -> ${err}`);
    }
  }
  process.exit(1);
} else {
  console.log('OVERALL RESULT: PASS -- All stress tests passed successfully.');
  process.exit(0);
}
