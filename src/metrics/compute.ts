import type { Trade, EquityPoint, PerformanceMetrics, AuditInfo } from '@/types/results';

/**
 * Compute all 14 performance metrics from trades and an equity curve.
 *
 * Conventions
 * -----------
 * - Risk-free rate = 0
 * - Annualization factor = 365 (crypto markets trade every day)
 * - Population standard deviation (divide by N, not N-1)
 * - Breakeven trades (pnlPct === 0) count as wins for winRate / avgWinPct
 * - If there are 0 or 1 equity points, daily-return-based metrics (sharpe, sortino) = 0
 */
export function computeMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  totalCandles: number,
): PerformanceMetrics {
  // ---- Total return ----
  const finalEquity =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // ---- Annualized return (CAGR) ----
  const totalDays = equityCurve.length > 1 ? daysBetween(equityCurve[0].date, equityCurve[equityCurve.length - 1].date) : 0;
  let annualizedReturn = 0;
  if (totalDays > 0 && finalEquity > 0) {
    annualizedReturn =
      (Math.pow(finalEquity / initialCapital, 365 / totalDays) - 1) * 100;
  }

  // ---- Daily returns from equity curve ----
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    if (prev !== 0) {
      dailyReturns.push((equityCurve[i].equity - prev) / prev);
    } else {
      dailyReturns.push(0);
    }
  }

  // ---- Sharpe ratio (annualized, rf=0, population stdev) ----
  const sharpeRatio = computeSharpe(dailyReturns);

  // ---- Sortino ratio (annualized, rf=0, downside deviation) ----
  const sortinoRatio = computeSortino(dailyReturns);

  // ---- Max drawdown ----
  let maxDrawdown = 0;
  for (const pt of equityCurve) {
    if (pt.drawdownPct < maxDrawdown) {
      maxDrawdown = pt.drawdownPct;
    }
  }

  // ---- Max drawdown duration (in calendar days) ----
  const maxDrawdownDurationDays = computeMaxDrawdownDuration(equityCurve);

  // ---- Trade-level metrics ----
  const wins = trades.filter((t) => t.pnlPct >= 0);
  const losses = trades.filter((t) => t.pnlPct < 0);

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.pnlAbs, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlAbs, 0));

  let profitFactor: number;
  if (wins.length === 0) {
    profitFactor = 0;
  } else if (grossLoss === 0) {
    profitFactor = Infinity;
  } else {
    profitFactor = grossProfit / grossLoss;
  }

  const totalTrades = trades.length;

  const avgWinPct =
    wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;

  const avgLossPct =
    losses.length > 0
      ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length
      : 0;

  const bestTradePct =
    trades.length > 0 ? Math.max(...trades.map((t) => t.pnlPct)) : 0;

  const worstTradePct =
    trades.length > 0 ? Math.min(...trades.map((t) => t.pnlPct)) : 0;

  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length
      : 0;

  // ---- Exposure time ----
  const totalHoldingDays = trades.reduce((s, t) => s + t.holdingDays, 0);
  const exposureTimePct =
    totalCandles > 0 ? (totalHoldingDays / totalCandles) * 100 : 0;

  return {
    totalReturn,
    annualizedReturn,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownDurationDays,
    winRate,
    profitFactor,
    totalTrades,
    avgWinPct,
    avgLossPct,
    bestTradePct,
    worstTradePct,
    avgHoldingDays,
    exposureTimePct,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sharpe ratio: mean(dailyReturns) / stdev(dailyReturns) * sqrt(365), rf=0.
 *  Population standard deviation. If stdev is effectively 0 or not enough data, returns 0.
 *  We use a relative epsilon to guard against floating-point noise in constant-return series.
 */
function computeSharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    dailyReturns.length;
  const stdev = Math.sqrt(variance);

  // Treat stdev as zero when it is negligible relative to the mean
  // (handles floating-point noise in constant-return equity curves)
  if (stdev === 0 || (Math.abs(mean) > 0 && stdev / Math.abs(mean) < 1e-10)) {
    return 0;
  }

  return (mean / stdev) * Math.sqrt(365);
}

/** Sortino ratio: mean(dailyReturns) / downsideDev * sqrt(365), rf=0.
 *  Downside deviation uses only negative returns, population denominator.
 *  If no negative returns and mean >= 0, returns Infinity.
 *  If not enough data, returns 0.
 */
function computeSortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;

  const negativeReturns = dailyReturns.filter((r) => r < 0);

  if (negativeReturns.length === 0) {
    return mean >= 0 ? Infinity : 0;
  }

  const downsideVariance =
    negativeReturns.reduce((sum, r) => sum + r ** 2, 0) / dailyReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);

  if (downsideDev === 0) return mean >= 0 ? Infinity : 0;

  return (mean / downsideDev) * Math.sqrt(365);
}

/** Max drawdown duration in calendar days.
 *  Longest consecutive period where equity is below a previous peak.
 */
function computeMaxDrawdownDuration(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;

  let peak = equityCurve[0].equity;
  let ddStartDate: string | null = null;
  let maxDurationDays = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const pt = equityCurve[i];

    if (pt.equity >= peak) {
      // We recovered or set a new peak
      if (ddStartDate !== null) {
        const durationDays = daysBetween(ddStartDate, pt.date);
        if (durationDays > maxDurationDays) {
          maxDurationDays = durationDays;
        }
        ddStartDate = null;
      }
      peak = pt.equity;
    } else {
      // We are in drawdown
      if (ddStartDate === null) {
        // The drawdown started at the previous candle (the peak)
        ddStartDate = i > 0 ? equityCurve[i - 1].date : pt.date;
      }
    }
  }

  // If still in drawdown at end of data
  if (ddStartDate !== null) {
    const durationDays = daysBetween(
      ddStartDate,
      equityCurve[equityCurve.length - 1].date,
    );
    if (durationDays > maxDurationDays) {
      maxDurationDays = durationDays;
    }
  }

  return maxDurationDays;
}

/** Calendar days between two YYYY-MM-DD date strings. */
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round(Math.abs(db.getTime() - da.getTime()) / msPerDay);
}

// ---------------------------------------------------------------------------
// Audit builder
// ---------------------------------------------------------------------------

/** Build audit information object for the backtest result. */
export function buildAuditInfo(params: {
  feeBps: number;
  slippageBps: number;
  warmupCandles: number;
  startDate: string;
  endDate: string;
  totalCandles: number;
  tradableCandles: number;
}): AuditInfo {
  return {
    executionModel: 'Signal on close[i], execute at open[i+1]',
    feeBps: params.feeBps,
    slippageBps: params.slippageBps,
    warmupCandles: params.warmupCandles,
    dataRange: `${params.startDate} to ${params.endDate}`,
    totalCandles: params.totalCandles,
    tradableCandles: params.tradableCandles,
    annualizationFactor: 365,
    riskFreeRate: 0,
    benchmarkModel: 'Buy & Hold: entered at first tradable candle open, same fees',
    positionModel: 'Long-only, single position, no pyramiding',
  };
}
