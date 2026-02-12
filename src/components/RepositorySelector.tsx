import { Repository } from '@/lib/github-client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check, GitBranch, Loader2, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface RepositorySelectorProps {
  selectedRepos: string[];
  onRepoChange: (selectedRepos: string[]) => void;
  availableRepos: Repository[];
  hasMoreRepos: boolean;
  onReposLoaded: (repos: Repository[], hasMore: boolean) => void;
}

export function RepositorySelector({
  selectedRepos,
  onRepoChange,
  availableRepos,
  hasMoreRepos,
  onReposLoaded,
}: RepositorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Repository[] | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [isOpen, setIsOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The repos to display: search results when searching, otherwise the initial loaded repos
  const displayedRepos = searchResults ?? availableRepos;
  const displayedHasMore = searchResults ? searchHasMore : hasMoreRepos;

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      setSearchHasMore(false);
      setSearchPage(1);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/repos?search=${encodeURIComponent(query)}&page=1`
        );
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setSearchResults(data.repos);
        setSearchHasMore(data.hasMore);
        setSearchPage(1);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const query = searchQuery.trim();
      if (query) {
        // Load more search results
        const nextPage = searchPage + 1;
        const response = await fetch(
          `/api/repos?search=${encodeURIComponent(query)}&page=${nextPage}`
        );
        if (!response.ok) throw new Error('Failed to load more');
        const data = await response.json();
        setSearchResults((prev) => [...(prev ?? []), ...data.repos]);
        setSearchHasMore(data.hasMore);
        setSearchPage(nextPage);
      } else {
        // Load more browse results
        const nextPage = browsePage + 1;
        const response = await fetch(`/api/repos?page=${nextPage}`);
        if (!response.ok) throw new Error('Failed to load more');
        const data = await response.json();
        onReposLoaded([...availableRepos, ...data.repos], data.hasMore);
        setBrowsePage(nextPage);
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [searchQuery, searchPage, browsePage, availableRepos, onReposLoaded]);

  const handleRepoToggle = (repoName: string) => {
    if (selectedRepos.includes(repoName)) {
      onRepoChange(selectedRepos.filter((repo) => repo !== repoName));
    } else {
      onRepoChange([...selectedRepos, repoName]);
    }
  };

  const handleSelectAll = () => {
    const visibleRepoNames = displayedRepos.map((repo) => repo.name);
    const allVisibleSelected = visibleRepoNames.every((name) =>
      selectedRepos.includes(name)
    );

    if (allVisibleSelected) {
      onRepoChange(
        selectedRepos.filter((name) => !visibleRepoNames.includes(name))
      );
    } else {
      const newSelection = [
        ...new Set([...selectedRepos, ...visibleRepoNames]),
      ];
      onRepoChange(newSelection);
    }
  };

  const handleClearAll = () => {
    onRepoChange([]);
  };

  return (
    <Card className="mb-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform duration-200',
                      !isOpen && '-rotate-90'
                    )}
                  />
                  <CardTitle className="text-xl">Repository Selection</CardTitle>
                </button>
              </CollapsibleTrigger>
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
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                <Check className="h-4 w-4 mr-1" />
                {displayedRepos.every((repo) =>
                  selectedRepos.includes(repo.name)
                )
                  ? 'Deselect Visible'
                  : 'Select Visible'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search all repositories..."
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

            {/* Repository grid */}
            <div className="max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Searching...
                  </span>
                </div>
              ) : displayedRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <h3 className="font-medium text-lg mb-2">
                    No repositories found
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {searchQuery ? (
                      <>
                        No repositories match &quot;{searchQuery}&quot;. Try a
                        different search term.
                      </>
                    ) : (
                      'No repositories available.'
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {displayedRepos.map((repo) => {
                      const isSelected = selectedRepos.includes(repo.name);
                      return (
                        <div
                          key={repo.displayName}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer min-w-0',
                            isSelected
                              ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => handleRepoToggle(repo.name)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleRepoToggle(repo.name)}
                            className="flex-shrink-0"
                          />
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {repo.displayName}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More button */}
                  {displayedHasMore && (
                    <div className="pt-2 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedRepos.length === 0 && displayedRepos.length > 0 && (
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
