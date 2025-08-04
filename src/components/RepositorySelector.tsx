import { Repository } from '@/lib/github';
import { useState, useMemo } from 'react';
import { Search, X, Check, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">Repository Selection</CardTitle>
            {selectedRepos.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedRepos.length} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedRepos.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              <Check className="h-4 w-4 mr-1" />
              {filteredRepos.every(repo => selectedRepos.includes(repo.name)) ? 'Deselect Visible' : 'Select Visible'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Repository list */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-medium text-lg mb-2">No repositories found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery ? (
                  <>No repositories match &quot;{searchQuery}&quot;. Try a different search term.</>
                ) : (
                  'No repositories available. Please install the GitHub App on your repositories.'
                )}
              </p>
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = selectedRepos.includes(repo.name);
              return (
                <div
                  key={repo.name}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
                    isSelected 
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleRepoToggle(repo.name)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleRepoToggle(repo.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{repo.displayName}</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {repo.owner}/{repo.name}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {selectedRepos.length === 0 && filteredRepos.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Select repositories to view commit data and leaderboard
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}