import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseStrategy } from '@/lib/parser';
import { checkRateLimit } from '@/lib/rate-limit';

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
  try {
    // ── Rate limit ────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip);

    if (!rl.allowed) {
      const message =
        rl.limitType === 'daily'
          ? 'Daily request limit reached (10/day). Please come back tomorrow.'
          : `Too many requests. Please wait ${rl.retryAfter} seconds.`;

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

    // ── Parse request ─────────────────────────────────────────────────
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', suggestions: [] },
        { status: 400 }
      );
    }

    const result = await parseStrategy(parsed.data.prompt);
    return NextResponse.json(result);

  } catch {
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
