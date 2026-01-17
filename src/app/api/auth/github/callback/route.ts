import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for Vercel Edge Functions
export const runtime = 'edge';

/**
 * GitHub OAuth callback handler
 *
 * This endpoint exchanges the authorization code for an access token.
 * The client_secret is securely stored in environment variables and
 * never exposed to the client.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors from GitHub
  if (error) {
    const errorMessage = errorDescription || error;
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=Missing%20authorization%20code', request.url)
    );
  }

  // Validate state to prevent CSRF attacks
  // The state should be stored in a cookie and validated here
  const storedState = request.cookies.get('oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/?error=Invalid%20state%20parameter', request.url)
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GitHub OAuth credentials');
    return NextResponse.redirect(
      new URL('/?error=Server%20configuration%20error', request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      throw new Error('No access token received');
    }

    // Redirect to the app with the token in a secure way
    // We'll use a one-time code that the client can exchange
    const response = NextResponse.redirect(new URL('/', request.url));

    // Clear the oauth_state cookie
    response.cookies.delete('oauth_state');

    // Set the token in a secure httpOnly cookie
    // The client will read user info and store what it needs
    response.cookies.set('github_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in || 28800, // 8 hours default
      path: '/',
    });

    // Store refresh token if provided
    if (refresh_token) {
      response.cookies.set('github_refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 180, // 6 months
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
