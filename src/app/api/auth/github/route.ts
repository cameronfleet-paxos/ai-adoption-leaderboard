import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for Vercel Edge Functions
export const runtime = 'edge';

/**
 * GitHub OAuth initiation endpoint
 *
 * Redirects the user to GitHub's authorization page with proper
 * state parameter for CSRF protection.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    );
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  // Build the callback URL
  const callbackUrl = new URL('/api/auth/github/callback', request.url);

  // Build the GitHub authorization URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'repo read:user');

  // Create response with redirect
  const response = NextResponse.redirect(authUrl.toString());

  // Store state in a cookie for validation in the callback
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
