'use client';

import { useMemo } from 'react';
import { GitPullRequest, Clock, FileCode, AlertTriangle, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ProductivityMetrics, PRMetricsRaw } from '@/lib/github-client';

interface TrendBadge {
  label: string;
  current: number;
  change: number | null; // null = insufficient data
}

function computeTrends(prs: PRMetricsRaw[]): TrendBadge[] {
  if (prs.length === 0) return [];

  // Find the latest mergedAt date as rangeEnd
  const rangeEnd = prs.reduce((latest, pr) => {
    const d = new Date(pr.mergedAt).getTime();
    return d > latest ? d : latest;
  }, 0);

  const windows = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
  ];

  return windows.map(({ label, days }) => {
    const windowMs = days * 24 * 60 * 60 * 1000;
    const currentStart = rangeEnd - windowMs;
    const previousStart = currentStart - windowMs;

    const current = prs.filter(pr => {
      const t = new Date(pr.mergedAt).getTime();
      return t > currentStart && t <= rangeEnd;
    }).length;

    const previous = prs.filter(pr => {
      const t = new Date(pr.mergedAt).getTime();
      return t > previousStart && t <= currentStart;
    }).length;

    // If no PRs in the previous window, we can't compute a meaningful change
    if (previous === 0) {
      return { label, current, change: current > 0 ? null : null };
    }

    const change = Math.round(((current - previous) / previous) * 100);
    return { label, current, change };
  });
}

interface ProductivityStatsCardsProps {
  metrics: ProductivityMetrics;
  prs: PRMetricsRaw[];
}

export function ProductivityStatsCards({ metrics, prs }: ProductivityStatsCardsProps) {
  const trends = useMemo(() => computeTrends(prs), [prs]);

  // Compute overall medians across all buckets
  const allCycleTimes = [metrics.human, metrics.aiAssisted, metrics.agent]
    .filter(b => b.prCount > 0)
    .map(b => b.cycleTime.median);
  const overallCycleTime = allCycleTimes.length > 0
    ? allCycleTimes.reduce((a, b) => a + b, 0) / allCycleTimes.length
    : 0;

  const allSizes = [metrics.human, metrics.aiAssisted, metrics.agent]
    .filter(b => b.prCount > 0)
    .map(b => b.prSize.median);
  const overallSize = allSizes.length > 0
    ? allSizes.reduce((a, b) => a + b, 0) / allSizes.length
    : 0;

  const totalPRs = metrics.human.prCount + metrics.aiAssisted.prCount + metrics.agent.prCount;
  const totalReverts = [metrics.human, metrics.aiAssisted, metrics.agent]
    .reduce((sum, b) => sum + Math.round(b.revertRate * b.prCount / 100), 0);
  const overallRevertRate = totalPRs > 0 ? Math.round((totalReverts / totalPRs) * 1000) / 10 : 0;

  function formatCycleTime(hours: number): string {
    if (hours >= 48) return `${(hours / 24).toFixed(1)}d`;
    return `${hours.toFixed(1)}h`;
  }

  const stats = [
    {
      title: 'PRs Analyzed',
      value: metrics.totalPRsAnalyzed.toLocaleString(),
      icon: GitPullRequest,
      description: 'Count of merged PRs in the selected date range across all selected repositories.',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
      showTrends: true,
      trendTooltip: 'PR count in the last N days vs the previous N days (relative to the most recent PR merge date). % change = ((current − previous) / previous) × 100.',
    },
    {
      title: 'Median Cycle Time',
      value: formatCycleTime(overallCycleTime),
      icon: Clock,
      description: 'Average of per-bucket median cycle times (Human, AI-Assisted, Agent). Cycle time = hours from first commit authored date to PR merge date.',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/10',
      showTrends: false,
    },
    {
      title: 'Median PR Size',
      value: overallSize >= 1000 ? `${(overallSize / 1000).toFixed(1)}K` : Math.round(overallSize).toLocaleString(),
      icon: FileCode,
      description: 'Average of per-bucket median PR sizes. PR size = additions + deletions (total lines changed).',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/10',
      showTrends: false,
    },
    {
      title: 'Revert Rate',
      value: `${overallRevertRate}%`,
      icon: AlertTriangle,
      description: 'Total revert PRs / total PRs × 100. A PR is a revert if its title matches "Revert \\"...\\"" or its body contains "This reverts commit".',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/10',
      showTrends: false,
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      {stat.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <IconComponent className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.showTrends && trends.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-wrap gap-2 mt-2 cursor-help">
                        {trends.map((trend) => (
                          <span
                            key={trend.label}
                            className="inline-flex items-center gap-0.5 text-xs font-medium"
                          >
                            <span className="text-muted-foreground">{trend.label}:</span>
                            <span className="font-semibold">{trend.current}</span>
                            {trend.change !== null ? (
                              <span
                                className={cn(
                                  'inline-flex items-center',
                                  trend.change > 0 && 'text-green-600 dark:text-green-400',
                                  trend.change < 0 && 'text-red-600 dark:text-red-400',
                                  trend.change === 0 && 'text-muted-foreground',
                                )}
                              >
                                {trend.change > 0 && <ArrowUp className="h-3 w-3" />}
                                {trend.change < 0 && <ArrowDown className="h-3 w-3" />}
                                {trend.change !== 0 ? `${Math.abs(trend.change)}%` : '—'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {stat.trendTooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
