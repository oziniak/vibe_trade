import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedis();

// 5 requests per 60-second sliding window
const perMinute = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:min' })
  : null;

// 10 requests per 24-hour sliding window
const perDay = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '86400 s'), prefix: 'rl:day' })
  : null;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the next request is allowed (0 if allowed) */
  retryAfter: number;
  /** Which limit was hit */
  limitType?: 'minute' | 'daily';
}

/**
 * Check both rate-limit windows for an IP.
 * Returns immediately if Redis is not configured (allows all requests in dev).
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!perMinute || !perDay) {
    return { allowed: true, retryAfter: 0 };
  }

  // Check both limits in parallel
  const [minuteResult, dayResult] = await Promise.all([
    perMinute.limit(ip),
    perDay.limit(ip),
  ]);

  if (!minuteResult.success) {
    const retryAfter = Math.ceil(
      Math.max(0, minuteResult.reset - Date.now()) / 1000
    );
    return { allowed: false, retryAfter, limitType: 'minute' };
  }

  if (!dayResult.success) {
    const retryAfter = Math.ceil(
      Math.max(0, dayResult.reset - Date.now()) / 1000
    );
    return { allowed: false, retryAfter, limitType: 'daily' };
  }

  return { allowed: true, retryAfter: 0 };
}
