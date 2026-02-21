import { describe, it, expect } from 'vitest';
import { computeEMA } from '@/indicators/ema';

describe('computeEMA', () => {
  it('EMA(3) of [1, 2, 3, 4, 5] = [null, null, 2, 3, 4]', () => {
    // k = 2/(3+1) = 0.5
    // EMA[2] = SMA(1,2,3) = 2
    // EMA[3] = 4 * 0.5 + 2 * 0.5 = 3
    // EMA[4] = 5 * 0.5 + 3 * 0.5 = 4
    const result = computeEMA([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });

  it('EMA(2) of [10, 20, 30, 40]', () => {
    // k = 2/(2+1) = 2/3
    // EMA[1] = SMA(10,20) = 15
    // EMA[2] = 30 * (2/3) + 15 * (1/3) = 20 + 5 = 25
    // EMA[3] = 40 * (2/3) + 25 * (1/3) = 26.666... + 8.333... = 35
    const result = computeEMA([10, 20, 30, 40], 2);
    expect(result[0]).toBeNull();
    expect(result[1]).toBe(15);
    expect(result[2]).toBeCloseTo(25, 10);
    expect(result[3]).toBeCloseTo(35, 10);
  });

  it('period 1 returns the original values (k = 1)', () => {
    // k = 2/(1+1) = 1, so EMA = current value
    const result = computeEMA([5, 10, 15], 1);
    expect(result).toEqual([5, 10, 15]);
  });

  it('empty array returns empty array', () => {
    const result = computeEMA([], 3);
    expect(result).toEqual([]);
  });

  it('returns all nulls when data length < period', () => {
    const result = computeEMA([1, 2], 5);
    expect(result).toEqual([null, null]);
  });

  it('result length matches input length', () => {
    const data = [2, 4, 6, 8, 10];
    const result = computeEMA(data, 3);
    expect(result).toHaveLength(data.length);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).not.toBeNull();
  });

  it('first EMA value equals SMA of the initial window', () => {
    const data = [100, 200, 300, 400, 500];
    const result = computeEMA(data, 4);
    // SMA of first 4: (100+200+300+400)/4 = 250
    expect(result[3]).toBe(250);
  });
});
