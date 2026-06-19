'use client';

import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, Layers, Split, ZoomIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, floorToMonday } from '@/lib/utils';
import { TrendLineChart, type TrendPoint, type TrendViewMode } from '@/components/TrendLineChart';
import type { PRMetricsRaw } from '@/lib/github-client';

const TRENDS_PREFS_KEY = 'trends-card-prefs';

function floorToMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatWeekLabel(bucket: string): string {
  const d = new Date(bucket + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthLabel(bucket: string): string {
  const [y, m] = bucket.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('en-US', { month: 'short' }) + ' \'' + y.slice(2);
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type Category = 'human' | 'ai-assisted' | 'agent';

interface BucketAccum {
  counts: Record<Category, number>;
  authors: Record<Category, Set<string>>;
  cycleTimes: Record<Category, number[]>;
  prSizes: Record<Category, number[]>;
  totalCount: number;
  allAuthors: Set<string>;
  allCycleTimes: number[];
  allPrSizes: number[];
}

function emptyAccum(): BucketAccum {
  return {
    counts: { human: 0, 'ai-assisted': 0, agent: 0 },
    authors: { human: new Set(), 'ai-assisted': new Set(), agent: new Set() },
    cycleTimes: { human: [], 'ai-assisted': [], agent: [] },
    prSizes: { human: [], 'ai-assisted': [], agent: [] },
    totalCount: 0,
    allAuthors: new Set(),
    allCycleTimes: [],
    allPrSizes: [],
  };
}

interface ProductivityTrendsCardProps {
  prs: PRMetricsRaw[];
}

export function ProductivityTrendsCard({ prs }: ProductivityTrendsCardProps) {
  const [viewMode, setViewMode] = useState<TrendViewMode>('combined');
  const [excludeZero, setExcludeZero] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(TRENDS_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.viewMode === 'split' || parsed.viewMode === 'combined') {
          setViewMode(parsed.viewMode);
        }
        if (typeof parsed.excludeZero === 'boolean') {
          setExcludeZero(parsed.excludeZero);
        }
      }
    } catch {}
  }, []);

  const updateViewMode = (mode: TrendViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(TRENDS_PREFS_KEY, JSON.stringify({ viewMode: mode, excludeZero })); } catch {}
  };

  const toggleExcludeZero = () => {
    const next = !excludeZero;
    setExcludeZero(next);
    try { localStorage.setItem(TRENDS_PREFS_KEY, JSON.stringify({ viewMode, excludeZero: next })); } catch {}
  };

  const { volume, throughput, cycleTime, prSize, hasSufficientData } = useMemo(() => {
    if (prs.length === 0) return { volume: [], throughput: [], cycleTime: [], prSize: [], hasSufficientData: false };

    // Determine bucket type: weekly if range <= 90 days
    const dates = prs.map(pr => new Date(pr.mergedAt).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const rangeDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    const useWeekly = rangeDays <= 90;

    const getBucket = useWeekly ? (d: Date) => floorToMonday(d) : (d: Date) => floorToMonth(d);
    const getLabel = useWeekly ? formatWeekLabel : formatMonthLabel;

    // Accumulate per bucket
    const buckets = new Map<string, BucketAccum>();
    for (const pr of prs) {
      const d = new Date(pr.mergedAt);
      const key = getBucket(d);
      if (!buckets.has(key)) buckets.set(key, emptyAccum());
      const b = buckets.get(key)!;
      const cat = pr.category;

      b.counts[cat]++;
      b.authors[cat].add(pr.author);
      b.totalCount++;
      b.allAuthors.add(pr.author);

      const first = new Date(pr.firstCommitDate).getTime();
      const merged = d.getTime();
      const ct = Math.max(0, (merged - first) / (1000 * 60 * 60));
      const sz = pr.additions + pr.deletions;
      b.cycleTimes[cat].push(ct);
      b.prSizes[cat].push(sz);
      b.allCycleTimes.push(ct);
      b.allPrSizes.push(sz);
    }

    const sortedKeys = [...buckets.keys()].sort();
    if (sortedKeys.length < 2) return { volume: [], throughput: [], cycleTime: [], prSize: [], hasSufficientData: false };

    const toPoint = (key: string, getValue: (cat: Category, b: BucketAccum) => number | null, getCombined: (b: BucketAccum) => number | null): TrendPoint => ({
      bucket: key,
      label: getLabel(key),
      human: getValue('human', buckets.get(key)!),
      aiAssisted: getValue('ai-assisted', buckets.get(key)!),
      agent: getValue('agent', buckets.get(key)!),
      combined: getCombined(buckets.get(key)!),
    });

    const volumeData = sortedKeys.map(k => toPoint(k, (cat, b) => b.counts[cat] || null, b => b.totalCount || null));
    // For PRs/dev, exclude infrequent contributors (< 2 PRs in the period)
    // Count PRs per author across all buckets
    const authorPRCounts = new Map<string, number>();
    for (const pr of prs) {
      authorPRCounts.set(pr.author, (authorPRCounts.get(pr.author) || 0) + 1);
    }
    const activeAuthors = new Set([...authorPRCounts.entries()].filter(([, count]) => count >= 2).map(([author]) => author));

    const throughputData = sortedKeys.map(k => toPoint(k, (cat, b) => {
      const authors = [...b.authors[cat]].filter(a => activeAuthors.has(a)).length;
      return authors > 0 ? Math.round((b.counts[cat] / authors) * 10) / 10 : null;
    }, b => {
      const authors = [...b.allAuthors].filter(a => activeAuthors.has(a)).length;
      return authors > 0 ? Math.round((b.totalCount / authors) * 10) / 10 : null;
    }));
    const cycleTimeData = sortedKeys.map(k => toPoint(k, (cat, b) => median(b.cycleTimes[cat]), b => median(b.allCycleTimes)));
    const prSizeData = sortedKeys.map(k => toPoint(k, (cat, b) => median(b.prSizes[cat]), b => median(b.allPrSizes)));

    return { volume: volumeData, throughput: throughputData, cycleTime: cycleTimeData, prSize: prSizeData, hasSufficientData: true };
  }, [prs]);

  if (!hasSufficientData) {
    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-xl">Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Not enough data for trends
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-xl">Trends</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleExcludeZero}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors border',
                excludeZero
                  ? 'bg-background border-border shadow-sm text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              title="Fit y-axis to data (exclude zero)"
            >
              <ZoomIn className="h-3 w-3" />
              Fit axis
            </button>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => updateViewMode('combined')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                  viewMode === 'combined'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers className="h-3 w-3" />
                Combined
              </button>
              <button
                onClick={() => updateViewMode('split')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                  viewMode === 'split'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Split className="h-3 w-3" />
                By Type
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendLineChart
            data={volume}
            title="PR Volume Over Time"
            unit="PRs"
            tooltip="Number of merged PRs per time bucket, broken down by category."
            viewMode={viewMode}
            excludeZero={excludeZero}
          />
          <TrendLineChart
            data={throughput}
            title="PRs Per Developer"
            unit="PRs/dev"
            tooltip="Merged PRs divided by unique authors in each time bucket. Measures individual throughput."
            viewMode={viewMode}
            excludeZero={excludeZero}
          />
          <TrendLineChart
            data={cycleTime}
            title="Cycle Time Over Time"
            unit="hours"
            tooltip="Median cycle time (first commit to merge) per time bucket."
            viewMode={viewMode}
            excludeZero={excludeZero}
          />
          <TrendLineChart
            data={prSize}
            title="PR Size Over Time"
            unit="lines"
            tooltip="Median PR size (additions + deletions) per time bucket."
            viewMode={viewMode}
            excludeZero={excludeZero}
          />
        </div>
      </CardContent>
    </Card>
  );
}
