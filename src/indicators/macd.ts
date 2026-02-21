import { computeEMA } from './ema';

export interface MACDResult {
  line: (number | null)[];      // fast EMA - slow EMA
  signal: (number | null)[];    // EMA of MACD line
  histogram: (number | null)[]; // line - signal
}

/**
 * MACD (Moving Average Convergence Divergence)
 *
 * Returns arrays aligned with input length.
 * Warmup nulls = (slowPeriod - 1) + (signalPeriod - 1) candles.
 */
export function computeMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const len = data.length;
  const line: (number | null)[] = new Array(len).fill(null);
  const signal: (number | null)[] = new Array(len).fill(null);
  const histogram: (number | null)[] = new Array(len).fill(null);

  if (len === 0) return { line, signal, histogram };

  // Step 1: Compute fast and slow EMAs of the input data
  const fastEMA = computeEMA(data, fastPeriod);
  const slowEMA = computeEMA(data, slowPeriod);

  // Step 2: MACD line = fastEMA - slowEMA (null if either is null)
  for (let i = 0; i < len; i++) {
    const f = fastEMA[i];
    const s = slowEMA[i];
    if (f !== null && s !== null) {
      line[i] = f - s;
    }
  }

  // Step 3: Compute signal line as EMA of the non-null MACD line values.
  // Extract only the non-null MACD values, compute EMA over them,
  // then map back to original indices.
  const macdValues: number[] = [];
  const macdIndices: number[] = [];
  for (let i = 0; i < len; i++) {
    if (line[i] !== null) {
      macdValues.push(line[i] as number);
      macdIndices.push(i);
    }
  }

  const signalEMA = computeEMA(macdValues, signalPeriod);

  for (let j = 0; j < macdValues.length; j++) {
    if (signalEMA[j] !== null) {
      const idx = macdIndices[j];
      signal[idx] = signalEMA[j];
    }
  }

  // Step 4: Histogram = line - signal (null if either is null)
  for (let i = 0; i < len; i++) {
    const l = line[i];
    const s = signal[i];
    if (l !== null && s !== null) {
      histogram[i] = l - s;
    }
  }

  return { line, signal, histogram };
}
