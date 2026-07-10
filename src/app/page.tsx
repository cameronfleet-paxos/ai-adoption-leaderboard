'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { OverallActivityChart } from '@/components/OverallActivityChart';
import { AnalyticsSection } from '@/components/AnalyticsSection';
import { ProductivitySection } from '@/components/ProductivitySection';
import { CodeReviewLeaderboard } from '@/components/CodeReviewLeaderboard';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { PRLabelConfig } from '@/components/PRLabelConfig';
import { CacheSettings, getDiskCacheEnabled } from '@/components/CacheSettings';
import { TokenAuth } from '@/components/TokenAuth';
import { OAuthLogin } from '@/components/OAuthLogin';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ToolFilter } from '@/lib/tool-filter';
import {
  type Repository,
  type AIToolBreakdown,
  type AITool,
  type ClaudeModelBreakdown,
  type ClaudeModel,
  type FetchProgress,
  type PRLabelConfig as PRLabelConfigType,
  type ProductivityMetrics,
  type ProductivityFetchProgress,
  type CachedDataInput,
  type CachedPRDetailInput,
  type CachedMergedPRInput,
  type ProductivityCacheInput,
  type CodeReviewMetrics,
  type CodeReviewFetchProgress,
  type CachedReviewInput,
  type CodeReviewCacheInput,
  fetchCommitDataClient,
  fetchProductivityMetrics,
  fetchCodeReviewMetrics,
  getDefaultPRLabelConfig,
} from '@/lib/github-client';

// Check if OAuth is available (client-side check)
const isOAuthAvailable = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

type Tab = 'overview' | 'leaderboard' | 'productivity' | 'code-reviews' | 'settings';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Repository state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);

  // Tab state from URL
  const activeTab = (searchParams.get('tab') as Tab) || 'overview';

  const setActiveTab = useCallback((tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Tool filter state (lifted from Leaderboard, now global in filter bar)
  const [toolFilter, setToolFilter] = useState<ToolFilter>('all');

  // Productivity metrics state
  const [productivityMetrics, setProductivityMetrics] = useState<ProductivityMetrics | null>(null);
  const [productivityProgress, setProductivityProgress] = useState<ProductivityFetchProgress | null>(null);
  const [productivityLoading, setProductivityLoading] = useState(false);
  const [productivityWasCapped, setProductivityWasCapped] = useState(false);

  // Code review metrics state
  const [codeReviewMetrics, setCodeReviewMetrics] = useState<CodeReviewMetrics | null>(null);
  const [codeReviewProgress, setCodeReviewProgress] = useState<CodeReviewFetchProgress | null>(null);
  const [codeReviewLoading, setCodeReviewLoading] = useState(false);

  const emptyToolBreakdown = useMemo<AIToolBreakdown>(() => ({
    'claude-coauthor': 0,
    'claude-generated': 0,
    'copilot': 0,
    'cursor': 0,
    'codex': 0,
    'gemini': 0,
    'agent': 0,
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
      allCommitDates: string[];
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

  // PR label config state with localStorage persistence
  const [labelConfig, setLabelConfig] = useState<PRLabelConfigType>(() => {
    if (typeof window === 'undefined') return getDefaultPRLabelConfig([]);
    try {
      const stored = localStorage.getItem('prLabelConfig');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return getDefaultPRLabelConfig([]);
  });

  const handleLabelConfigChange = useCallback((config: PRLabelConfigType) => {
    setLabelConfig(config);
    try {
      localStorage.setItem('prLabelConfig', JSON.stringify(config));
    } catch { /* ignore */ }
  }, []);

  // Prune stale repos from label scan config when selectedRepos changes
  useEffect(() => {
    const validScanRepos = labelConfig.labelScanRepos.filter(r => selectedRepos.includes(r));
    if (validScanRepos.length !== labelConfig.labelScanRepos.length) {
      handleLabelConfigChange({ ...labelConfig, labelScanRepos: validScanRepos });
    }
  }, [selectedRepos]); // eslint-disable-line react-hooks/exhaustive-deps

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

                // Init label scan repos if no stored config
                if (!localStorage.getItem('prLabelConfig') && validRepos.length > 0) {
                  const defaultConfig = getDefaultPRLabelConfig(validRepos);
                  setLabelConfig(defaultConfig);
                  localStorage.setItem('prLabelConfig', JSON.stringify(defaultConfig));
                }
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
      const repoKeys = reposToFetch.map(r => `${r.owner}/${r.name}`);
      const startISO = new Date(dateRange.startDate).toISOString();
      const endISO = new Date(dateRange.endDate).toISOString();

      // Read disk cache (if enabled)
      const cacheEnabled = getDiskCacheEnabled();
      let cachedData: CachedDataInput | undefined;
      if (cacheEnabled) {
        try {
          const cacheRes = await fetch(`/api/cache?repos=${repoKeys.join(',')}&start=${startISO}&end=${endISO}`);
          if (cacheRes.ok) {
            cachedData = await cacheRes.json();
          }
        } catch (e) {
          console.warn('Failed to read disk cache:', e);
        }
      }

      const result = await fetchCommitDataClient(
        token,
        reposToFetch,
        {
          start: new Date(dateRange.startDate),
          end: new Date(dateRange.endDate)
        },
        setProgress,
        labelConfig,
        cachedData,
      );

      setData(result);
      setProgress(null);

      // Write back to disk cache (fire-and-forget)
      const rawResult = result as typeof result & { _rawCommits?: Array<{ sha: string; repository: string; commit: { author: { name: string; email: string; date: string }; message: string }; author: { login: string; avatar_url: string } | null }>; _rawPRResults?: Array<{ sha: string; username: string; aiTool: string; repo: string; date: string }> };
      if (cacheEnabled && (rawResult._rawCommits || rawResult._rawPRResults)) {
        const commitsByRepo: Record<string, Array<{ sha: string; repository: string; authorLogin: string | null; authorAvatarUrl: string | null; authorName: string; authorEmail: string; authorDate: string; message: string }>> = {};
        const prLabelsByRepo: Record<string, Array<{ sha: string; username: string; aiTool: string; repo: string; date: string }>> = {};

        // Build displayName -> repoKey map for O(1) lookups
        const displayNameToRepoKey = new Map<string, string>();
        for (const r of reposToFetch) {
          displayNameToRepoKey.set(r.displayName, `${r.owner}/${r.name}`);
        }

        for (const c of rawResult._rawCommits || []) {
          const repoKey = displayNameToRepoKey.get(c.repository);
          if (!repoKey) continue;
          if (!commitsByRepo[repoKey]) commitsByRepo[repoKey] = [];
          commitsByRepo[repoKey].push({
            sha: c.sha,
            repository: c.repository,
            authorLogin: c.author?.login || null,
            authorAvatarUrl: c.author?.avatar_url || null,
            authorName: c.commit.author.name,
            authorEmail: c.commit.author.email,
            authorDate: c.commit.author.date,
            message: c.commit.message,
          });
        }

        for (const pr of rawResult._rawPRResults || []) {
          const repoKey = displayNameToRepoKey.get(pr.repo);
          if (!repoKey) continue;
          if (!prLabelsByRepo[repoKey]) prLabelsByRepo[repoKey] = [];
          prLabelsByRepo[repoKey].push(pr);
        }

        const coverageExpansions = repoKeys.map(k => [
          { repoKey: k, start: startISO, end: endISO, type: 'commits' as const },
          { repoKey: k, start: startISO, end: endISO, type: 'prLabels' as const },
        ]).flat();

        fetch('/api/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commits: commitsByRepo,
            prLabels: prLabelsByRepo,
            coverageExpansions,
          }),
        }).catch(e => console.warn('Failed to write disk cache:', e));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch commit data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, selectedRepos, isAuthenticated, token, repositories, emptyToolBreakdown, emptyModelBreakdown, labelConfig]);

  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  // Fetch data when dependencies change
  useEffect(() => {
    if (isAuthenticated && selectedRepos.length > 0) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, selectedRepos.length]);

  // Fetch productivity metrics when productivity tab is active
  const productivityEnabled = activeTab === 'productivity';

  useEffect(() => {
    if (!productivityEnabled || !token || !isAuthenticated || selectedRepos.length === 0 || data.totalCommits === 0 || isLoading) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setProductivityLoading(true);
      setProductivityMetrics(null);
      setProductivityWasCapped(false);

      try {
        const reposToFetch = repositories.filter(repo => selectedRepos.includes(repo.name));
        const repoKeys = reposToFetch.map(r => `${r.owner}/${r.name}`);

        // Build sets for categorization from existing leaderboard data
        const aiCommitSHAs = new Set<string>();
        const agentUsernames = new Set<string>();
        for (const entry of data.leaderboard) {
          if (entry.username.endsWith('-agent[bot]')) {
            agentUsernames.add(entry.username);
          }
          for (const commit of entry.commitDetails) {
            aiCommitSHAs.add(commit.sha);
          }
        }

        // Read cached productivity data (if cache enabled)
        const prodCacheEnabled = getDiskCacheEnabled();
        let cachedPRDetails: Map<string, CachedPRDetailInput> | undefined;
        let cachedProductivity: ProductivityCacheInput | undefined;
        if (prodCacheEnabled) {
          try {
            // Use lookback start for merged PR coverage (90 days before user's start)
            const lookbackStart = new Date(dateRange.startDate);
            lookbackStart.setDate(lookbackStart.getDate() - 90);
            const cacheRes = await fetch(`/api/cache?repos=${repoKeys.join(',')}&start=${lookbackStart.toISOString()}&end=${new Date(dateRange.endDate).toISOString()}&prDetailKeys=`);
            if (cacheRes.ok) {
              const cacheData = await cacheRes.json();
              if (cacheData.prDetails && Object.keys(cacheData.prDetails).length > 0) {
                cachedPRDetails = new Map(Object.entries(cacheData.prDetails) as [string, CachedPRDetailInput][]);
              }
              cachedProductivity = {
                prDetails: cachedPRDetails,
                mergedPRs: cacheData.mergedPRs as Record<string, CachedMergedPRInput[]>,
                coverage: cacheData.coverage as Record<string, { mergedPRs: { gaps: Array<{ start: string; end: string }> } }>,
              };
            }
          } catch (e) {
            console.warn('Failed to read productivity cache:', e);
          }
        }

        const result = await fetchProductivityMetrics(
          token,
          reposToFetch,
          { start: new Date(dateRange.startDate), end: new Date(dateRange.endDate) },
          aiCommitSHAs,
          agentUsernames,
          (p) => { if (!cancelled) setProductivityProgress(p); },
          cachedPRDetails,
          90,
          cachedProductivity,
        );

        if (!cancelled) {
          setProductivityMetrics(result);
          setProductivityProgress(null);
          setProductivityWasCapped(result.totalPRsAnalyzed >= 20000);

          // Write productivity data to disk cache (fire-and-forget)
          const rawResult = result as typeof result & {
            _newPRDetails?: Record<string, CachedPRDetailInput>;
            _rawMergedPRs?: Record<string, CachedMergedPRInput[]>;
          };
          if (prodCacheEnabled) {
            const cacheBody: Record<string, unknown> = {};
            if (rawResult._newPRDetails && Object.keys(rawResult._newPRDetails).length > 0) {
              cacheBody.prDetails = rawResult._newPRDetails;
            }
            if (rawResult._rawMergedPRs && Object.keys(rawResult._rawMergedPRs).length > 0) {
              cacheBody.mergedPRs = rawResult._rawMergedPRs;
              // Expand merged PR coverage for all repos
              const lookbackStart = new Date(dateRange.startDate);
              lookbackStart.setDate(lookbackStart.getDate() - 90);
              cacheBody.coverageExpansions = repoKeys.map(k => ({
                repoKey: k,
                start: lookbackStart.toISOString(),
                end: new Date(dateRange.endDate).toISOString(),
                type: 'mergedPRs',
              }));
            }
            if (Object.keys(cacheBody).length > 0) {
              fetch('/api/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cacheBody),
              }).catch(e => console.warn('Failed to write productivity cache:', e));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch productivity metrics:', err);
      } finally {
        if (!cancelled) {
          setProductivityLoading(false);
          setProductivityProgress(null);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [productivityEnabled, token, isAuthenticated, selectedRepos, repositories, data.totalCommits, data.leaderboard, dateRange.startDate, dateRange.endDate, isLoading]);

  // Fetch code review metrics when code-reviews tab is active
  const codeReviewEnabled = activeTab === 'code-reviews';

  useEffect(() => {
    if (!codeReviewEnabled || !token || !isAuthenticated || selectedRepos.length === 0) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setCodeReviewLoading(true);
      setCodeReviewMetrics(null);

      try {
        const reposToFetch = repositories.filter(repo => selectedRepos.includes(repo.name));
        const repoKeys = reposToFetch.map(r => `${r.owner}/${r.name}`);
        const startISO = new Date(dateRange.startDate).toISOString();
        const endISO = new Date(dateRange.endDate).toISOString();

        // Read cached data (merged PRs + review details)
        const cacheEnabled = getDiskCacheEnabled();
        let cachedReviewDetails: Map<string, CachedReviewInput[]> | undefined;
        let cachedCodeReviewData: CodeReviewCacheInput | undefined;
        if (cacheEnabled) {
          try {
            const cacheRes = await fetch(`/api/cache?repos=${repoKeys.join(',')}&start=${startISO}&end=${endISO}&reviewDetailKeys=`);
            if (cacheRes.ok) {
              const cacheData = await cacheRes.json();
              if (cacheData.reviewDetails && Object.keys(cacheData.reviewDetails).length > 0) {
                cachedReviewDetails = new Map(Object.entries(cacheData.reviewDetails) as [string, CachedReviewInput[]][]);
              }
              cachedCodeReviewData = {
                reviewDetails: cachedReviewDetails,
                mergedPRs: cacheData.mergedPRs as Record<string, CachedMergedPRInput[]>,
                coverage: cacheData.coverage as Record<string, { mergedPRs: { gaps: Array<{ start: string; end: string }> } }>,
              };
            }
          } catch (e) {
            console.warn('Failed to read review cache:', e);
          }
        }

        const result = await fetchCodeReviewMetrics(
          token,
          reposToFetch,
          { start: new Date(dateRange.startDate), end: new Date(dateRange.endDate) },
          (p) => { if (!cancelled) setCodeReviewProgress(p); },
          cachedReviewDetails,
          cachedCodeReviewData,
        );

        if (!cancelled) {
          setCodeReviewMetrics(result);
          setCodeReviewProgress(null);

          // Write new review details + merged PRs to cache (fire-and-forget)
          const rawResult = result as typeof result & {
            _newReviewDetails?: Record<string, CachedReviewInput[]>;
            _rawMergedPRs?: Record<string, CachedMergedPRInput[]>;
          };
          if (cacheEnabled) {
            const cacheBody: Record<string, unknown> = {};
            if (rawResult._newReviewDetails && Object.keys(rawResult._newReviewDetails).length > 0) {
              cacheBody.reviewDetails = rawResult._newReviewDetails;
            }
            if (rawResult._rawMergedPRs && Object.keys(rawResult._rawMergedPRs).length > 0) {
              cacheBody.mergedPRs = rawResult._rawMergedPRs;
              cacheBody.coverageExpansions = repoKeys.map(k => ({
                repoKey: k,
                start: startISO,
                end: endISO,
                type: 'mergedPRs',
              }));
            }
            if (Object.keys(cacheBody).length > 0) {
              fetch('/api/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cacheBody),
              }).catch(e => console.warn('Failed to write review cache:', e));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch code review metrics:', err);
      } finally {
        if (!cancelled) {
          setCodeReviewLoading(false);
          setCodeReviewProgress(null);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [codeReviewEnabled, token, isAuthenticated, selectedRepos, repositories, dateRange.startDate, dateRange.endDate]);

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

  const renderTabContent = () => {
    if (progress) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-full max-w-md space-y-6">
            {/* Big commit counter */}
            <div className="text-center">
              {progress.phase === 'counting' ? (
                <>
                  <div className="text-5xl font-bold tracking-tight tabular-nums text-muted-foreground/50">...</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Counting commits across {progress.totalRepos} {progress.totalRepos === 1 ? 'repo' : 'repos'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl font-bold tracking-tight tabular-nums">
                    {progress.commitsFetched.toLocaleString()}
                    {progress.totalCommitsEstimate != null && progress.phase === 'fetching' && (
                      <span className="text-2xl font-normal text-muted-foreground">
                        {' / '}{progress.totalCommitsEstimate.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {progress.phase === 'analyzing' ? 'commits being analyzed' : progress.phase === 'fetching-prs' ? 'Scanning PR labels for AI tool usage' : 'commits fetched'}
                  </div>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                {progress.phase === 'counting' || progress.phase === 'analyzing' || progress.phase === 'fetching-prs' ? (
                  <div className="h-full w-full progress-bar-shimmer rounded-full" />
                ) : progress.totalCommitsEstimate != null && progress.totalCommitsEstimate > 0 ? (
                  <div
                    className="h-full progress-bar-shimmer rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(2, (progress.commitsFetched / progress.totalCommitsEstimate) * 100)}%` }}
                  />
                ) : (
                  <div className="h-full w-full progress-bar-shimmer rounded-full" />
                )}
              </div>

              {/* Status text */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
                {progress.phase === 'counting' ? (
                  <span>Preparing...</span>
                ) : progress.phase === 'analyzing' ? (
                  <span>Scanning for AI-assisted commits...</span>
                ) : progress.phase === 'fetching-prs' ? (
                  <span>
                    {progress.activeRepos.length > 0 ? (
                      <span className="font-medium text-foreground">{progress.activeRepos[0]}</span>
                    ) : (
                      'Scanning PR labels for AI tools...'
                    )}
                  </span>
                ) : (
                  <span>
                    Fetching from {progress.activeRepos.map((name, i) => (
                      <span key={name}>
                        {i > 0 && ', '}
                        <span className="font-medium text-foreground">{name}</span>
                      </span>
                    ))}
                    {progress.totalRepos > 1 && (
                      <span className="text-muted-foreground"> ({progress.completedRepos}/{progress.totalRepos} done)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <>
            <StatsCards
              totalCommits={data.totalCommits}
              aiCommits={data.aiCommits}
              aiToolBreakdown={data.aiToolBreakdown}
              claudeModelBreakdown={data.claudeModelBreakdown}
              activeUsers={data.activeUsers}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            <OverallActivityChart
              leaderboard={data.leaderboard}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            <AnalyticsSection
              aiToolBreakdown={data.aiToolBreakdown}
              claudeModelBreakdown={data.claudeModelBreakdown}
              totalAICommits={data.aiCommits}
              leaderboard={data.leaderboard}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />
          </>
        );

      case 'leaderboard':
        return (
          <Leaderboard
            data={data.leaderboard}
            isLoading={isLoading}
            hasSelectedRepos={selectedRepos.length > 0}
            toolFilter={toolFilter}
          />
        );

      case 'productivity':
        return (
          <ProductivitySection
            metrics={productivityMetrics}
            isLoading={productivityLoading && !productivityProgress}
            hasSelectedRepos={selectedRepos.length > 0}
            progress={productivityProgress}
            wasCapped={productivityWasCapped}
          />
        );

      case 'code-reviews':
        return (
          <CodeReviewLeaderboard
            metrics={codeReviewMetrics}
            isLoading={codeReviewLoading && !codeReviewProgress}
            hasSelectedRepos={selectedRepos.length > 0}
            progress={codeReviewProgress}
          />
        );

      case 'settings':
        return (
          <>
          <CacheSettings />
          <PRLabelConfig
            labelConfig={labelConfig}
            onLabelConfigChange={handleLabelConfigChange}
            selectedRepos={selectedRepos}
          />
          </>
        );
    }
  };

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

        <FilterBar
          selectedRepos={selectedRepos}
          onRepoChange={handleRepoChange}
          availableRepos={repositories}
          hasMoreRepos={hasMoreRepos}
          onReposLoaded={(repos, hasMore) => {
            setRepositories(repos);
            setHasMoreRepos(hasMore);
          }}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onDateChange={handleDateChange}
          toolFilter={toolFilter}
          onToolFilterChange={setToolFilter}
          leaderboardData={data.leaderboard}
          onRefresh={fetchData}
          isLoading={isLoading}
        />

        <div className="mb-6">
          <TabsList>
            <TabsTrigger active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              Overview
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')}>
              Leaderboard
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'productivity'} onClick={() => setActiveTab('productivity')}>
              Productivity
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'code-reviews'} onClick={() => setActiveTab('code-reviews')}>
              Code Reviews
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {renderTabContent()}
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
