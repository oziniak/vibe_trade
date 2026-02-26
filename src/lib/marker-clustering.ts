import { getISOWeek, getISOWeekYear } from 'date-fns';

export type Granularity = 'none' | 'weekly' | 'monthly' | 'quarterly';

export interface MergedMarker {
  time: string;
  avgPrice: number;
  count: number;
  side: 'buy' | 'sell';
}

export interface ClusteredMarker {
  time: string;
  avgPrice: number;
  totalCount: number;
  side: 'buy' | 'sell';
}

export function determineBucketGranularity(visibleBarCount: number): Granularity {
  if (visibleBarCount <= 90) return 'none';
  if (visibleBarCount <= 365) return 'weekly';
  if (visibleBarCount <= 730) return 'monthly';
  return 'quarterly';
}

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

export function formatMarkerLabel(cluster: ClusteredMarker): string {
  const verb = cluster.side === 'buy' ? 'Buy' : 'Sell';
  const price = `$${cluster.avgPrice.toFixed(0)}`;
  if (cluster.totalCount === 1) {
    return `${verb} ${price}`;
  }
  return `${cluster.totalCount}× ${verb} ~${price}`;
}
