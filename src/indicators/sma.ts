/**
 * Simple Moving Average (SMA)
 *
 * Returns an array aligned with input length.
 * First `period - 1` values are null (warmup).
 */
export function computeSMA(
  data: number[],
  period: number,
): (number | null)[] {
  const len = data.length;
  const result: (number | null)[] = new Array(len).fill(null);

  if (period <= 0 || len < period) return result;

  // Compute initial window sum
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result[period - 1] = sum / period;

  // Slide the window
  for (let i = period; i < len; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }

  return result;
}
