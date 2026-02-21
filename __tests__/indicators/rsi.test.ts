import { describe, it, expect } from 'vitest';
import { computeRSI } from '@/indicators/rsi';

describe('computeRSI', () => {
  it('all gains produce RSI = 100', () => {
    // Monotonically increasing: every delta is positive
    const data = [10, 20, 30, 40, 50, 60];
    const period = 3;
    const result = computeRSI(data, period);

    // First `period` values are null
    expect(result.slice(0, period)).toEqual([null, null, null]);

    // All remaining values should be 100
    for (let i = period; i < result.length; i++) {
      expect(result[i]).toBe(100);
    }
  });

  it('all losses produce RSI = 0', () => {
    // Monotonically decreasing: every delta is negative
    const data = [60, 50, 40, 30, 20, 10];
    const period = 3;
    const result = computeRSI(data, period);

    // First `period` values are null
    expect(result.slice(0, period)).toEqual([null, null, null]);

    // All remaining values should be 0
    for (let i = period; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('equal gains and losses produce RSI = 50', () => {
    // Alternating: +10 then -10, so avg gain = avg loss
    // deltas: +10, -10, +10, -10
    const data = [100, 110, 100, 110, 100];
    const period = 4;
    const result = computeRSI(data, period);

    // First `period` values are null
    expect(result.slice(0, period)).toEqual([null, null, null, null]);
    // avgGain = (10+0+10+0)/4 = 5, avgLoss = (0+10+0+10)/4 = 5
    // RS = 1, RSI = 50
    expect(result[period]).toBe(50);
  });

  it('first `period` values are null', () => {
    const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84];
    const period = 5;
    const result = computeRSI(data, period);

    for (let i = 0; i < period; i++) {
      expect(result[i]).toBeNull();
    }
    // Value at index `period` should be a number
    expect(typeof result[period]).toBe('number');
  });

  it('period=14 warmup length is correct', () => {
    // Generate enough data for period=14: need at least 15 data points
    const data: number[] = [];
    for (let i = 0; i < 30; i++) {
      data.push(100 + Math.sin(i) * 10);
    }
    const result = computeRSI(data, 14);

    expect(result).toHaveLength(30);

    // First 14 values are null
    for (let i = 0; i < 14; i++) {
      expect(result[i]).toBeNull();
    }

    // Value at index 14 onward should be numbers between 0 and 100
    for (let i = 14; i < result.length; i++) {
      expect(typeof result[i]).toBe('number');
      expect(result[i] as number).toBeGreaterThanOrEqual(0);
      expect(result[i] as number).toBeLessThanOrEqual(100);
    }
  });

  it('empty array returns empty array', () => {
    const result = computeRSI([], 14);
    expect(result).toEqual([]);
  });

  it('returns all nulls when data is too short', () => {
    // Need period+1 data points; with period=5, need 6 data points
    const result = computeRSI([1, 2, 3], 5);
    expect(result).toEqual([null, null, null]);
  });

  it('result length matches input length', () => {
    const data = [10, 12, 11, 13, 12, 14, 13, 15];
    const result = computeRSI(data, 3);
    expect(result).toHaveLength(data.length);
  });

  it('hand-calculated RSI with period=3', () => {
    // data:   [10, 12, 11, 14, 13]
    // deltas: [+2, -1, +3, -1]
    // period = 3, first RSI at index 3
    //
    // Initial (deltas 0..2 = [+2, -1, +3]):
    //   avgGain = (2 + 0 + 3) / 3 = 5/3
    //   avgLoss = (0 + 1 + 0) / 3 = 1/3
    //   RS = (5/3) / (1/3) = 5
    //   RSI[3] = 100 - 100/(1+5) = 100 - 100/6 = 83.333...
    //
    // Index 4 (delta = -1):
    //   avgGain = ((5/3)*2 + 0) / 3 = (10/3)/3 = 10/9
    //   avgLoss = ((1/3)*2 + 1) / 3 = (5/3)/3 = 5/9
    //   RS = (10/9)/(5/9) = 2
    //   RSI[4] = 100 - 100/(1+2) = 100 - 33.333... = 66.666...
    const data = [10, 12, 11, 14, 13];
    const result = computeRSI(data, 3);

    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
    expect(result[3]).toBeCloseTo(100 - 100 / 6, 10);
    expect(result[4]).toBeCloseTo(100 - 100 / 3, 10);
  });
});
