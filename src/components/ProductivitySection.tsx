'use client';

import { useState, useEffect } from 'react';
import { BarChart3, BoxSelect, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProductivityComparisonChart } from '@/components/ProductivityComparisonChart';
import { ProductivityStatsCards } from '@/components/ProductivityStatsCards';
import { ProductivityTrendsCard } from '@/components/ProductivityTrendsCard';
import { AIProductivityBoostCard } from '@/components/AIProductivityBoostCard';
import type { ProductivityMetrics, ProductivityFetchProgress } from '@/lib/github-client';

const STORAGE_KEY = 'productivity-section-prefs';

type ViewMode = 'bar' | 'boxplot';

interface Prefs {
  viewMode: ViewMode;
}

const DEFAULT_PREFS: Prefs = {
  viewMode: 'boxplot',
};

interface ProductivitySectionProps {
  metrics: ProductivityMetrics | null;
  isLoading: boolean;
  hasSelectedRepos: boolean;
  progress: ProductivityFetchProgress | null;
  wasCapped?: boolean;
}

export function ProductivitySection({
  metrics,
  isLoading,
  hasSelectedRepos,
  progress,
  wasCapped = false,
}: ProductivitySectionProps) {
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

  if (isLoading || progress) {
    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-xl">Productivity</CardTitle>
        </CardHeader>
        <CardContent>
          {progress ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
              <p className="text-sm text-muted-foreground">
                {progress.phase === 'listing-prs' && (
                  <>
                    Scanning merged PRs...
                    {progress.completedPRs > 0 && <span className="font-medium text-foreground"> {progress.completedPRs} found</span>}
                    {progress.totalRepos && progress.totalRepos > 1 && (
                      <span className="text-muted-foreground"> ({progress.completedRepos || 0}/{progress.totalRepos} repos)</span>
                    )}
                  </>
                )}
                {progress.phase === 'fetching-details' && (
                  <>
                    Fetching PR details... <span className="font-medium text-foreground">{progress.completedPRs}/{progress.totalPRs}</span>
                  </>
                )}
                {progress.phase === 'computing' && 'Computing metrics...'}
              </p>
              {progress.activeRepos && progress.activeRepos.length > 0 && progress.phase === 'listing-prs' && (
                <p className="text-xs text-muted-foreground">
                  {progress.activeRepos.map((name, i) => (
                    <span key={name}>
                      {i > 0 && ', '}
                      <span className="font-medium text-foreground">{name}</span>
                    </span>
                  ))}
                </p>
              )}
              {(progress.phase === 'fetching-details' || progress.phase === 'listing-prs') && (
                <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                  {progress.phase === 'fetching-details' && progress.totalPRs > 0 ? (
                    <div
                      className="h-full progress-bar-shimmer rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(2, (progress.completedPRs / progress.totalPRs) * 100)}%` }}
                    />
                  ) : progress.phase === 'listing-prs' && progress.totalRepos && progress.totalRepos > 0 ? (
                    <div
                      className="h-full progress-bar-shimmer rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(2, ((progress.completedRepos || 0) / progress.totalRepos) * 100)}%` }}
                    />
                  ) : (
                    <div className="h-full w-full progress-bar-shimmer rounded-full" />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-pulse">
              <div className="h-72 bg-muted rounded" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!hasSelectedRepos) {
    return (
      <Card className="mb-8 opacity-60">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Productivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Select repositories to view productivity metrics
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalPRsAnalyzed === 0) {
    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-xl">Productivity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            No merged PRs found in the selected timeframe
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ProductivityTrendsCard prs={metrics.prs} />
      <AIProductivityBoostCard prs={metrics.prs} />
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Human vs AI Comparison</CardTitle>
              <span className="text-sm text-muted-foreground ml-2">
                {metrics.human.prCount} human / {metrics.aiAssisted.prCount} AI-assisted / {metrics.agent.prCount} agent PRs
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => updatePrefs({ viewMode: 'bar' })}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                  prefs.viewMode === 'bar'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <BarChart3 className="h-3 w-3" />
                Bar
              </button>
              <button
                onClick={() => updatePrefs({ viewMode: 'boxplot' })}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                  prefs.viewMode === 'boxplot'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <BoxSelect className="h-3 w-3" />
                Box Plot
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
              {wasCapped && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  Analysis capped at 3,000 most recent PRs. Narrow the date range for complete results.
                </div>
              )}

              <ProductivityStatsCards metrics={metrics} prs={metrics.prs} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProductivityComparisonChart
                  title="Cycle Time"
                  unit="hours"
                  human={metrics.human.cycleTime}
                  aiAssisted={metrics.aiAssisted.cycleTime}
                  agent={metrics.agent.cycleTime}
                  viewMode={prefs.viewMode}
                  tooltip="Hours from first commit authored date to PR merge date. Bar = median (P50). Box plot shows P10–P90 with IQR."
                />
                <ProductivityComparisonChart
                  title="PR Size"
                  unit="lines"
                  human={metrics.human.prSize}
                  aiAssisted={metrics.aiAssisted.prSize}
                  agent={metrics.agent.prSize}
                  viewMode={prefs.viewMode}
                  tooltip="Total lines changed per PR (additions + deletions). Bar = median (P50). Box plot shows P10–P90 with IQR."
                />
                <ProductivityComparisonChart
                  title="Review Rounds"
                  unit="rounds"
                  human={metrics.human.reviewRounds}
                  aiAssisted={metrics.aiAssisted.reviewRounds}
                  agent={metrics.agent.reviewRounds}
                  viewMode={prefs.viewMode}
                  tooltip="Count of APPROVED or CHANGES_REQUESTED reviews per PR (excluding bots and dismissed reviews). Bar = median (P50)."
                />
                <ProductivityComparisonChart
                  title="Review Comments"
                  unit="comments"
                  human={metrics.human.reviewComments}
                  aiAssisted={metrics.aiAssisted.reviewComments}
                  agent={metrics.agent.reviewComments}
                  viewMode={prefs.viewMode}
                  tooltip="Total individual review comments per PR (summed across all review threads, including bot comments). Bar = median (P50)."
                />
              </div>

              <div className="mt-6 max-w-lg mx-auto">
                <ProductivityComparisonChart
                  title="Revert Rate"
                  unit="%"
                  human={{ p10: 0, p25: 0, median: metrics.human.revertRate, p75: 0, p90: 0 }}
                  aiAssisted={{ p10: 0, p25: 0, median: metrics.aiAssisted.revertRate, p75: 0, p90: 0 }}
                  agent={{ p10: 0, p25: 0, median: metrics.agent.revertRate, p75: 0, p90: 0 }}
                  isPercentage
                  tooltip={'Percentage of PRs that are reverts within each bucket. A PR is a revert if its title matches Revert "..." or its body contains "This reverts commit".'}
                />
              </div>
            </CardContent>
      </Card>
    </>
  );
}
