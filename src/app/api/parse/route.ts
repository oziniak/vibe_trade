import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseStrategy } from '@/lib/parser';
import { checkRateLimit } from '@/lib/rate-limit';
import { logApiRequest, maskIp } from '@/lib/api-logger';

export const maxDuration = 10;

const RequestSchema = z.object({
  prompt: z.string().min(1),
  asset: z.string(),
  timeframe: z.literal('1D'),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const maskedIp = maskIp(ip);

  try {
    const rl = await checkRateLimit(ip);

    if (!rl.allowed) {
      const message =
        rl.limitType === 'daily'
          ? 'Daily request limit reached (10/day). Please come back tomorrow.'
          : `Too many requests. Please wait ${rl.retryAfter} seconds.`;

      logApiRequest({
        timestamp: new Date().toISOString(),
        ip: maskedIp,
        prompt: '',
        asset: '',
        success: false,
        error: `rate-limit:${rl.limitType}`,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          retryAfter: rl.retryAfter,
          limitType: rl.limitType,
          suggestions: [
            'Try a preset strategy from the demo section while you wait.',
          ],
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter) },
        }
      );
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      logApiRequest({
        timestamp: new Date().toISOString(),
        ip: maskedIp,
        prompt: JSON.stringify(body).slice(0, 500),
        asset: '',
        success: false,
        error: 'validation:invalid_request',
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request', suggestions: [] },
        { status: 400 }
      );
    }

    const result = await parseStrategy(parsed.data.prompt);

    logApiRequest({
      timestamp: new Date().toISOString(),
      ip: maskedIp,
      prompt: parsed.data.prompt,
      asset: parsed.data.asset,
      success: result.success,
      error: result.success ? undefined : result.error,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(result);

  } catch (err) {
    logApiRequest({
      timestamp: new Date().toISOString(),
      ip: maskedIp,
      prompt: '',
      asset: '',
      success: false,
      error: `unhandled:${err instanceof Error ? err.message : 'unknown'}`,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred.',
        suggestions: [
          "Buy BTC when RSI drops below 30, sell when it goes above 70",
          "DCA $100 into BTC every week",
        ],
      },
      { status: 500 }
    );
  }
}
