'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { Header } from '@/components/Header';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { RepositorySelector } from '@/components/RepositorySelector';
import { Repository } from '@/lib/github';

function HomeContent() {
  const searchParams = useSearchParams();
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

  // Parse URL parameters on component mount
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const installationParam = searchParams.get('installation_id');
    const repositoriesParam = searchParams.get('repositories');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (installationParam && repositoriesParam) {
      try {
        const parsedRepos: Repository[] = JSON.parse(repositoriesParam);
        setInstallationId(parseInt(installationParam));
        setRepositories(parsedRepos);
        setSelectedRepos(parsedRepos.map(repo => repo.name));
        setIsAuthenticated(true);
        setError(null);
      } catch (error) {
        console.error('Failed to parse repository data:', error);
        setError('Failed to process authorization data');
      }
    }
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
          repositories: reposToFetch,
          installationId
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Header />
          <div className="text-center py-12">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Setup Error</h2>
              <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
              <button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show connection prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Header />
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Setup GitHub Access
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Install the AI Adoption Leaderboard app on your repositories to analyze Claude co-authored commits.
              </p>
              <button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors"
              >
                Install & Connect GitHub App
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                You&apos;ll be able to select which repositories to grant access to during the installation process.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <Header />
        
        {/* Connected repositories info */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                GitHub App installed on {repositories.length} repositories
              </h3>
              <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                {repositories.map(repo => repo.displayName).join(', ')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open('https://github.com/settings/installations', '_blank')}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
              >
                Manage Settings
              </button>
              <button
                onClick={handleAddOrganizations}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
              >
                Add Organizations
              </button>
            </div>
          </div>
        </div>
        
        <DateRangeSelector
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onDateChange={handleDateChange}
          onRefresh={fetchData}
          isLoading={isLoading}
        />

        <RepositorySelector
          selectedRepos={selectedRepos}
          onRepoChange={setSelectedRepos}
          availableRepos={repositories}
        />

        <StatsCards 
          totalCommits={data.totalCommits}
          claudeCommits={data.claudeCommits}
          activeUsers={data.activeUsers}
          isLoading={isLoading}
        />

        <Leaderboard 
          data={data.leaderboard}
          isLoading={isLoading}
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
