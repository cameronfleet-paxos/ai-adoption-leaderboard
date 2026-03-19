'use client';

import { useMemo, useState } from 'react';
import { Zap, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PRMetricsRaw } from '@/lib/github-client';

function floorToMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface WindowStats {
  prCount: number;
  weekCount: number;
  prsPerWeek: number;
  medianCycleTimeHours: number;
  medianPrSize: number;
}

interface EngineerBoost {
  author: string;
  adoptionWeek: string;
  before: WindowStats;
  after: WindowStats;
  throughputChangePct: number;
  cycleTimeChangePct: number;
  prSizeChangePct: number;
}

function computeWindowStats(prs: PRMetricsRaw[]): WindowStats {
  const weeks = new Set(prs.map(pr => floorToMonday(new Date(pr.mergedAt))));
  const prCount = prs.length;
  const weekCount = weeks.size;
  const prsPerWeek = weekCount > 0 ? prCount / weekCount : 0;
  const cycleTimes = prs.map(pr => {
    const first = new Date(pr.firstCommitDate).getTime();
    const merged = new Date(pr.mergedAt).getTime();
    return Math.max(0, (merged - first) / (1000 * 60 * 60));
  });
  return {
    prCount,
    weekCount,
    prsPerWeek: Math.round(prsPerWeek * 10) / 10,
    medianCycleTimeHours: Math.round(median(cycleTimes) * 10) / 10,
    medianPrSize: Math.round(median(prs.map(pr => pr.additions + pr.deletions))),
  };
}

function pctChange(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

function MetricCell({
  before,
  after,
  changePct,
  unit,
  invertColor,
}: {
  before: number;
  after: number;
  changePct: number;
  unit?: string;
  invertColor?: boolean;
}) {
  const isPositiveChange = changePct > 0;
  const isGood = invertColor ? !isPositiveChange : isPositiveChange;
  const color = changePct === 0
    ? 'text-muted-foreground bg-muted'
    : isGood
      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';

  const fmt = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 100) return Math.round(v).toString();
    return v % 1 === 0 ? v.toString() : v.toFixed(1);
  };

  return (
    <td className="px-3 py-2 text-sm">
      <span className="text-muted-foreground">{fmt(before)}</span>
      <span className="text-muted-foreground mx-1">→</span>
      <span>{fmt(after)}</span>
      {unit && <span className="text-muted-foreground text-xs ml-0.5">{unit}</span>}
      <span className={cn('ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded-full', color)}>
        {changePct > 0 ? '+' : ''}{changePct}%
      </span>
    </td>
  );
}

interface AIProductivityBoostCardProps {
  prs: PRMetricsRaw[];
}

export function AIProductivityBoostCard({ prs }: AIProductivityBoostCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const boosts = useMemo(() => {
    // 1. Group PRs by author
    const byAuthor = new Map<string, PRMetricsRaw[]>();
    for (const pr of prs) {
      if (!byAuthor.has(pr.author)) byAuthor.set(pr.author, []);
      byAuthor.get(pr.author)!.push(pr);
    }

    const results: EngineerBoost[] = [];

    for (const [author, authorPrs] of byAuthor) {
      // 2. Bucket by week
      const byWeek = new Map<string, PRMetricsRaw[]>();
      for (const pr of authorPrs) {
        const week = floorToMonday(new Date(pr.mergedAt));
        if (!byWeek.has(week)) byWeek.set(week, []);
        byWeek.get(week)!.push(pr);
      }

      const sortedWeeks = [...byWeek.keys()].sort();

      // 3. Find adoption week: first where >=50% AI-assisted or agent
      let adoptionWeek: string | null = null;
      for (let i = 0; i < sortedWeeks.length; i++) {
        const weekPrs = byWeek.get(sortedWeeks[i])!;
        const aiCount = weekPrs.filter(pr => pr.category === 'ai-assisted' || pr.category === 'agent').length;
        if (aiCount / weekPrs.length >= 0.5) {
          if (i === 0) break; // no "before" window
          adoptionWeek = sortedWeeks[i];
          break;
        }
      }

      if (!adoptionWeek) continue;

      // 4. Split PRs
      const beforePrs = authorPrs.filter(pr => pr.mergedAt < adoptionWeek!);
      const afterPrs = authorPrs.filter(pr => pr.mergedAt >= adoptionWeek!);

      // 5. Require >=5 PRs in each window
      if (beforePrs.length < 5 || afterPrs.length < 5) continue;

      // 6. Compute stats
      const before = computeWindowStats(beforePrs);
      const after = computeWindowStats(afterPrs);

      results.push({
        author,
        adoptionWeek,
        before,
        after,
        throughputChangePct: pctChange(before.prsPerWeek, after.prsPerWeek),
        cycleTimeChangePct: pctChange(before.medianCycleTimeHours, after.medianCycleTimeHours),
        prSizeChangePct: pctChange(before.medianPrSize, after.medianPrSize),
      });
    }

    // 7. Sort by throughput change descending
    results.sort((a, b) => b.throughputChangePct - a.throughputChangePct);
    return results;
  }, [prs]);

  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-xl">AI Productivity Boost</CardTitle>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute left-0 top-6 z-50 w-72 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                Shows engineers with the biggest productivity change after adopting AI tools.
                Adoption = first week where ≥50% of merged PRs are AI-assisted or agent.
                Requires ≥5 PRs in both before and after windows.
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {boosts.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Not enough data to compute adoption boost
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">Engineer</th>
                  <th className="px-3 py-2 font-medium">Adopted</th>
                  <th className="px-3 py-2 font-medium">PRs/wk</th>
                  <th className="px-3 py-2 font-medium">Cycle Time</th>
                  <th className="px-3 py-2 font-medium">PR Size</th>
                </tr>
              </thead>
              <tbody>
                {boosts.map((b, i) => {
                  const adoptDate = new Date(b.adoptionWeek + 'T00:00:00');
                  const adoptLabel = adoptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                  return (
                    <tr key={b.author} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium">{b.author}</td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">{adoptLabel}</td>
                      <MetricCell
                        before={b.before.prsPerWeek}
                        after={b.after.prsPerWeek}
                        changePct={b.throughputChangePct}
                      />
                      <MetricCell
                        before={b.before.medianCycleTimeHours}
                        after={b.after.medianCycleTimeHours}
                        changePct={b.cycleTimeChangePct}
                        unit="h"
                        invertColor
                      />
                      <MetricCell
                        before={b.before.medianPrSize}
                        after={b.after.medianPrSize}
                        changePct={b.prSizeChangePct}
                        unit="loc"
                      />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
