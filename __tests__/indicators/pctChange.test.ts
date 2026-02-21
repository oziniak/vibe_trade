import { describe, it, expect } from 'vitest';
import { computePctChange } from '@/indicators/pctChange';

describe('computePctChange', () => {
  it('returns all nulls for empty data', () => {
    expect(computePctChange([])).toEqual([]);
  });

  it('returns all nulls when data length equals period', () => {
    expect(computePctChange([100], 1)).toEqual([null]);
  });

  it('computes pctChange(1) of [100, 110, 99] = [null, 10, -10]', () => {
    const result = computePctChange([100, 110, 99], 1);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(10, 10);
    expect(result[2]).toBeCloseTo(-10, 10);
  });

  it('computes pctChange(2) correctly', () => {
    // [100, 110, 99, 120]
    // pctChange(2):
    //   index 0: null
    //   index 1: null
    //   index 2: (99 - 100) / 100 * 100 = -1
    //   index 3: (120 - 110) / 110 * 100 = 9.0909...
    const result = computePctChange([100, 110, 99, 120], 2);
    expect(result).toHaveLength(4);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(-1, 10);
    expect(result[3]).toBeCloseTo((120 - 110) / 110 * 100, 10);
  });

  it('returns null for first `period` values', () => {
    const data = [10, 20, 30, 40, 50];
    const period = 3;
    const result = computePctChange(data, period);

    for (let i = 0; i < period; i++) {
      expect(result[i]).toBeNull();
    }
    expect(result[period]).toBeTypeOf('number');
  });

  it('handles zero in data (division by zero yields null)', () => {
    const data = [0, 10, 20];
    const result = computePctChange(data, 1);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull(); // (10 - 0) / 0 -> null
    expect(result[2]).toBeCloseTo(100, 10); // (20 - 10) / 10 * 100 = 100
  });

  it('output array has same length as input', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = computePctChange(data, 1);
    expect(result).toHaveLength(10);
  });

  it('computes 100% increase correctly', () => {
    const data = [50, 100];
    const result = computePctChange(data, 1);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(100, 10);
  });

  it('computes 50% decrease correctly', () => {
    const data = [200, 100];
    const result = computePctChange(data, 1);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(-50, 10);
  });

  it('default period is 1', () => {
    const data = [100, 120];
    const result = computePctChange(data);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(20, 10);
  });
});
