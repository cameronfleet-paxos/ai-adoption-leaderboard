'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { AIToolDistributionChart } from '@/components/AIToolDistributionChart';
import { AdoptionCohortChart } from '@/components/AdoptionCohortChart';
import type { AIToolBreakdown, LeaderboardEntry } from '@/lib/github-client';

const STORAGE_KEY = 'analytics-section-prefs';

interface Prefs {
  sectionOpen: boolean;
}

const DEFAULT_PREFS: Prefs = {
  sectionOpen: true,
};

interface AnalyticsSectionProps {
  aiToolBreakdown: AIToolBreakdown;
  totalAICommits: number;
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  hasSelectedRepos: boolean;
}

export function AnalyticsSection({
  aiToolBreakdown,
  totalAICommits,
  leaderboard,
  isLoading,
  hasSelectedRepos,
}: AnalyticsSectionProps) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      }
    } catch {}
  }, []);

  const updatePrefs = (update: Partial<Prefs>) => {
    const next = { ...prefs, ...update };
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

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

  return (
    <Card className="mb-8">
      <Collapsible open={prefs.sectionOpen} onOpenChange={(open) => updatePrefs({ sectionOpen: open })}>
        <CardHeader className="pb-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform duration-200',
                  !prefs.sectionOpen && '-rotate-90'
                )}
              />
              <CardTitle className="text-xl">Analytics</CardTitle>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIToolDistributionChart
                aiToolBreakdown={aiToolBreakdown}
                totalAICommits={totalAICommits}
              />
              <AdoptionCohortChart leaderboard={leaderboard} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
