import { NextRequest, NextResponse } from 'next/server';
import { getAuthMode } from '@/lib/auth-config';
import { getCacheInfo } from '@/lib/disk-cache';

function getToken(request: NextRequest): string | null {
  const authMode = getAuthMode();
  if (authMode === 'pat') {
    return process.env.GITHUB_TOKEN ?? null;
  }
  return request.cookies.get('github_access_token')?.value ?? null;
}

export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(getCacheInfo());
}
