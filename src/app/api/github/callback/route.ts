import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
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

    // Prepare repository data for URL parameters
    const repoData = (repositories || []).map(repo => ({
      owner: repo.owner.login,
      name: repo.name,
      displayName: repo.name
    }));

    // Create URL with installation data
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('installation_id', installationId.toString());
    redirectUrl.searchParams.set('repositories', JSON.stringify(repoData));
    
    // If state was provided, include it for the frontend to handle
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}