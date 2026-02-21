import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseStrategy } from '@/lib/parser';

export const maxDuration = 10;

const RequestSchema = z.object({
  prompt: z.string().min(1),
  asset: z.string(),
  timeframe: z.literal('1D'),
});

export async function POST(request: NextRequest) {
  try {
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
