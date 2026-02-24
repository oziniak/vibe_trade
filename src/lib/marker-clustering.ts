import { getISOWeek, getISOWeekYear } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────

export type Granularity = 'none' | 'weekly' | 'monthly' | 'quarterly';

export interface MergedMarker {
  time: string;       // date string e.g. "2022-04-15"
  avgPrice: number;
  count: number;
  side: 'buy' | 'sell';
}

export interface ClusteredMarker {
  time: string;       // representative date (median of bucket)
  avgPrice: number;   // volume-weighted average price
  totalCount: number; // total trade count across bucket
  side: 'buy' | 'sell';
}

// ── Pure functions ─────────────────────────────────────────────────────────

/**
 * Map visible bar count to a clustering granularity.
 */
export function determineBucketGranularity(visibleBarCount: number): Granularity {
  if (visibleBarCount <= 90) return 'none';
  if (visibleBarCount <= 365) return 'weekly';
  if (visibleBarCount <= 730) return 'monthly';
  return 'quarterly';
}

/**
 * Return a grouping key for a date string at the given granularity.
 */
export function bucketKey(dateStr: string, granularity: Granularity): string {
  if (granularity === 'none') return dateStr;

  const date = new Date(dateStr + 'T00:00:00');

  if (granularity === 'weekly') {
    const weekYear = getISOWeekYear(date);
    const week = getISOWeek(date);
    return `${weekYear}-W${String(week).padStart(2, '0')}`;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  if (granularity === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  // quarterly
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Group merged markers into time-based clusters.
 * Each cluster uses a volume-weighted average price (weighted by trade count)
 * and the median date as its representative time.
 */
export function clusterMarkers(
  markers: MergedMarker[],
  granularity: Granularity,
): ClusteredMarker[] {
  if (granularity === 'none') {
    return markers.map((m) => ({
      time: m.time,
      avgPrice: m.avgPrice,
      totalCount: m.count,
      side: m.side,
    }));
  }

  // Group by bucket key
  const buckets = new Map<string, MergedMarker[]>();
  for (const m of markers) {
    const key = bucketKey(m.time, granularity);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(m);
    } else {
      buckets.set(key, [m]);
    }
  }

  const result: ClusteredMarker[] = [];
  for (const group of buckets.values()) {
    // Volume-weighted average price (weight = trade count per marker)
    let weightedSum = 0;
    let totalCount = 0;
    for (const m of group) {
      weightedSum += m.avgPrice * m.count;
      totalCount += m.count;
    }
    const avgPrice = weightedSum / totalCount;

    // Median date = middle element (dates already sorted since input is sorted)
    const medianIdx = Math.floor(group.length / 2);
    const time = group[medianIdx].time;

    result.push({ time, avgPrice, totalCount, side: group[0].side });
  }

  // Sort by time (required by lightweight-charts)
  result.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return result;
}

/**
 * Format a cluster into a human-readable marker label.
 */
export function formatMarkerLabel(cluster: ClusteredMarker): string {
  const verb = cluster.side === 'buy' ? 'Buy' : 'Sell';
  const price = `$${cluster.avgPrice.toFixed(0)}`;
  if (cluster.totalCount === 1) {
    return `${verb} ${price}`;
  }
  return `${cluster.totalCount}× ${verb} ~${price}`;
}
