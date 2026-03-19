'use client';

import { useMemo, useState } from 'react';
import { Zap, Info, ChevronRight, ExternalLink, Calendar, TrendingUp, TrendingDown, Minus, BarChart3, GitPullRequest, ArrowUp, ArrowDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, floorToMonday, median, fmtNumber } from '@/lib/utils';
import type { PRMetricsRaw, PRCategory } from '@/lib/github-client';

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
  beforePrs: PRMetricsRaw[];
  afterPrs: PRMetricsRaw[];
  throughputChangePct: number;
  cycleTimeChangePct: number;
  prSizeChangePct: number;
  significance: 'improved' | 'no-change' | 'regressed';
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

function classifySignificance(boost: Omit<EngineerBoost, 'significance' | 'beforePrs' | 'afterPrs'>): 'improved' | 'no-change' | 'regressed' {
  // Scoring: throughput up is good, cycle time down is good
  // Significant if throughput improved >=20% OR cycle time decreased >=20%
  // Regressed if throughput decreased >=20% AND cycle time increased >=20%
  const throughputGood = boost.throughputChangePct >= 20;
  const cycleTimeGood = boost.cycleTimeChangePct <= -20;
  const throughputBad = boost.throughputChangePct <= -20;
  const cycleTimeBad = boost.cycleTimeChangePct >= 20;

  if (throughputGood || cycleTimeGood) return 'improved';
  if (throughputBad && cycleTimeBad) return 'regressed';
  return 'no-change';
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

  return (
    <td className="px-3 py-2 text-sm">
      <span className="text-muted-foreground">{fmtNumber(before)}</span>
      <span className="text-muted-foreground mx-1">→</span>
      <span>{fmtNumber(after)}</span>
      {unit && <span className="text-muted-foreground text-xs ml-0.5">{unit}</span>}
      <span className={cn('ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded-full', color)}>
        {changePct > 0 ? '+' : ''}{changePct}%
      </span>
    </td>
  );
}

function SignificanceBadge({ significance }: { significance: EngineerBoost['significance'] }) {
  switch (significance) {
    case 'improved':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 gap-1">
          <TrendingUp className="h-3 w-3" />
          Improved
        </Badge>
      );
    case 'regressed':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
          <TrendingDown className="h-3 w-3" />
          Regressed
        </Badge>
      );
    case 'no-change':
      return (
        <Badge className="bg-muted text-muted-foreground border-0 gap-1">
          <Minus className="h-3 w-3" />
          No Change
        </Badge>
      );
  }
}

const CATEGORY_COLORS: Record<PRCategory, string> = {
  'human': 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'ai-assisted': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'agent': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const CATEGORY_LABELS: Record<PRCategory, string> = {
  'human': 'Human',
  'ai-assisted': 'AI-Assisted',
  'agent': 'Agent',
};

const PRS_PER_PAGE = 20;

function EngineerBoostDetailSheet({
  boost,
  open,
  onOpenChange,
  rank,
}: {
  boost: EngineerBoost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rank: number;
}) {
  const [visibleBeforeCount, setVisibleBeforeCount] = useState(PRS_PER_PAGE);
  const [visibleAfterCount, setVisibleAfterCount] = useState(PRS_PER_PAGE);

  const weeklyChartData = useMemo(() => {
    if (!boost) return [];
    const allPrs = [...boost.beforePrs, ...boost.afterPrs];
    const byWeek = new Map<string, { total: number; ai: number }>();

    for (const pr of allPrs) {
      const week = floorToMonday(new Date(pr.mergedAt));
      const entry = byWeek.get(week) || { total: 0, ai: 0 };
      entry.total++;
      if (pr.category === 'ai-assisted' || pr.category === 'agent') entry.ai++;
      byWeek.set(week, entry);
    }

    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        total: data.total,
        ai: data.ai,
        human: data.total - data.ai,
      }));
  }, [boost]);

  const sortedBeforePrs = useMemo(() =>
    boost ? [...boost.beforePrs].sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()) : [],
    [boost]
  );
  const sortedAfterPrs = useMemo(() =>
    boost ? [...boost.afterPrs].sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()) : [],
    [boost]
  );

  if (!boost) return null;

  const adoptDate = new Date(boost.adoptionWeek + 'T00:00:00');
  const adoptLabel = adoptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const renderPRList = (
    prs: PRMetricsRaw[],
    visibleCount: number,
    setVisibleCount: React.Dispatch<React.SetStateAction<number>>,
  ) => (
    <div className="space-y-2">
      {prs.slice(0, visibleCount).map(pr => (
        <div key={`${pr.repo}#${pr.number}`} className="group flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-relaxed mb-2">
              {pr.title}
            </p>
            <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className={cn('text-xs', CATEGORY_COLORS[pr.category])}>
                {CATEGORY_LABELS[pr.category]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {pr.repo}
              </Badge>
              <span className="text-muted-foreground">
                +{pr.additions} −{pr.deletions}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(pr.mergedAt).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  const [owner, repo] = pr.repo.split('/');
                  if (owner && repo) window.open(`https://github.com/${owner}/${repo}/pull/${pr.number}`, '_blank');
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>
      ))}
      {visibleCount < prs.length && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount(prev => prev + PRS_PER_PAGE)}
        >
          Show More ({prs.length - visibleCount} remaining)
        </Button>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {boost.author}
                <SignificanceBadge significance={boost.significance} />
              </SheetTitle>
              <SheetDescription>AI adopted week of {adoptLabel}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-primary">{fmtNumber(boost.after.prsPerWeek)}</div>
            <div className="text-xs text-muted-foreground">PRs/wk (after)</div>
            <div className={cn('text-xs font-medium mt-1',
              boost.throughputChangePct > 0 ? 'text-green-600 dark:text-green-400' : boost.throughputChangePct < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            )}>
              {boost.throughputChangePct > 0 ? '+' : ''}{boost.throughputChangePct}%
            </div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{fmtNumber(boost.after.medianCycleTimeHours)}h</div>
            <div className="text-xs text-muted-foreground">Cycle Time (after)</div>
            <div className={cn('text-xs font-medium mt-1',
              boost.cycleTimeChangePct < 0 ? 'text-green-600 dark:text-green-400' : boost.cycleTimeChangePct > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
            )}>
              {boost.cycleTimeChangePct > 0 ? '+' : ''}{boost.cycleTimeChangePct}%
            </div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{fmtNumber(boost.after.medianPrSize)}</div>
            <div className="text-xs text-muted-foreground">PR Size (after)</div>
            <div className="text-xs font-medium mt-1 text-muted-foreground">
              {boost.prSizeChangePct > 0 ? '+' : ''}{boost.prSizeChangePct}%
            </div>
          </div>
        </div>

        {/* Before/After comparison */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3">Before vs After AI Adoption</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Before</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">PRs</span><span>{boost.before.prCount} over {boost.before.weekCount}wk</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PRs/wk</span><span>{fmtNumber(boost.before.prsPerWeek)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cycle</span><span>{fmtNumber(boost.before.medianCycleTimeHours)}h</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{fmtNumber(boost.before.medianPrSize)} loc</span></div>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="text-xs font-medium text-primary mb-2">After</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">PRs</span><span>{boost.after.prCount} over {boost.after.weekCount}wk</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PRs/wk</span><span>{fmtNumber(boost.after.prsPerWeek)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cycle</span><span>{fmtNumber(boost.after.medianCycleTimeHours)}h</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{fmtNumber(boost.after.medianPrSize)} loc</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly PR chart */}
        {weeklyChartData.length > 1 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Weekly PRs
            </h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RechartsTooltip
                    labelFormatter={(v) => {
                      if (typeof v === 'string') {
                        const d = new Date(v);
                        return `Week of ${d.toLocaleDateString()}`;
                      }
                      return String(v);
                    }}
                  />
                  <ReferenceLine
                    x={boost.adoptionWeek}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{ value: 'AI Adopted', position: 'top', fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total PRs"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.1}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="ai"
                    name="AI PRs"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-primary rounded" />
                <span>AI PRs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-muted-foreground rounded" style={{ borderTop: '1.5px dashed' }} />
                <span>Total PRs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 border-l-2 border-dashed border-primary h-3" />
                <span>Adoption</span>
              </div>
            </div>
          </div>
        )}

        {/* After PRs */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            After Adoption ({sortedAfterPrs.length} PRs)
          </h4>
          {renderPRList(sortedAfterPrs, visibleAfterCount, setVisibleAfterCount)}
        </div>

        {/* Before PRs */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            Before Adoption ({sortedBeforePrs.length} PRs)
          </h4>
          {renderPRList(sortedBeforePrs, visibleBeforeCount, setVisibleBeforeCount)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SortableHeader({
  label,
  col,
  activeCol,
  dir,
  onToggle,
}: {
  label: string;
  col: SortColumn;
  activeCol: SortColumn;
  dir: SortDirection;
  onToggle: (col: SortColumn) => void;
}) {
  const isActive = activeCol === col;
  return (
    <th
      className="px-3 py-2 font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onToggle(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </th>
  );
}

interface AIProductivityBoostCardProps {
  prs: PRMetricsRaw[];
}

type SortColumn = 'throughput' | 'cycleTime' | 'prSize';
type SortDirection = 'asc' | 'desc';

export function AIProductivityBoostCard({ prs }: AIProductivityBoostCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState<EngineerBoost | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>('throughput');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

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
      //    AND there's at least one prior week without majority AI (the "before" window)
      let adoptionWeek: string | null = null;
      let hasNonAIWeekBefore = false;
      for (let i = 0; i < sortedWeeks.length; i++) {
        const weekPrs = byWeek.get(sortedWeeks[i])!;
        const aiCount = weekPrs.filter(pr => pr.category === 'ai-assisted' || pr.category === 'agent').length;
        const isAIWeek = aiCount / weekPrs.length >= 0.5;
        if (!isAIWeek) {
          hasNonAIWeekBefore = true;
        } else if (hasNonAIWeekBefore) {
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

      const throughputChangePct = pctChange(before.prsPerWeek, after.prsPerWeek);
      const cycleTimeChangePct = pctChange(before.medianCycleTimeHours, after.medianCycleTimeHours);
      const prSizeChangePct = pctChange(before.medianPrSize, after.medianPrSize);

      const significance = classifySignificance({
        author,
        adoptionWeek,
        before,
        after,
        throughputChangePct,
        cycleTimeChangePct,
        prSizeChangePct,
      });

      results.push({
        author,
        adoptionWeek,
        before,
        after,
        beforePrs,
        afterPrs,
        throughputChangePct,
        cycleTimeChangePct,
        prSizeChangePct,
        significance,
      });
    }

    return results;
  }, [prs]);

  const sortedBoosts = useMemo(() => {
    const key = sortCol === 'throughput' ? 'throughputChangePct'
      : sortCol === 'cycleTime' ? 'cycleTimeChangePct'
      : 'prSizeChangePct';
    const mult = sortDir === 'desc' ? -1 : 1;
    return [...boosts].sort((a, b) => mult * (a[key] - b[key]));
  }, [boosts, sortCol, sortDir]);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  return (
    <>
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
                  Requires ≥5 PRs in both before and after windows. Click a row for details.
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
                    <SortableHeader label="PRs/wk" col="throughput" activeCol={sortCol} dir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Cycle Time" col="cycleTime" activeCol={sortCol} dir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="PR Size" col="prSize" activeCol={sortCol} dir={sortDir} onToggle={toggleSort} />
                    <th className="px-3 py-2 font-medium">Impact</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBoosts.map((b, i) => {
                    const adoptDate = new Date(b.adoptionWeek + 'T00:00:00');
                    const adoptLabel = adoptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                    return (
                      <tr
                        key={b.author}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedBoost(b)}
                      >
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
                        <td className="px-3 py-2">
                          <SignificanceBadge significance={b.significance} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EngineerBoostDetailSheet
        boost={selectedBoost}
        open={!!selectedBoost}
        onOpenChange={(open) => { if (!open) setSelectedBoost(null); }}
        rank={selectedBoost ? sortedBoosts.indexOf(selectedBoost) + 1 : 0}
      />
    </>
  );
}
