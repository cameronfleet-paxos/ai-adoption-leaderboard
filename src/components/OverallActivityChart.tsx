'use client';

import { useMemo, useState, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AITool, ClaudeModel } from '@/lib/github-client';

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  url: string;
  repository: string;
  aiTool: AITool;
  claudeModel?: ClaudeModel;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  commits: number;
  totalCommits: number;
  aiPercentage: number;
  avatar: string;
  commitDetails: CommitDetail[];
  allCommitDates: string[];
}

interface OverallActivityChartProps {
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  hasSelectedRepos: boolean;
}

export function OverallActivityChart({ leaderboard, isLoading, hasSelectedRepos }: OverallActivityChartProps) {
  const chartData = useMemo(() => {
    if (leaderboard.length === 0) return [];

    const aiByDay: Record<string, number> = {};
    const totalByDay: Record<string, number> = {};
    const agentByDay: Record<string, number> = {};

    for (const entry of leaderboard) {
      const isAgent = entry.username.endsWith('-agent[bot]');
      for (const commit of entry.commitDetails) {
        const day = new Date(commit.date).toISOString().split('T')[0];
        aiByDay[day] = (aiByDay[day] || 0) + 1;
      }
      for (const dateStr of (entry.allCommitDates || [])) {
        const day = new Date(dateStr).toISOString().split('T')[0];
        totalByDay[day] = (totalByDay[day] || 0) + 1;
        if (isAgent) {
          agentByDay[day] = (agentByDay[day] || 0) + 1;
        }
      }
    }

    const allDays = new Set([...Object.keys(aiByDay), ...Object.keys(totalByDay), ...Object.keys(agentByDay)]);
    const sortedDays = Array.from(allDays).sort();
    if (sortedDays.length === 0) return [];

    const result: { date: string; aiCommits: number; totalCommits: number; agentCommits: number }[] = [];
    const start = new Date(sortedDays[0]);
    const end = new Date(sortedDays[sortedDays.length - 1]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      result.push({
        date: key,
        aiCommits: aiByDay[key] || 0,
        totalCommits: totalByDay[key] || 0,
        agentCommits: agentByDay[key] || 0,
      });
    }

    const WINDOW = 7;
    const withTrend = result.map((day, i) => {
      let windowAi = 0, windowTotal = 0;
      const start = Math.max(0, i - WINDOW + 1);
      for (let j = start; j <= i; j++) {
        windowAi += result[j].aiCommits;
        windowTotal += result[j].totalCommits;
      }
      return {
        ...day,
        adoptionPct: windowTotal > 0 ? Math.round((windowAi / windowTotal) * 100 * 10) / 10 : null,
      };
    });
    return withTrend;
  }, [leaderboard]);

  type SeriesKey = 'aiCommits' | 'agentCommits' | 'totalCommits' | 'adoptionPct';

  const SERIES: { key: SeriesKey; label: string; axis: 'left' | 'right' }[] = [
    { key: 'aiCommits', label: 'AI Commits', axis: 'left' },
    { key: 'agentCommits', label: 'Agent Commits', axis: 'left' },
    { key: 'totalCommits', label: 'All Commits', axis: 'left' },
    { key: 'adoptionPct', label: 'Adoption % (7d avg)', axis: 'right' },
  ];

  const [hiddenSeries, setHiddenSeries] = useState<Set<SeriesKey>>(new Set());

  const toggleSeries = useCallback((key: SeriesKey) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding all series
        if (next.size >= SERIES.length - 1) return prev;
        next.add(key);
      }
      return next;
    });
  }, []);

  const isVisible = (key: SeriesKey) => !hiddenSeries.has(key);

  if (isLoading) {
    return (
      <Card className="mb-8 animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 bg-muted rounded w-32"></div>
          <div className="h-4 w-4 bg-muted rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-72 bg-muted rounded"></div>
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
            Commit Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            Select repositories to view commit activity
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length <= 1) return null;

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <BarChart3 className="h-4 w-4" />
        <CardTitle className="text-sm font-medium">Commit Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                labelFormatter={(v) => typeof v === 'string' ? new Date(v).toLocaleDateString() : String(v)}
                formatter={(value, name) => {
                  if (name === 'Adoption % (7d avg)') return value != null ? [`${value}%`, name] : ['-', name];
                  return [value, name];
                }}
              />
              {isVisible('totalCommits') && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalCommits"
                  name="All Commits"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              )}
              {isVisible('aiCommits') && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="aiCommits"
                  name="AI Commits"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {isVisible('agentCommits') && (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="agentCommits"
                  name="Agent Commits"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              )}
              {isVisible('adoptionPct') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="adoptionPct"
                  name="Adoption % (7d avg)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <button
            onClick={() => toggleSeries('aiCommits')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenSeries.has('aiCommits') ? 'opacity-30 line-through' : ''}`}
          >
            <div className="w-4 h-0.5 bg-primary rounded" />
            <span>AI Commits</span>
          </button>
          <button
            onClick={() => toggleSeries('agentCommits')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenSeries.has('agentCommits') ? 'opacity-30 line-through' : ''}`}
          >
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
            <span>Agent Commits</span>
          </button>
          <button
            onClick={() => toggleSeries('totalCommits')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenSeries.has('totalCommits') ? 'opacity-30 line-through' : ''}`}
          >
            <div className="w-4 h-0.5 bg-muted-foreground rounded" style={{ borderTop: '1.5px dashed' }} />
            <span>All Commits</span>
          </button>
          <button
            onClick={() => toggleSeries('adoptionPct')}
            className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${hiddenSeries.has('adoptionPct') ? 'opacity-30 line-through' : ''}`}
          >
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
            <span>Adoption % (7d avg)</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
