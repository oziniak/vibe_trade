import type { Candle, EquityPoint, BenchmarkResult } from '@/types/results';

/**
 * Compute buy-and-hold benchmark with the same fee and slippage assumptions
 * as the strategy under test.
 *
 * Model:
 *  - Buy at first candle open with adverse slippage (price goes up for a buy).
 *  - Pay entry fee on the notional.
 *  - Mark-to-market each candle close.
 *  - At the final candle close, apply exit slippage (price goes down) and exit fee.
 */
export function computeBenchmark(
  candles: Candle[],
  initialCapital: number,
  feeBps: number,
  slippageBps: number,
): BenchmarkResult {
  if (candles.length === 0) {
    return {
      totalReturn: 0,
      equityCurve: [],
      description: 'Buy & Hold: entered at first tradable candle open, same fees',
    };
  }

  const slippageFrac = slippageBps / 10_000;
  const feeFrac = feeBps / 10_000;

  // Entry: adverse slippage means we pay more (price * (1 + slippage))
  const rawEntryPrice = candles[0].o;
  const entryPriceWithSlippage = rawEntryPrice * (1 + slippageFrac);

  const entryFee = initialCapital * feeFrac;
  const units = (initialCapital - entryFee) / entryPriceWithSlippage;

  let peak = initialCapital;
  const equityCurve: EquityPoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const isLast = i === candles.length - 1;

    let equity: number;
    if (isLast) {
      // Exit at last candle close with adverse slippage (price goes down for a sell)
      const exitPriceWithSlippage = candles[i].c * (1 - slippageFrac);
      const grossEquity = units * exitPriceWithSlippage;
      const exitFee = grossEquity * feeFrac;
      equity = grossEquity - exitFee;
    } else {
      equity = units * candles[i].c;
    }

    if (equity > peak) {
      peak = equity;
    }

    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;

    equityCurve.push({
      date: candles[i].t,
      equity: 0, // strategy equity not known here; caller fills this in
      benchmarkEquity: equity,
      drawdownPct: 0, // strategy drawdown not known here; caller fills this in
      benchmarkDrawdownPct: drawdownPct,
    });
  }

  const finalEquity = equityCurve[equityCurve.length - 1].benchmarkEquity;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  return {
    totalReturn,
    equityCurve,
    description: 'Buy & Hold: entered at first tradable candle open, same fees',
  };
}
