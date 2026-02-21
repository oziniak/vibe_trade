import { computeSMA } from './sma';

export interface BollingerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

/**
 * Bollinger Bands
 *
 * middle = SMA(period)
 * upper  = middle + stdDevMultiplier * population_std_dev(last `period` values)
 * lower  = middle - stdDevMultiplier * population_std_dev(last `period` values)
 *
 * Returns arrays aligned with input length.
 * First `period - 1` values are null (warmup).
 */
export function computeBollinger(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2,
): BollingerResult {
  const len = data.length;
  const upper: (number | null)[] = new Array(len).fill(null);
  const lower: (number | null)[] = new Array(len).fill(null);

  const middle = computeSMA(data, period);

  for (let i = period - 1; i < len; i++) {
    const mean = middle[i];
    if (mean === null) continue;

    // Compute population standard deviation of the last `period` values
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - mean;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / period);

    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}
