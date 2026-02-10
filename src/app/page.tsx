'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { Header } from '@/components/Header';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { RepositorySelector } from '@/components/RepositorySelector';
import { TokenAuth } from '@/components/TokenAuth';
import { OAuthLogin } from '@/components/OAuthLogin';
import {
  type Repository,
  type AIToolBreakdown,
  type AITool,
  type ClaudeModelBreakdown,
  type ClaudeModel,
  fetchCommitDataClient,
} from '@/lib/github-client';

// Check if OAuth is available (client-side check)
const isOAuthAvailable = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Repository state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);

  const emptyToolBreakdown = useMemo<AIToolBreakdown>(() => ({
    'claude-coauthor': 0,
    'claude-generated': 0,
    'copilot': 0,
    'cursor': 0,
  }), []);

  const emptyModelBreakdown = useMemo<ClaudeModelBreakdown>(() => ({
    opus: 0,
    sonnet: 0,
    haiku: 0,
    unknown: 0,
  }), []);

  const [data, setData] = useState({
    totalCommits: 0,
    aiCommits: 0,
    aiToolBreakdown: emptyToolBreakdown,
    claudeModelBreakdown: emptyModelBreakdown,
    activeUsers: 0,
    leaderboard: [] as Array<{
      rank: number;
      username: string;
      commits: number;
      totalCommits: number;
      aiPercentage: number;
      avatar: string;
      commitDetails: Array<{
        sha: string;
        message: string;
        date: string;
        url: string;
        repository: string;
        aiTool: AITool;
        claudeModel?: ClaudeModel;
      }>;
      aiToolBreakdown: AIToolBreakdown;
      claudeModelBreakdown: ClaudeModelBreakdown;
    }>
  });

  // Initialize date range to past week (inclusive of today)
  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();

    // Set end to tomorrow to include all of today
    end.setDate(end.getDate() + 1);
    // Set start to 6 days ago (7 days total including today)
    start.setDate(start.getDate() - 6);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  // Update URL when selected repos change
  const updateUrlWithRepos = useCallback((repos: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (repos.length > 0) {
      params.set('repos', encodeURIComponent(JSON.stringify(repos)));
    } else {
      params.delete('repos');
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  const handleRepoChange = useCallback((newSelectedRepos: string[]) => {
    setSelectedRepos(newSelectedRepos);
    updateUrlWithRepos(newSelectedRepos);
  }, [updateUrlWithRepos]);

  // Load auth state on mount — always use session endpoint (works for both OAuth and PAT)
  useEffect(() => {
    const initAuth = async () => {
      // Check for error from OAuth redirect
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        const params = new URLSearchParams(searchParams.toString());
        params.delete('error');
        router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
        setIsInitializing(false);
        return;
      }

      // Check session endpoint — handles both OAuth (cookie) and PAT (.env.local) modes
      try {
        const sessionResponse = await fetch('/api/auth/session');
        const session = await sessionResponse.json();

        if (session.authenticated && session.accessToken) {
          setToken(session.accessToken);
          setUser(session.user);
          setIsAuthenticated(true);

          // Fetch first page of repositories via server-side endpoint
          try {
            const reposResponse = await fetch('/api/repos?page=1');
            if (!reposResponse.ok) throw new Error('Failed to fetch repositories');
            const { repos, hasMore } = await reposResponse.json();
            setRepositories(repos);
            setHasMoreRepos(hasMore);

            // Restore selected repos from URL
            const reposFromUrl = searchParams.get('repos');
            if (reposFromUrl) {
              try {
                const decodedRepos = JSON.parse(decodeURIComponent(reposFromUrl));
                const validRepos = decodedRepos.filter((repoName: string) =>
                  repos.some((repo: Repository) => repo.name === repoName)
                );
                setSelectedRepos(validRepos);
              } catch {
                setSelectedRepos([]);
              }
            }
          } catch (err) {
            console.error('Failed to fetch repositories:', err);
            setError('Failed to load repositories. Please try logging in again.');
          }

          setIsInitializing(false);
          return;
        }
      } catch (err) {
        console.error('Failed to check session:', err);
      }

      setIsInitializing(false);
    };

    initAuth();
  }, [searchParams, router, pathname]);

  // Handle successful authentication (from TokenAuth — triggers page reload so this is mainly a fallback)
  const handleAuthenticated = useCallback(async () => {
    // TokenAuth now saves to .env.local and reloads the page,
    // so initAuth will pick up the session on next load.
    window.location.reload();
  }, []);

  // Fetch commit data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !token || selectedRepos.length === 0) {
      setData({
        totalCommits: 0,
        aiCommits: 0,
        aiToolBreakdown: emptyToolBreakdown,
        claudeModelBreakdown: emptyModelBreakdown,
        activeUsers: 0,
        leaderboard: []
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const reposToFetch = repositories.filter(repo => selectedRepos.includes(repo.name));

      const result = await fetchCommitDataClient(
        token,
        reposToFetch,
        {
          start: new Date(dateRange.startDate),
          end: new Date(dateRange.endDate)
        },
        setProgressMessage
      );

      setData(result);
      setProgressMessage(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch commit data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, selectedRepos, isAuthenticated, token, repositories, emptyToolBreakdown, emptyModelBreakdown]);

  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  // Fetch data when dependencies change
  useEffect(() => {
    if (isAuthenticated && selectedRepos.length > 0) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, selectedRepos.length]);

  const handleLogout = useCallback(async () => {
    // Clear server-side session if using OAuth
    if (isOAuthAvailable) {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to clear server session:', err);
      }
    }

    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setRepositories([]);
    setSelectedRepos([]);
    setError(null);
  }, []);

  // Show loading while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <div className="max-w-md text-center">
              <p className="text-destructive mb-4">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show auth prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            {isOAuthAvailable ? (
              <OAuthLogin />
            ) : (
              <TokenAuth onAuthenticated={handleAuthenticated} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Header
          repositoryCount={repositories.length}
          onLogout={handleLogout}
          isAuthenticated={isAuthenticated}
          username={user?.login}
          avatarUrl={user?.avatar_url}
        />


        <DateRangeSelector
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onDateChange={handleDateChange}
          onRefresh={fetchData}
          isLoading={isLoading}
        />

        <RepositorySelector
          selectedRepos={selectedRepos}
          onRepoChange={handleRepoChange}
          availableRepos={repositories}
          hasMoreRepos={hasMoreRepos}
          onReposLoaded={(repos, hasMore) => {
            setRepositories(repos);
            setHasMoreRepos(hasMore);
          }}
        />

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {progressMessage && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-primary flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            {progressMessage}
          </div>
        )}

        <StatsCards
          totalCommits={data.totalCommits}
          aiCommits={data.aiCommits}
          aiToolBreakdown={data.aiToolBreakdown}
          claudeModelBreakdown={data.claudeModelBreakdown}
          activeUsers={data.activeUsers}
          isLoading={isLoading}
          hasSelectedRepos={selectedRepos.length > 0}
        />

        <Leaderboard
          data={data.leaderboard}
          isLoading={isLoading}
          hasSelectedRepos={selectedRepos.length > 0}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
