'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, RefreshCw, Filter, GitBranch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AI_TOOLS, type AITool, type AIToolBreakdown } from '@/lib/github-client';
import { RepositorySelector } from '@/components/RepositorySelector';
import type { Repository } from '@/lib/github-client';
import type { ToolFilter } from '@/lib/tool-filter';

interface FilterBarProps {
  // Repo state
  selectedRepos: string[];
  onRepoChange: (repos: string[]) => void;
  availableRepos: Repository[];
  hasMoreRepos: boolean;
  onReposLoaded: (repos: Repository[], hasMore: boolean) => void;
  // Date state
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  // Tool filter
  toolFilter: ToolFilter;
  onToolFilterChange: (filter: ToolFilter) => void;
  leaderboardData: Array<{ aiToolBreakdown: AIToolBreakdown; username: string }>;
  // Refresh
  onRefresh: () => void;
  isLoading: boolean;
}

const CLAUDE_TOOLS: AITool[] = ['claude-coauthor', 'claude-generated'];

export function FilterBar({
  selectedRepos,
  onRepoChange,
  availableRepos,
  hasMoreRepos,
  onReposLoaded,
  startDate,
  endDate,
  onDateChange,
  toolFilter,
  onToolFilterChange,
  leaderboardData,
  onRefresh,
  isLoading,
}: FilterBarProps) {
  const [repoSheetOpen, setRepoSheetOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('week');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);

  // Close custom date popover on outside click
  useEffect(() => {
    if (!showCustomDates) return;
    const handler = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setShowCustomDates(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCustomDates]);

  const handlePresetSelect = (preset: string) => {
    setActivePreset(preset);
    setShowCustomDates(false);
    const end = new Date();
    const start = new Date();
    end.setDate(end.getDate() + 1);

    switch (preset) {
      case 'week':
        start.setDate(start.getDate() - 6);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        start.setDate(start.getDate() + 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        start.setDate(start.getDate() + 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        start.setDate(start.getDate() + 1);
        break;
    }

    onDateChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  // Tool filter logic
  const hasClaudeData = useMemo(() => {
    return CLAUDE_TOOLS.some(tool =>
      leaderboardData.some(entry => entry.aiToolBreakdown[tool] > 0)
    );
  }, [leaderboardData]);

  const activeNonClaudeTools = useMemo(() => {
    return (Object.keys(AI_TOOLS) as AITool[]).filter(tool =>
      tool !== 'agent' && !CLAUDE_TOOLS.includes(tool) && leaderboardData.some(entry => entry.aiToolBreakdown[tool] > 0)
    );
  }, [leaderboardData]);

  const hasAgentUsers = useMemo(() => {
    return leaderboardData.some(entry => entry.username.endsWith('-agent[bot]') || entry.aiToolBreakdown['agent'] > 0);
  }, [leaderboardData]);

  const activeFilterCount = (hasClaudeData ? 1 : 0) + activeNonClaudeTools.length + (hasAgentUsers ? 1 : 0);

  const presets = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'year', label: 'Year' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b mb-6 -mx-4 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Repo selector button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRepoSheetOpen(true)}
          className="gap-1.5"
        >
          <GitBranch className="h-3.5 w-3.5" />
          {selectedRepos.length > 0 ? (
            <>
              {selectedRepos.length} {selectedRepos.length === 1 ? 'repo' : 'repos'}
            </>
          ) : (
            'Select repos'
          )}
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Date presets */}
        <div className="flex items-center gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.key}
              variant={activePreset === preset.key && !showCustomDates ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetSelect(preset.key)}
              className="text-xs h-7 px-2.5"
            >
              {preset.label}
            </Button>
          ))}
          <div className="relative" ref={customRef}>
            <Button
              variant={activePreset === 'custom' || showCustomDates ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCustomDates(!showCustomDates)}
              className="text-xs h-7 px-2.5 gap-1"
            >
              <Calendar className="h-3 w-3" />
              Custom
            </Button>
            {showCustomDates && (
              <div className="absolute top-full mt-2 left-0 bg-background border rounded-lg shadow-lg p-3 z-50 min-w-[280px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground w-10">From</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setActivePreset('custom');
                        onDateChange(e.target.value, endDate);
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground w-10">To</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setActivePreset('custom');
                        onDateChange(startDate, e.target.value);
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        {(activeFilterCount > 1 || hasAgentUsers) && (
          <>
            <div className="h-5 w-px bg-border" />

            {/* Tool filter */}
            <div className="flex items-center gap-1">
              <Button
                variant={toolFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolFilterChange('all')}
                className="text-xs h-7 px-2.5"
              >
                All
              </Button>
              {hasClaudeData && (
                <Button
                  variant={toolFilter === 'claude' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToolFilterChange('claude')}
                  className="text-xs h-7 px-2.5 gap-1.5"
                >
                  <div className={cn('w-2 h-2 rounded-full', AI_TOOLS['claude-coauthor'].color)} />
                  Claude
                </Button>
              )}
              {activeNonClaudeTools.map(tool => (
                <Button
                  key={tool}
                  variant={toolFilter === tool ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToolFilterChange(tool)}
                  className="text-xs h-7 px-2.5 gap-1.5"
                >
                  <div className={cn('w-2 h-2 rounded-full', AI_TOOLS[tool].color)} />
                  {AI_TOOLS[tool].label}
                </Button>
              ))}
              {hasAgentUsers && (
                <Button
                  variant={toolFilter === 'agents' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToolFilterChange('agents')}
                  className="text-xs h-7 px-2.5 gap-1.5"
                >
                  <div className={cn('w-2 h-2 rounded-full', 'bg-orange-500')} />
                  Agents
                </Button>
              )}
            </div>
          </>
        )}

        {/* Refresh button */}
        <div className="ml-auto">
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-7"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Repo Sheet */}
      <Sheet open={repoSheetOpen} onOpenChange={setRepoSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Select Repositories</SheetTitle>
            <SheetDescription>
              Choose repositories to analyze
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <RepositorySelector
              selectedRepos={selectedRepos}
              onRepoChange={onRepoChange}
              availableRepos={availableRepos}
              hasMoreRepos={hasMoreRepos}
              onReposLoaded={onReposLoaded}
              embedded
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
