import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';

export async function GET(request: NextRequest) {
  try {
    // Generate a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    
    // Get the redirect URI for the installation callback
    const redirectUri = new URL('/api/github/installation-callback', request.url).toString();
    
    // Use the installation URL to force showing the installation selection page
    const installationUrl = await githubApp.getInstallationUrl(redirectUri, state);
    
    return NextResponse.redirect(installationUrl);
  } catch (error) {
    console.error('Installation initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate installation' },
      { status: 500 }
    );
  }
}