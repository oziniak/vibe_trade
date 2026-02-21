import type { Candle } from '@/types/results';

/** Engine-internal: open position tracking */
export interface OpenPosition {
  entryPrice: number;   // fill price after slippage
  entryIndex: number;   // candle index where entered
  entryDate: string;
  units: number;        // crypto units held
  positionSize: number; // $ value invested (before fees)
}

/** Pre-computed indicator values keyed by indicatorKey() */
export type IndicatorCache = Record<string, (number | null)[]>;
