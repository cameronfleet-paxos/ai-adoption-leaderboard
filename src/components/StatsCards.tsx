interface StatsCardsProps {
  totalCommits: number;
  claudeCommits: number;
  activeUsers: number;
  isLoading?: boolean;
  hasSelectedRepos?: boolean;
}

export function StatsCards({ totalCommits, claudeCommits, activeUsers, isLoading = false, hasSelectedRepos = true }: StatsCardsProps) {
  const adoptionRate = totalCommits > 0 ? Math.round((claudeCommits / totalCommits) * 100) : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!hasSelectedRepos) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm opacity-50">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {['Total Commits', 'Claude Co-authored', 'Active Users', 'Adoption Rate'][i]}
            </h3>
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">-</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Commits</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCommits}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Claude Co-authored</h3>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{claudeCommits}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Users</h3>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeUsers}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Adoption Rate</h3>
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{adoptionRate}%</p>
      </div>
    </div>
  );
}