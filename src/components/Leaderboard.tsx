import { useState } from 'react';

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  url: string;
  repository: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  commits: number;
  totalCommits: number;
  claudePercentage: number;
  avatar: string;
  commitDetails: CommitDetail[];
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
}

export function Leaderboard({ data, isLoading }: LeaderboardProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
  const toggleUser = (username: string) => {
    setExpandedUser(expandedUser === username ? null : username);
  };
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Leaderboard</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Leaderboard</h2>
      <div className="space-y-4">
        {data.map((entry) => (
          <div key={entry.username} className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <div 
              className="flex items-center space-x-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              onClick={() => toggleUser(entry.username)}
            >
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                  entry.rank === 1 ? 'bg-yellow-500' : 
                  entry.rank === 2 ? 'bg-gray-400' : 
                  entry.rank === 3 ? 'bg-amber-600' : 
                  'bg-blue-500'
                }`}>
                  {entry.rank}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 dark:text-white">{entry.username}</span>
                  {entry.rank <= 3 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                      Top {entry.rank}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {entry.commits} of {entry.totalCommits} commits with Claude ({entry.claudePercentage}%)
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{entry.commits}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{entry.claudePercentage}%</div>
                </div>
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedUser === entry.username ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {expandedUser === entry.username && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <div className="mt-4 space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Recent Commits</h4>
                  {entry.commitDetails.length > 0 ? (
                    entry.commitDetails.map((commit) => (
                      <div 
                        key={commit.sha} 
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => window.open(commit.url, '_blank')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              {commit.message}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{commit.sha.substring(0, 7)}</span>
                              <span>•</span>
                              <span>{new Date(commit.date).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                                {commit.repository}
                              </span>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No commit details available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}