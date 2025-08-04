import { getIronSession, SessionOptions } from 'iron-session';
import { NextRequest, NextResponse } from 'next/server';

export interface SessionData {
  installationId?: number;
  repositories?: Array<{
    owner: string;
    name: string;
    displayName: string;
  }>;
  isAuthenticated?: boolean;
  expiresAt?: number;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'default-session-secret-change-in-production-32-chars-minimum',
  cookieName: 'ai-leaderboard-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
    sameSite: 'lax',
  },
};

export async function getSession(req: NextRequest, res: NextResponse) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

export function isSessionValid(session: SessionData): boolean {
  if (!session.isAuthenticated || !session.installationId || !session.repositories) {
    return false;
  }
  
  if (session.expiresAt && Date.now() > session.expiresAt) {
    return false;
  }
  
  return true;
}