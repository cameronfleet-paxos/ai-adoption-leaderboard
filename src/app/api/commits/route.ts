import { NextRequest, NextResponse } from 'next/server';
import { fetchCommitData } from '@/lib/github';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dateRange, repositories, installationId } = body;

    if (!installationId || !repositories || repositories.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await fetchCommitData(
      {
        start: new Date(dateRange.startDate),
        end: new Date(dateRange.endDate)
      },
      repositories,
      installationId
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