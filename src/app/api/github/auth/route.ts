import { NextRequest, NextResponse } from 'next/server';
import { githubApp } from '@/lib/github-app';

export async function GET(request: NextRequest) {
  try {
    // Generate a random state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    
    // Use OAuth flow instead of installation flow for better compatibility
    const redirectUri = new URL('/api/github/callback', request.url).toString();
    const authUrl = githubApp.getAuthorizationUrl(redirectUri, state);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Auth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}