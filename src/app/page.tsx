'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { Header } from '@/components/Header';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { RepositorySelector } from '@/components/RepositorySelector';
import { Repository } from '@/lib/github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [data, setData] = useState({
    totalCommits: 0,
    claudeCommits: 0,
    activeUsers: 0,
    leaderboard: [] as Array<{
      rank: number;
      username: string;
      commits: number;
      totalCommits: number;
      claudePercentage: number;
      avatar: string;
      commitDetails: Array<{
        sha: string;
        message: string;
        date: string;
        url: string;
        repository: string;
      }>;
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
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

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

  // Fetch session data on component mount
  useEffect(() => {
    const errorParam = searchParams.get('error');
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    // Fetch session data from API
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/session');
        const sessionData = await response.json();
        
        if (sessionData.isAuthenticated) {
          setInstallationId(sessionData.installationId);
          setRepositories(sessionData.repositories);
          
          // Get selected repos from URL or default to empty
          const reposFromUrl = searchParams.get('repos');
          if (reposFromUrl) {
            try {
              const decodedRepos = JSON.parse(decodeURIComponent(reposFromUrl));
              const validRepos = decodedRepos.filter((repoName: string) => 
                sessionData.repositories.some((repo: Repository) => repo.name === repoName)
              );
              setSelectedRepos(validRepos);
            } catch (error) {
              console.error('Failed to parse repos from URL:', error);
              setSelectedRepos([]);
            }
          } else {
            setSelectedRepos([]);
          }
          
          setIsAuthenticated(true);
          setError(null);
        } else {
          setIsAuthenticated(false);
          setInstallationId(null);
          setRepositories([]);
          setSelectedRepos([]);
        }
      } catch (error) {
        console.error('Failed to fetch session data:', error);
        setError('Failed to load authentication state');
      }
    };
    
    fetchSession();
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !installationId || selectedRepos.length === 0) {
      setData({
        totalCommits: 0,
        claudeCommits: 0,
        activeUsers: 0,
        leaderboard: []
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Filter repositories based on selection
      const reposToFetch = repositories.filter(repo => selectedRepos.includes(repo.name));
      
      const response = await fetch('/api/commits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          repositories: reposToFetch
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch commit data');
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch commit data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, selectedRepos, isAuthenticated, installationId, repositories]);
  
  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated]);

  const handleConnect = () => {
    window.location.href = '/api/github/auth';
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/session', { method: 'DELETE' });
      setIsAuthenticated(false);
      setInstallationId(null);
      setRepositories([]);
      setSelectedRepos([]);
      setError(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Remove unused handler - keeping for potential future use
  // const handleReconnect = () => {
  //   // Clear current state and redirect to auth
  //   setIsAuthenticated(false);
  //   setInstallationId(null);
  //   setRepositories([]);
  //   setSelectedRepos([]);
  //   setError(null);
  //   window.location.href = '/api/github/auth';
  // };

  const handleAddOrganizations = () => {
    // Redirect to installation flow (keeps existing state)
    window.location.href = '/api/github/install';
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="text-destructive">Setup Error</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={handleConnect} className="w-full">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show connection prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <Card className="max-w-lg">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <CardTitle className="text-2xl">Connect GitHub</CardTitle>
                <CardDescription className="text-base">
                  Install the AI Adoption Leaderboard app to analyze Claude co-authored commits across your repositories.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button onClick={handleConnect} size="lg" className="w-full">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Install & Connect GitHub App
                </Button>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll select which repositories to grant access to during installation
                  </p>
                </div>
              </CardContent>
            </Card>
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
          onManageSettings={() => window.open('https://github.com/settings/installations', '_blank')}
          onAddOrganizations={handleAddOrganizations}
          onLogout={handleLogout}
          isAuthenticated={isAuthenticated}
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
        />

        <StatsCards 
          totalCommits={data.totalCommits}
          claudeCommits={data.claudeCommits}
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
