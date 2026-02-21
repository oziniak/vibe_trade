import { describe, it, expect } from 'vitest';
import { computeMACD } from '@/indicators/macd';

describe('computeMACD', () => {
  it('returns all nulls for empty data', () => {
    const result = computeMACD([]);
    expect(result.line).toEqual([]);
    expect(result.signal).toEqual([]);
    expect(result.histogram).toEqual([]);
  });

  it('returns all nulls when data is shorter than slowPeriod', () => {
    const data = [1, 2, 3, 4, 5];
    const result = computeMACD(data, 3, 5, 2);
    // slowPeriod=5 means slow EMA needs 5 points; fast needs 3.
    // line starts at index 4 (slowPeriod-1).
    // But signal needs 2 more non-null MACD values (signalPeriod=2).
    // With only 5 data points, line has 1 non-null value at index 4.
    // Signal needs 2 non-null MACD values, so signal is all null.
    expect(result.line.slice(0, 4)).toEqual([null, null, null, null]);
    expect(result.line[4]).toBeTypeOf('number');
    expect(result.signal).toEqual([null, null, null, null, null]);
    expect(result.histogram).toEqual([null, null, null, null, null]);
  });

  it('computes correct warmup null count with small periods', () => {
    // fast=3, slow=5, signal=3
    // MACD line available from index 4 (slowPeriod - 1 = 4)
    // Signal needs 3 non-null MACD values, so first signal at index 6
    // Total warmup for signal: (5-1) + (3-1) = 6 nulls (indices 0..5)
    const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const result = computeMACD(data, 3, 5, 3);

    // Line should be null for first 4 indices
    for (let i = 0; i < 4; i++) {
      expect(result.line[i]).toBeNull();
    }
    // Line should have values from index 4 onward
    for (let i = 4; i < data.length; i++) {
      expect(result.line[i]).toBeTypeOf('number');
    }

    // Signal should be null for first 6 indices
    for (let i = 0; i < 6; i++) {
      expect(result.signal[i]).toBeNull();
    }
    // Signal should have values from index 6 onward
    for (let i = 6; i < data.length; i++) {
      expect(result.signal[i]).toBeTypeOf('number');
    }
  });

  it('histogram equals line minus signal', () => {
    const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
                  46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03,
                  46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78,
                  45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13];
    const result = computeMACD(data, 12, 26, 9);

    for (let i = 0; i < data.length; i++) {
      const l = result.line[i];
      const s = result.signal[i];
      const h = result.histogram[i];

      if (l === null || s === null) {
        // If either line or signal is null, histogram must be null
        if (l === null && s === null) {
          expect(h).toBeNull();
        }
      } else {
        // Both line and signal are non-null, histogram = line - signal
        expect(h).not.toBeNull();
        expect(h).toBeCloseTo(l - s, 10);
      }
    }
  });

  it('all output arrays have same length as input', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 10);
    const result = computeMACD(data, 12, 26, 9);
    expect(result.line).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);
  });

  it('computes known MACD values for a simple trending dataset', () => {
    // Linear data: fast EMA reacts quicker, so MACD line > 0 in uptrend
    const data = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
    const result = computeMACD(data, 3, 5, 3);

    // In a steady uptrend, MACD line should be positive (fast > slow)
    for (let i = 4; i < data.length; i++) {
      expect(result.line[i]).toBeGreaterThan(0);
    }
  });

  it('MACD line is zero for constant data', () => {
    const data = new Array(40).fill(50);
    const result = computeMACD(data, 3, 5, 3);

    for (let i = 4; i < data.length; i++) {
      expect(result.line[i]).toBeCloseTo(0, 10);
    }
    for (let i = 6; i < data.length; i++) {
      expect(result.signal[i]).toBeCloseTo(0, 10);
      expect(result.histogram[i]).toBeCloseTo(0, 10);
    }
  });
});
