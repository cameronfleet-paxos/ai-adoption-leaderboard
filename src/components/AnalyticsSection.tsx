'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIToolDistributionChart } from '@/components/AIToolDistributionChart';
import { AdoptionCohortChart } from '@/components/AdoptionCohortChart';
import type { AIToolBreakdown, ClaudeModelBreakdown, LeaderboardEntry } from '@/lib/github-client';

interface AnalyticsSectionProps {
  aiToolBreakdown: AIToolBreakdown;
  claudeModelBreakdown: ClaudeModelBreakdown;
  totalAICommits: number;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  hasSelectedRepos: boolean;
}

export function AnalyticsSection({
  aiToolBreakdown,
  claudeModelBreakdown,
  totalAICommits,
  leaderboard,
  isLoading,
  hasSelectedRepos,
}: AnalyticsSectionProps) {
  if (isLoading) {
    return (
      <Card className="mb-8 animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-4 w-4 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-72 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!hasSelectedRepos) {
    return (
      <Card className="mb-8 opacity-60">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Select repositories to view analytics
          </div>
        </CardContent>
      </Card>
    );
  }

  const allCommitDetails = useMemo(
    () => leaderboard.flatMap(entry => entry.commitDetails),
    [leaderboard]
  );

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIToolDistributionChart
            aiToolBreakdown={aiToolBreakdown}
            totalAICommits={totalAICommits}
            claudeModelBreakdown={claudeModelBreakdown}
            commitDetails={allCommitDetails}
          />
          <AdoptionCohortChart leaderboard={leaderboard} />
        </div>
      </CardContent>
    </Card>
  );
}
