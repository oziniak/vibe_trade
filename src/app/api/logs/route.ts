import { NextRequest, NextResponse } from 'next/server';
import { readLogs } from '@/lib/api-logger';

export async function GET(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;

  // Route effectively disabled if ADMIN_TOKEN is not set
  if (!adminToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = request.nextUrl.searchParams.get('token');
  if (token !== adminToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);

  const logs = await readLogs(limit);
  return NextResponse.json({ count: logs.length, logs });
}
