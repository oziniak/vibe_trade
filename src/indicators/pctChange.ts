/**
 * Percentage Change over a lookback period.
 *
 * pctChange[i] = (data[i] - data[i - period]) / data[i - period] * 100
 *
 * Returns an array aligned with input length.
 * First `period` values are null (warmup).
 */
export function computePctChange(
  data: number[],
  period: number = 1,
): (number | null)[] {
  const len = data.length;
  const result: (number | null)[] = new Array(len).fill(null);

  if (period <= 0 || len <= period) return result;

  for (let i = period; i < len; i++) {
    const prev = data[i - period];
    if (prev === 0) {
      // Avoid division by zero; treat as null
      result[i] = null;
    } else {
      result[i] = ((data[i] - prev) / prev) * 100;
    }
  }

  return result;
}
