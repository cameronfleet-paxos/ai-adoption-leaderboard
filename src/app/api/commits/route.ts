import { NextRequest, NextResponse } from 'next/server';
import { fetchCommitData, Repository } from '@/lib/github';
import { getSession, isSessionValid } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    // Validate session first
    const response = NextResponse.next();
    const session = await getSession(request, response);

    if (!isSessionValid(session)) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in again.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { dateRange, repositories } = body;

    // Use session data instead of request body for security
    const { installationId, repositories: sessionRepos } = session;

    if (!repositories || repositories.length === 0) {
      return NextResponse.json(
        { error: 'No repositories selected' },
        { status: 400 }
      );
    }

    // Validate that requested repositories are in the user's session
    const allowedRepoNames = sessionRepos?.map(repo => repo.name) || [];
    const requestedRepoNames = repositories.map((repo: Repository) => repo.name);
    const unauthorizedRepos = requestedRepoNames.filter((name: string) => !allowedRepoNames.includes(name));

    if (unauthorizedRepos.length > 0) {
      return NextResponse.json(
        { error: `Unauthorized access to repositories: ${unauthorizedRepos.join(', ')}` },
        { status: 403 }
      );
    }

    const result = await fetchCommitData(
      {
        start: new Date(dateRange.startDate),
        end: new Date(dateRange.endDate)
      },
      repositories,
      installationId!
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Commit data fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch commit data';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}