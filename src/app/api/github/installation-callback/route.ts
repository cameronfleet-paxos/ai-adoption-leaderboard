import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');
  // const state = searchParams.get('state'); // Not used currently

  // Handle setup errors - but allow updates with installation ID
  if (setupAction === 'update' && !installationId) {
    return NextResponse.redirect(
      new URL('/?error=Installation configuration was cancelled', request.url)
    );
  }

  // Validate required parameters
  if (!installationId) {
    return NextResponse.redirect(
      new URL('/?error=Missing installation ID', request.url)
    );
  }

  try {
    // Get repositories for this installation directly
    const repositories = await githubApp.getInstallationRepositories(parseInt(installationId));

    if (!repositories || repositories.length === 0) {
      return NextResponse.redirect(
        new URL('/?error=No repositories selected during installation', request.url)
      );
    }

    // Prepare repository data for session storage
    const repoData = repositories.map(repo => ({
      owner: repo.owner.login,
      name: repo.name,
      displayName: repo.name
    }));

    // Create response and store session data
    const response = NextResponse.redirect(new URL('/', request.url));
    const session = await getSession(request, response);
    
    // Store authentication data in secure session
    session.installationId = parseInt(installationId);
    session.repositories = repoData;
    session.isAuthenticated = true;
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    await session.save();

    return response;
  } catch (error) {
    console.error('Installation callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Installation processing failed';
    
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}