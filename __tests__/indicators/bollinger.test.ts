import { describe, it, expect } from 'vitest';
import { computeBollinger } from '@/indicators/bollinger';
import { computeSMA } from '@/indicators/sma';

describe('computeBollinger', () => {
  it('returns all nulls for empty data', () => {
    const result = computeBollinger([]);
    expect(result.upper).toEqual([]);
    expect(result.middle).toEqual([]);
    expect(result.lower).toEqual([]);
  });

  it('returns all nulls when data is shorter than period', () => {
    const result = computeBollinger([1, 2, 3], 5);
    expect(result.upper).toEqual([null, null, null]);
    expect(result.middle).toEqual([null, null, null]);
    expect(result.lower).toEqual([null, null, null]);
  });

  it('middle band equals SMA', () => {
    const data = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29,
                  22.15, 22.39, 22.38, 22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63];
    const period = 5;
    const result = computeBollinger(data, period, 2);
    const sma = computeSMA(data, period);

    for (let i = 0; i < data.length; i++) {
      if (sma[i] === null) {
        expect(result.middle[i]).toBeNull();
      } else {
        expect(result.middle[i]).toBeCloseTo(sma[i] as number, 10);
      }
    }
  });

  it('upper and lower are symmetric around middle', () => {
    const data = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
    const period = 3;
    const stdDevMult = 2;
    const result = computeBollinger(data, period, stdDevMult);

    for (let i = 0; i < data.length; i++) {
      const mid = result.middle[i];
      const up = result.upper[i];
      const lo = result.lower[i];

      if (mid === null) {
        expect(up).toBeNull();
        expect(lo).toBeNull();
      } else {
        expect(up).not.toBeNull();
        expect(lo).not.toBeNull();
        // upper - middle should equal middle - lower
        const upperDiff = (up as number) - mid;
        const lowerDiff = mid - (lo as number);
        expect(upperDiff).toBeCloseTo(lowerDiff, 10);
      }
    }
  });

  it('computes correct values for a known hand-calculated example', () => {
    // Data: [2, 4, 6, 8, 10], period=3, stdDev=2
    // At index 2: SMA = (2+4+6)/3 = 4
    //   pop stdev = sqrt(((2-4)^2 + (4-4)^2 + (6-4)^2) / 3) = sqrt(8/3) = sqrt(2.6667) ~ 1.6330
    //   upper = 4 + 2*1.6330 = 7.2660
    //   lower = 4 - 2*1.6330 = 0.7340
    const data = [2, 4, 6, 8, 10];
    const result = computeBollinger(data, 3, 2);

    expect(result.middle[0]).toBeNull();
    expect(result.middle[1]).toBeNull();
    expect(result.middle[2]).toBeCloseTo(4, 10);
    expect(result.upper[2]).toBeCloseTo(4 + 2 * Math.sqrt(8 / 3), 10);
    expect(result.lower[2]).toBeCloseTo(4 - 2 * Math.sqrt(8 / 3), 10);

    // At index 3: SMA = (4+6+8)/3 = 6
    //   pop stdev = sqrt(((4-6)^2 + (6-6)^2 + (8-6)^2) / 3) = sqrt(8/3)
    expect(result.middle[3]).toBeCloseTo(6, 10);
    expect(result.upper[3]).toBeCloseTo(6 + 2 * Math.sqrt(8 / 3), 10);
    expect(result.lower[3]).toBeCloseTo(6 - 2 * Math.sqrt(8 / 3), 10);

    // At index 4: SMA = (6+8+10)/3 = 8
    //   pop stdev = sqrt(((6-8)^2 + (8-8)^2 + (10-8)^2) / 3) = sqrt(8/3)
    expect(result.middle[4]).toBeCloseTo(8, 10);
    expect(result.upper[4]).toBeCloseTo(8 + 2 * Math.sqrt(8 / 3), 10);
    expect(result.lower[4]).toBeCloseTo(8 - 2 * Math.sqrt(8 / 3), 10);
  });

  it('warmup count is period - 1', () => {
    const data = Array.from({ length: 30 }, (_, i) => 50 + i);
    const period = 10;
    const result = computeBollinger(data, period);

    for (let i = 0; i < period - 1; i++) {
      expect(result.upper[i]).toBeNull();
      expect(result.middle[i]).toBeNull();
      expect(result.lower[i]).toBeNull();
    }
    expect(result.upper[period - 1]).toBeTypeOf('number');
    expect(result.middle[period - 1]).toBeTypeOf('number');
    expect(result.lower[period - 1]).toBeTypeOf('number');
  });

  it('all output arrays have same length as input', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = computeBollinger(data, 3);
    expect(result.upper).toHaveLength(10);
    expect(result.middle).toHaveLength(10);
    expect(result.lower).toHaveLength(10);
  });

  it('bands collapse to zero width for constant data', () => {
    const data = new Array(20).fill(100);
    const result = computeBollinger(data, 5, 2);

    for (let i = 4; i < data.length; i++) {
      expect(result.middle[i]).toBeCloseTo(100, 10);
      expect(result.upper[i]).toBeCloseTo(100, 10);
      expect(result.lower[i]).toBeCloseTo(100, 10);
    }
  });
});
