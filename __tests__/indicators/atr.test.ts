import { describe, it, expect } from 'vitest';
import { computeATR } from '@/indicators/atr';

describe('computeATR', () => {
  it('returns all nulls for empty data', () => {
    const result = computeATR([], [], [], 14);
    expect(result).toEqual([]);
  });

  it('returns all nulls when data is shorter than period + 1', () => {
    const highs = [10, 11, 12];
    const lows = [9, 10, 11];
    const closes = [9.5, 10.5, 11.5];
    const result = computeATR(highs, lows, closes, 3);
    // Need period+1 = 4 points, only have 3
    expect(result).toEqual([null, null, null]);
  });

  it('returns correct warmup null count (first period values are null)', () => {
    const highs =  [48.70, 48.72, 48.90, 48.87, 48.82, 49.05, 49.20, 49.35, 49.92, 50.19,
                    50.12, 49.66, 49.88, 50.19, 50.36, 50.57, 50.65, 50.43, 49.63, 50.33];
    const lows =   [47.79, 48.14, 48.39, 48.37, 48.24, 48.64, 48.94, 48.86, 49.50, 49.87,
                    49.20, 48.90, 49.43, 49.73, 49.26, 50.09, 50.30, 49.21, 48.98, 49.61];
    const closes = [48.16, 48.61, 48.75, 48.63, 48.74, 49.03, 49.07, 49.32, 49.91, 50.13,
                    49.53, 49.50, 49.75, 50.03, 49.99, 50.23, 50.33, 49.25, 49.00, 50.29];
    const period = 5;
    const result = computeATR(highs, lows, closes, period);

    // First `period` values (indices 0..4) must be null
    for (let i = 0; i <= period - 1; i++) {
      expect(result[i]).toBeNull();
    }
    // Value at index `period` should be a number
    expect(result[period]).toBeTypeOf('number');
  });

  it('computes hand-calculated ATR for small dataset', () => {
    // 6 candles, period=3
    // Index:  0     1     2     3     4     5
    const highs =  [10, 12, 11, 13, 14, 12];
    const lows =   [ 8,  9, 10, 10, 11, 10];
    const closes = [ 9, 11, 10, 12, 13, 11];

    // TR[1] = max(12-9, |12-9|, |9-9|) = max(3, 3, 0) = 3
    // TR[2] = max(11-10, |11-11|, |10-11|) = max(1, 0, 1) = 1
    // TR[3] = max(13-10, |13-10|, |10-10|) = max(3, 3, 0) = 3
    // TR[4] = max(14-11, |14-12|, |11-12|) = max(3, 2, 1) = 3
    // TR[5] = max(12-10, |12-13|, |10-13|) = max(2, 1, 3) = 3

    const period = 3;
    const result = computeATR(highs, lows, closes, period);

    expect(result).toHaveLength(6);

    // Null for indices 0, 1, 2
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();

    // First ATR at index 3 = SMA of TR[1..3] = (3 + 1 + 3) / 3 = 7/3
    const firstATR = 7 / 3;
    expect(result[3]).toBeCloseTo(firstATR, 10);

    // ATR[4] = (prevATR * 2 + TR[4]) / 3 = (7/3 * 2 + 3) / 3 = (14/3 + 3) / 3 = (23/3) / 3 = 23/9
    const atr4 = (firstATR * 2 + 3) / 3;
    expect(result[4]).toBeCloseTo(atr4, 10);

    // ATR[5] = (atr4 * 2 + TR[5]) / 3 = (23/9 * 2 + 3) / 3 = (46/9 + 3) / 3 = (73/9) / 3 = 73/27
    const atr5 = (atr4 * 2 + 3) / 3;
    expect(result[5]).toBeCloseTo(atr5, 10);
  });

  it('output array has same length as input', () => {
    const len = 30;
    const highs = Array.from({ length: len }, (_, i) => 100 + i + 2);
    const lows = Array.from({ length: len }, (_, i) => 100 + i - 2);
    const closes = Array.from({ length: len }, (_, i) => 100 + i);
    const result = computeATR(highs, lows, closes, 14);
    expect(result).toHaveLength(len);
  });

  it('ATR is always non-negative', () => {
    const highs =  [50, 52, 48, 55, 53, 50, 58, 56, 49, 52, 54, 51, 55, 53, 50, 57];
    const lows =   [45, 47, 43, 49, 48, 45, 52, 50, 44, 47, 49, 46, 50, 48, 45, 52];
    const closes = [48, 50, 45, 53, 51, 48, 55, 53, 46, 50, 52, 49, 53, 51, 48, 55];
    const result = computeATR(highs, lows, closes, 5);

    for (const val of result) {
      if (val !== null) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('handles gap up scenario (|high - prevClose| is dominant TR component)', () => {
    // Candle at index 1 gaps up significantly
    const highs =  [10, 20, 21];
    const lows =   [ 9, 19, 20];
    const closes = [10, 20, 20.5];
    const period = 2;
    const result = computeATR(highs, lows, closes, period);

    // TR[1] = max(20-19, |20-10|, |19-10|) = max(1, 10, 9) = 10
    // TR[2] = max(21-20, |21-20|, |20-20|) = max(1, 1, 0) = 1
    // ATR at index 2 = (10 + 1) / 2 = 5.5
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(5.5, 10);
  });
});
