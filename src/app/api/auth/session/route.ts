import { NextRequest, NextResponse } from 'next/server';

// Use Edge Runtime for Vercel Edge Functions
export const runtime = 'edge';

/**
 * Session endpoint
 *
 * GET: Returns the current session status and access token
 * DELETE: Clears the session (logout)
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('github_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false });
  }

  // Validate the token with GitHub
  try {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      // Token is invalid, clear it
      const response = NextResponse.json({ authenticated: false });
      response.cookies.delete('github_access_token');
      response.cookies.delete('github_refresh_token');
      return response;
    }

    const user = await userResponse.json();

    return NextResponse.json({
      authenticated: true,
      accessToken,
      user: {
        login: user.login,
        avatar_url: user.avatar_url,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * Logout - clear session cookies
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.delete('github_access_token');
  response.cookies.delete('github_refresh_token');
  response.cookies.delete('oauth_state');

  return response;
}
