import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_LOCAL_PATH = join(process.cwd(), '.env.local');

function isDev() {
  return process.env.NODE_ENV === 'development';
}

/**
 * GET: Check if GITHUB_TOKEN is configured
 */
export async function GET() {
  if (!isDev()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  return NextResponse.json({
    configured: !!process.env.GITHUB_TOKEN,
  });
}

/**
 * POST: Validate a PAT and write it to .env.local
 */
export async function POST(request: NextRequest) {
  if (!isDev()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const { token } = await request.json();

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // Validate the token against GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token.trim()}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!userResponse.ok) {
    return NextResponse.json(
      { error: 'Invalid token. Please check and try again.' },
      { status: 401 }
    );
  }

  const user = await userResponse.json();

  // Read existing .env.local content (or start fresh)
  let content = '';
  if (existsSync(ENV_LOCAL_PATH)) {
    content = readFileSync(ENV_LOCAL_PATH, 'utf-8');
  }

  // Update or add GITHUB_TOKEN line
  const tokenLine = `GITHUB_TOKEN=${token.trim()}`;
  if (/^GITHUB_TOKEN=.*/m.test(content)) {
    content = content.replace(/^GITHUB_TOKEN=.*/m, tokenLine);
  } else {
    content = content.trimEnd() + (content.trim() ? '\n' : '') + tokenLine + '\n';
  }

  writeFileSync(ENV_LOCAL_PATH, content, 'utf-8');

  return NextResponse.json({
    success: true,
    user: { login: user.login, avatar_url: user.avatar_url, name: user.name },
    message: 'Token saved to .env.local. Please restart your dev server for changes to take effect.',
  });
}
