/**
 * VT-TASK-27: Verify all demo snapshots produce good backtest results.
 *
 * Iterates through every DemoSnapshot defined in src/data/snapshots.ts,
 * runs the corresponding backtest, and verifies the results are sane:
 *   - Non-zero trades
 *   - Valid key metrics (no NaN; Infinity allowed for profitFactor/sortinoRatio)
 *   - Equity curve has data points
 *   - totalTrades > 0 for standard-mode strategies
 *
 * Usage: npx tsx scripts/verify-snapshots.ts
 *
 * Exit code 0 = all snapshots pass, 1 = at least one failure.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { DEMO_SNAPSHOTS } from '@/data/snapshots';
import { getPresetById } from '@/data/presets';
import { runBacktest } from '@/engine/backtest';
import type { BacktestConfig, Candle, PerformanceMetrics } from '@/types/results';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEP = '─'.repeat(60);

/**
 * Metrics that are allowed to be +Infinity in certain edge cases:
 *   - profitFactor: Infinity when all trades are winners (grossLoss === 0)
 *   - sortinoRatio: Infinity when there are no negative daily returns
 *
 * These are mathematically correct (dividing by zero losses/downside).
 * NaN is always invalid.
 */
const INFINITY_ALLOWED_KEYS = new Set<keyof PerformanceMetrics>([
  'profitFactor',
  'sortinoRatio',
]);

/**
 * Check that every numeric field in PerformanceMetrics is valid.
 * "Valid" means: not NaN, and either finite or +Infinity for allowed keys.
 */
function allMetricsValid(m: PerformanceMetrics): boolean {
  return (Object.keys(m) as (keyof PerformanceMetrics)[]).every((k) => {
    const v = m[k];
    if (Number.isNaN(v)) return false;
    if (Number.isFinite(v)) return true;
    // v is +/-Infinity: only accept +Infinity for allowed keys
    return v === Infinity && INFINITY_ALLOWED_KEYS.has(k);
  });
}

/** Return a list of metric keys that have invalid values (NaN, or disallowed Infinity). */
function getInvalidKeys(m: PerformanceMetrics): string[] {
  return (Object.keys(m) as (keyof PerformanceMetrics)[]).filter((k) => {
    const v = m[k];
    if (Number.isNaN(v)) return true;
    if (Number.isFinite(v)) return false;
    // v is +/-Infinity: invalid unless it is +Infinity for an allowed key
    return !(v === Infinity && INFINITY_ALLOWED_KEYS.has(k));
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('=== VT-TASK-27: Verify Demo Snapshots ===\n');
console.log(`Found ${DEMO_SNAPSHOTS.length} demo snapshots to verify.\n`);

interface SnapshotResult {
  id: string;
  displayName: string;
  passed: boolean;
  reasons: string[];
  totalReturn?: number;
  sharpeRatio?: number;
  totalTrades?: number;
  winRate?: number;
  equityPoints?: number;
  mode?: string;
}

const results: SnapshotResult[] = [];

for (const snapshot of DEMO_SNAPSHOTS) {
  console.log(SEP);
  console.log(`Snapshot: ${snapshot.displayName}`);
  console.log(`  ID:       ${snapshot.id}`);
  console.log(`  Preset:   ${snapshot.presetId}`);
  console.log(`  Asset:    ${snapshot.config.asset}`);
  console.log(`  Range:    ${snapshot.config.startDate} -> ${snapshot.config.endDate}`);
  console.log();

  const failures: string[] = [];

  // 1. Load the preset
  const preset = getPresetById(snapshot.presetId);
  if (!preset) {
    failures.push(`Preset "${snapshot.presetId}" not found`);
    results.push({
      id: snapshot.id,
      displayName: snapshot.displayName,
      passed: false,
      reasons: failures,
    });
    console.log(`  FAIL: ${failures[0]}\n`);
    continue;
  }

  // 2. Load candle data
  const dataPath = resolve(process.cwd(), `public/data/${snapshot.config.asset}_1D.json`);
  let candles: Candle[];

  try {
    const raw = readFileSync(dataPath, 'utf-8');
    candles = JSON.parse(raw) as Candle[];
    console.log(`  Loaded ${candles.length} candles from ${snapshot.config.asset}_1D.json`);
  } catch (err) {
    failures.push(`Could not load candle data from ${dataPath}`);
    results.push({
      id: snapshot.id,
      displayName: snapshot.displayName,
      passed: false,
      reasons: failures,
    });
    console.log(`  FAIL: ${failures[0]}\n`);
    continue;
  }

  // 3. Build config and run backtest
  const config: BacktestConfig = {
    asset: snapshot.config.asset,
    timeframe: '1D',
    startDate: snapshot.config.startDate,
    endDate: snapshot.config.endDate,
    initialCapital: snapshot.config.initialCapital,
    feeBps: snapshot.config.feeBps,
    slippageBps: snapshot.config.slippageBps,
    rules: preset,
  };

  console.log('  Running backtest...');
  const result = runBacktest(config, candles);
  const m = result.metrics;
  const mode = preset.mode.type;

  const fmtNum = (v: number, decimals: number, suffix = '') =>
    Number.isFinite(v) ? `${v.toFixed(decimals)}${suffix}` : String(v);

  console.log(`  Mode:           ${mode}`);
  console.log(`  Trades:         ${result.trades.length}`);
  console.log(`  Equity points:  ${result.equityCurve.length}`);
  console.log(`  Total Return:   ${fmtNum(m.totalReturn, 2, '%')}`);
  console.log(`  Sharpe Ratio:   ${fmtNum(m.sharpeRatio, 3)}`);
  console.log(`  Sortino Ratio:  ${fmtNum(m.sortinoRatio, 3)}`);
  console.log(`  Win Rate:       ${fmtNum(m.winRate, 2, '%')}`);
  console.log(`  Profit Factor:  ${fmtNum(m.profitFactor, 3)}`);
  console.log(`  Total Trades:   ${m.totalTrades}`);
  console.log(`  Max Drawdown:   ${fmtNum(m.maxDrawdown, 2, '%')}`);

  // 4. Verification checks

  // Check: non-zero trades
  if (result.trades.length === 0) {
    failures.push('No trades generated (trades.length === 0)');
  }

  // Check: totalReturn is finite
  if (!Number.isFinite(m.totalReturn)) {
    failures.push(`totalReturn is not finite: ${m.totalReturn}`);
  }

  // Check: sharpeRatio is finite
  if (!Number.isFinite(m.sharpeRatio)) {
    failures.push(`sharpeRatio is not finite: ${m.sharpeRatio}`);
  }

  // Check: totalTrades > 0 for standard mode
  if (mode === 'standard' && m.totalTrades <= 0) {
    failures.push(`totalTrades is ${m.totalTrades} for standard mode (expected > 0)`);
  }

  // Check: equity curve has data points
  if (result.equityCurve.length === 0) {
    failures.push('Equity curve is empty (no data points)');
  }

  // Check: no NaN values in key metrics (Infinity is OK for profitFactor/sortinoRatio)
  if (!allMetricsValid(m)) {
    const badKeys = getInvalidKeys(m);
    failures.push(`Invalid metric values: ${badKeys.map((k) => `${k}=${m[k as keyof PerformanceMetrics]}`).join(', ')}`);
  }

  const passed = failures.length === 0;
  results.push({
    id: snapshot.id,
    displayName: snapshot.displayName,
    passed,
    reasons: failures,
    totalReturn: m.totalReturn,
    sharpeRatio: m.sharpeRatio,
    totalTrades: m.totalTrades,
    winRate: m.winRate,
    equityPoints: result.equityCurve.length,
    mode,
  });

  console.log();
  if (passed) {
    console.log('  Result: PASS');
  } else {
    console.log('  Result: FAIL');
    for (const reason of failures) {
      console.log(`    - ${reason}`);
    }
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(SEP);
console.log('SUMMARY');
console.log(SEP);
console.log();

const passCount = results.filter((r) => r.passed).length;
const failCount = results.filter((r) => !r.passed).length;

for (const r of results) {
  const status = r.passed ? 'PASS' : 'FAIL';
  const metrics =
    r.totalReturn !== undefined
      ? ` | return=${r.totalReturn.toFixed(2)}% sharpe=${r.sharpeRatio!.toFixed(3)} trades=${r.totalTrades} winRate=${r.winRate!.toFixed(1)}% equity=${r.equityPoints} mode=${r.mode}`
      : '';
  console.log(`  [${status}] ${r.displayName}${metrics}`);
  if (!r.passed) {
    for (const reason of r.reasons) {
      console.log(`         - ${reason}`);
    }
  }
}

console.log();
console.log(`${passCount} passed, ${failCount} failed out of ${results.length} snapshots.`);
console.log();

if (failCount > 0) {
  console.log('VERDICT: FAIL');
  process.exit(1);
} else {
  console.log('VERDICT: ALL PASS');
  process.exit(0);
}
