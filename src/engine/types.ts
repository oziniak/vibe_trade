import type { Candle } from '@/types/results';

export interface OpenPosition {
  entryPrice: number;   // fill price after slippage
  entryIndex: number;   // candle index where entered
  entryDate: string;
  units: number;        // crypto units held
  positionSize: number; // $ value invested (before fees)
}

export type IndicatorCache = Record<string, (number | null)[]>;
