import { Repository } from '@/lib/github';

interface RepositorySelectorProps {
  selectedRepos: string[];
  onRepoChange: (selectedRepos: string[]) => void;
  availableRepos: Repository[];
}

export function RepositorySelector({ selectedRepos, onRepoChange, availableRepos }: RepositorySelectorProps) {
  const handleRepoToggle = (repoName: string) => {
    if (selectedRepos.includes(repoName)) {
      onRepoChange(selectedRepos.filter(repo => repo !== repoName));
    } else {
      onRepoChange([...selectedRepos, repoName]);
    }
  };

  const handleSelectAll = () => {
    if (selectedRepos.length === availableRepos.length) {
      onRepoChange([]);
    } else {
      onRepoChange(availableRepos.map(repo => repo.name));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Repositories
        </h3>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          {selectedRepos.length === availableRepos.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      <div className="space-y-3">
        {availableRepos.map((repo) => (
          <label
            key={repo.name}
            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedRepos.includes(repo.name)}
              onChange={() => handleRepoToggle(repo.name)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {repo.displayName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {repo.owner}/{repo.name}
              </div>
            </div>
          </label>
        ))}
      </div>
      
      {selectedRepos.length === 0 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please select at least one repository to view data.
          </p>
        </div>
      )}
    </div>
  );
}