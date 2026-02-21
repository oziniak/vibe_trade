import { describe, it, expect } from 'vitest';
import { computeSMA } from '@/indicators/sma';

describe('computeSMA', () => {
  it('SMA(3) of [1, 2, 3, 4, 5] = [null, null, 2, 3, 4]', () => {
    const result = computeSMA([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });

  it('SMA(2) of [10, 20, 30] = [null, 15, 25]', () => {
    const result = computeSMA([10, 20, 30], 2);
    expect(result).toEqual([null, 15, 25]);
  });

  it('single element with period 1 returns [value]', () => {
    const result = computeSMA([42], 1);
    expect(result).toEqual([42]);
  });

  it('period 1 returns the original values', () => {
    const result = computeSMA([10, 20, 30], 1);
    expect(result).toEqual([10, 20, 30]);
  });

  it('empty array returns empty array', () => {
    const result = computeSMA([], 3);
    expect(result).toEqual([]);
  });

  it('returns all nulls when data length < period', () => {
    const result = computeSMA([1, 2], 5);
    expect(result).toEqual([null, null]);
  });

  it('result length matches input length', () => {
    const data = [10, 20, 30, 40, 50, 60];
    const result = computeSMA(data, 4);
    expect(result).toHaveLength(data.length);
    // First 3 should be null
    expect(result.slice(0, 3)).toEqual([null, null, null]);
    // SMA(4) of [10,20,30,40] = 25
    expect(result[3]).toBe(25);
    // SMA(4) of [20,30,40,50] = 35
    expect(result[4]).toBe(35);
    // SMA(4) of [30,40,50,60] = 45
    expect(result[5]).toBe(45);
  });
});
