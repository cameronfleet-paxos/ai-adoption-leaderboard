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

  // Check if user wants private repo access
  const { searchParams } = new URL(request.url);
  const includePrivate = searchParams.get('private') === 'true';

  // Generate a random state for CSRF protection
  // Encode the private preference in the state
  const stateData = {
    csrf: crypto.randomUUID(),
    private: includePrivate,
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  // Build the callback URL
  const callbackUrl = new URL('/api/auth/github/callback', request.url);

  // Build the GitHub authorization URL
  // Minimal scopes: public_repo for public repos only, or repo for private
  // read:org allows listing org memberships (needed for org repos)
  const scopes = includePrivate
    ? 'repo read:org'  // Full repo access needed for private repos
    : 'public_repo read:org';  // Public repos only (read-only)

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);

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
