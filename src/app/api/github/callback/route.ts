import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  // const state = searchParams.get('state'); // Not used currently
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Unknown error';
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=Missing authorization code', request.url)
    );
  }

  try {
    // Exchange code for installation information
    const { installationId, repositories } = await githubApp.exchangeCodeForInstallation(code);

    // Prepare repository data for session storage
    const repoData = (repositories || []).map(repo => ({
      owner: repo.owner.login,
      name: repo.name,
      displayName: repo.name
    }));

    // Create response and store session data
    const response = NextResponse.redirect(new URL('/', request.url));
    const session = await getSession(request, response);
    
    // Store authentication data in secure session
    session.installationId = installationId;
    session.repositories = repoData;
    session.isAuthenticated = true;
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    await session.save();

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}