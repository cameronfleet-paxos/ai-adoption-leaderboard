import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSessionValid } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.next();
    const session = await getSession(request, response);

    if (!isSessionValid(session)) {
      return NextResponse.json({
        isAuthenticated: false,
        installationId: null,
        repositories: []
      });
    }

    return NextResponse.json({
      isAuthenticated: true,
      installationId: session.installationId,
      repositories: session.repositories || []
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({
      isAuthenticated: false,
      installationId: null,
      repositories: []
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    const session = await getSession(request, response);
    
    // Clear session data
    session.destroy();
    
    return response;
  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}