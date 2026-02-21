/**
 * Average True Range (ATR)
 *
 * True Range = max(high - low, |high - prevClose|, |low - prevClose|)
 * First ATR value = SMA of the first `period` TRs (available at index = period).
 * Subsequent values use Wilder smoothing: ATR = (prevATR * (period - 1) + TR) / period.
 *
 * Returns an array aligned with input length.
 * First `period` values are null (warmup).
 */
export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): (number | null)[] {
  const len = highs.length;
  const result: (number | null)[] = new Array(len).fill(null);

  if (period <= 0 || len < period + 1) return result;

  // Compute True Range array. TR[0] is undefined (no previous close).
  // TR[i] for i >= 1:
  const tr: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const highLow = highs[i] - lows[i];
    const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
    const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(highLow, highPrevClose, lowPrevClose);
  }

  // First ATR = SMA of the first `period` TRs (indices 1..period)
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += tr[i];
  }
  let atr = sum / period;
  result[period] = atr;

  // Wilder smoothing for subsequent values
  for (let i = period + 1; i < len; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }

  return result;
}
