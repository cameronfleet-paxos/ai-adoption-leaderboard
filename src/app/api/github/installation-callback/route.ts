import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');
  const state = searchParams.get('state');

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

    // Prepare repository data for URL parameters
    const repoData = repositories.map(repo => ({
      owner: repo.owner.login,
      name: repo.name,
      displayName: repo.name
    }));

    // Create URL with installation data
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('installation_id', installationId);
    redirectUrl.searchParams.set('repositories', JSON.stringify(repoData));
    
    // If state was provided, include it for the frontend to handle
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Installation callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Installation processing failed';
    
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}