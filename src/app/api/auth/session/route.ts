import { NextRequest, NextResponse } from 'next/server';
import { getAuthMode } from '@/lib/auth-config';

/**
 * Session endpoint
 *
 * GET: Returns the current session status and access token
 *      Supports both OAuth (cookie-based) and PAT (env-based) modes
 * DELETE: Clears the session (logout)
 */
export async function GET(request: NextRequest) {
  // Check for PAT mode first — if GITHUB_TOKEN is set in .env.local, use it
  const authMode = getAuthMode();
  if (authMode === 'pat') {
    const pat = process.env.GITHUB_TOKEN;
    if (pat) {
      try {
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (userResponse.ok) {
          const user = await userResponse.json();
          return NextResponse.json({
            authenticated: true,
            accessToken: pat,
            user: {
              login: user.login,
              avatar_url: user.avatar_url,
              name: user.name,
            },
          });
        }
      } catch (error) {
        console.error('PAT validation error:', error);
      }
    }
  }

  // OAuth mode — check cookie
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
