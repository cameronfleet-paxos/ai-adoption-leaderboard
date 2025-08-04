import { Repository } from '@/lib/github';
import { useState, useMemo } from 'react';

interface RepositorySelectorProps {
  selectedRepos: string[];
  onRepoChange: (selectedRepos: string[]) => void;
  availableRepos: Repository[];
}

export function RepositorySelector({ selectedRepos, onRepoChange, availableRepos }: RepositorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return availableRepos;
    
    const query = searchQuery.toLowerCase();
    return availableRepos.filter(repo => 
      repo.name.toLowerCase().includes(query) ||
      repo.displayName.toLowerCase().includes(query) ||
      repo.owner.toLowerCase().includes(query)
    );
  }, [availableRepos, searchQuery]);

  const handleRepoToggle = (repoName: string) => {
    if (selectedRepos.includes(repoName)) {
      onRepoChange(selectedRepos.filter(repo => repo !== repoName));
    } else {
      onRepoChange([...selectedRepos, repoName]);
    }
  };

  const handleSelectAll = () => {
    const visibleRepoNames = filteredRepos.map(repo => repo.name);
    const allVisibleSelected = visibleRepoNames.every(name => selectedRepos.includes(name));
    
    if (allVisibleSelected) {
      // Deselect all visible repos
      onRepoChange(selectedRepos.filter(name => !visibleRepoNames.includes(name)));
    } else {
      // Select all visible repos (merge with existing selection)
      const newSelection = [...new Set([...selectedRepos, ...visibleRepoNames])];
      onRepoChange(newSelection);
    }
  };

  const handleClearAll = () => {
    onRepoChange([]);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Repositories ({selectedRepos.length} selected)
        </h3>
        <div className="flex gap-2">
          {selectedRepos.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
            >
              Clear All
            </button>
          )}
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            {filteredRepos.every(repo => selectedRepos.includes(repo.name)) ? 'Deselect Visible' : 'Select Visible'}
          </button>
        </div>
      </div>
      
      {/* Search input */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredRepos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No repositories found matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          filteredRepos.map((repo) => (
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
          ))
        )}
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