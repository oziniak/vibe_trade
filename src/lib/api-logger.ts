import { Redis } from '@upstash/redis';

const LOG_KEY = 'api:logs';
const MAX_ENTRIES = 200;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
  }
  return redis;
}

export interface LogEntry {
  timestamp: string;
  ip: string;
  prompt: string;
  asset: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

/** Mask IP to first 2 octets for privacy: 192.168.1.5 → 192.168.*.* */
export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 or other — just take first 2 segments
  const segments = ip.split(':');
  if (segments.length > 2) {
    return `${segments[0]}:${segments[1]}:*`;
  }
  return ip;
}

/**
 * Push a log entry to Redis. Fire-and-forget — never blocks the caller.
 * No-op if Redis is not configured.
 */
export function logApiRequest(entry: LogEntry): void {
  const r = getRedis();
  if (!r) return;

  const pipeline = r.pipeline();
  pipeline.lpush(LOG_KEY, JSON.stringify(entry));
  pipeline.ltrim(LOG_KEY, 0, MAX_ENTRIES - 1);
  pipeline.exec().catch((err) => {
    console.error('[api-logger] failed to write log:', err);
  });
}

/**
 * Read the last N log entries. Returns [] if Redis is not configured.
 */
export async function readLogs(limit: number = 50): Promise<LogEntry[]> {
  const r = getRedis();
  if (!r) return [];

  const raw = await r.lrange<string>(LOG_KEY, 0, limit - 1);
  return raw.map((s) => (typeof s === 'string' ? JSON.parse(s) : s) as LogEntry);
}
