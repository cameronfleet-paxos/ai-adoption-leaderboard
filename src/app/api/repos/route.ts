import { NextRequest, NextResponse } from 'next/server';
import { getAuthMode } from '@/lib/auth-config';
import type { Repository } from '@/lib/github-client';

const PER_PAGE = 30;

function getToken(request: NextRequest): string | null {
  const authMode = getAuthMode();
  if (authMode === 'pat') {
    return process.env.GITHUB_TOKEN ?? null;
  }
  return request.cookies.get('github_access_token')?.value ?? null;
}

async function fetchUserLogin(token: string): Promise<string | null> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user.login;
}

async function fetchUserOrgs(token: string): Promise<string[]> {
  const response = await fetch('https://api.github.com/user/orgs?per_page=100', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) return [];
  const orgs = await response.json();
  return orgs.map((org: { login: string }) => org.login);
}

/**
 * GET /api/repos?search=&page=1
 *
 * When search is empty: returns user repos sorted by recently pushed
 * When search is non-empty: uses GitHub search API to find repos across user + orgs
 */
export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  try {
    if (!search) {
      // No search: return user repos sorted by recently pushed
      const response = await fetch(
        `https://api.github.com/user/repos?sort=pushed&per_page=${PER_PAGE}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch repositories' },
          { status: response.status }
        );
      }

      const rawRepos = await response.json();
      const repos: Repository[] = rawRepos.map(
        (repo: { owner: { login: string }; name: string; full_name: string }) => ({
          owner: repo.owner.login,
          name: repo.name,
          displayName: repo.full_name,
        })
      );

      const linkHeader = response.headers.get('link');
      const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;

      return NextResponse.json({ repos, hasMore });
    }

    // Search mode: use GitHub search API
    const login = await fetchUserLogin(token);
    if (!login) {
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 500 });
    }

    const orgs = await fetchUserOrgs(token);

    // Build query: search term + user:{login} + org:{org1} + org:{org2}...
    const qualifiers = [`user:${login}`, ...orgs.map((org) => `org:${org}`)];
    const q = `${search} ${qualifiers.join(' ')}`;

    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Search failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const repos: Repository[] = data.items.map(
      (repo: { owner: { login: string }; name: string; full_name: string }) => ({
        owner: repo.owner.login,
        name: repo.name,
        displayName: repo.full_name,
      })
    );

    const totalCount: number = data.total_count;
    const hasMore = page * PER_PAGE < totalCount;

    return NextResponse.json({ repos, hasMore });
  } catch (error) {
    console.error('Error in /api/repos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
