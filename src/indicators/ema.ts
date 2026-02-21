/**
 * Exponential Moving Average (EMA)
 *
 * Uses SMA of the first `period` values as the seed,
 * then applies the standard EMA formula.
 * Returns an array aligned with input length.
 * First `period - 1` values are null (warmup).
 */
export function computeEMA(
  data: number[],
  period: number,
): (number | null)[] {
  const len = data.length;
  const result: (number | null)[] = new Array(len).fill(null);

  if (period <= 0 || len < period) return result;

  // Seed: SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let ema = sum / period;
  result[period - 1] = ema;

  const k = 2 / (period + 1);

  for (let i = period; i < len; i++) {
    ema = data[i] * k + ema * (1 - k);
    result[i] = ema;
  }

  return result;
}
