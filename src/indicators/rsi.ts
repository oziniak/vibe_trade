/** Relative Strength Index (Wilder's smoothing method) */
export function computeRSI(
  data: number[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = [];

  if (data.length < period + 1) {
    // Not enough data to compute even a single RSI value
    return new Array(data.length).fill(null);
  }

  // First `period` entries are null (we need period+1 data points = period deltas)
  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  // Compute initial average gain and loss from the first `period` deltas
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = data[i] - data[i - 1];
    if (delta > 0) {
      avgGain += delta;
    } else {
      avgLoss += -delta;
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // First RSI value at index `period`
  if (avgLoss === 0) {
    result.push(100);
  } else {
    const rs = avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  // Subsequent RSI values using Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    const currentGain = delta > 0 ? delta : 0;
    const currentLoss = delta < 0 ? -delta : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}
