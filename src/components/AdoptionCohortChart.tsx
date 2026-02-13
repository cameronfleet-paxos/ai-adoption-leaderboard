'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { LeaderboardEntry } from '@/lib/github-client';

const BANDS = ['76-100%', '51-75%', '26-50%', '1-25%', '0%'] as const;
type Band = (typeof BANDS)[number];

const BAND_COLORS: Record<Band, string> = {
  '0%': 'hsl(var(--muted-foreground))',
  '1-25%': 'hsl(var(--chart-5))',
  '26-50%': 'hsl(var(--chart-4))',
  '51-75%': 'hsl(var(--chart-2))',
  '76-100%': 'hsl(var(--chart-1))',
};

// Render order: bottom to top (0% at bottom, 76-100% at top)
const RENDER_ORDER: Band[] = ['0%', '1-25%', '26-50%', '51-75%', '76-100%'];

interface AdoptionCohortChartProps {
  leaderboard: LeaderboardEntry[];
}

export function AdoptionCohortChart({ leaderboard }: AdoptionCohortChartProps) {
  const chartData = useMemo(() => {
    if (leaderboard.length === 0) return [];

    // Build per-user per-day commit counts
    const userDayAll = new Map<number, Map<string, number>>();
    const userDayAi = new Map<number, Map<string, number>>();
    const daySet = new Set<string>();

    leaderboard.forEach((entry, u) => {
      const allMap = new Map<string, number>();
      for (const d of entry.allCommitDates) {
        const day = new Date(d).toISOString().split('T')[0];
        allMap.set(day, (allMap.get(day) || 0) + 1);
        daySet.add(day);
      }
      userDayAll.set(u, allMap);

      const aiMap = new Map<string, number>();
      for (const c of entry.commitDetails) {
        const day = new Date(c.date).toISOString().split('T')[0];
        aiMap.set(day, (aiMap.get(day) || 0) + 1);
      }
      userDayAi.set(u, aiMap);
    });

    const sortedDays = Array.from(daySet).sort();
    if (sortedDays.length === 0) return [];

    // Fill gaps between first and last day
    const allDays: string[] = [];
    const start = new Date(sortedDays[0]);
    const end = new Date(sortedDays[sortedDays.length - 1]);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDays.push(d.toISOString().split('T')[0]);
    }

    // Use a rolling window: for each day, look at commits in the last 7 days per user
    const WINDOW = 7;
    const result: Record<string, string | number>[] = [];

    for (let di = 0; di < allDays.length; di++) {
      const bands: Record<Band, number> = { '0%': 0, '1-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0 };
      const windowStart = Math.max(0, di - WINDOW + 1);

      for (let u = 0; u < leaderboard.length; u++) {
        let windowAll = 0;
        let windowAi = 0;
        const allMap = userDayAll.get(u)!;
        const aiMap = userDayAi.get(u)!;

        for (let wi = windowStart; wi <= di; wi++) {
          const wd = allDays[wi];
          windowAll += allMap.get(wd) || 0;
          windowAi += aiMap.get(wd) || 0;
        }

        if (windowAll === 0) continue; // user not active in window
        const pct = (windowAi / windowAll) * 100;
        if (pct === 0) bands['0%']++;
        else if (pct <= 25) bands['1-25%']++;
        else if (pct <= 50) bands['26-50%']++;
        else if (pct <= 75) bands['51-75%']++;
        else bands['76-100%']++;
      }

      result.push({ date: allDays[di], ...bands });
    }

    return result;
  }, [leaderboard]);

  if (chartData.length <= 1) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        Not enough data for cohort analysis
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">Adoption Cohort Bands</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <RechartsTooltip
              labelFormatter={(v) => typeof v === 'string' ? new Date(v).toLocaleDateString() : String(v)}
              formatter={(value, name) => [typeof value === 'number' ? `${value} developers` : '-', name]}
            />
            {RENDER_ORDER.map((band) => (
              <Area
                key={band}
                type="monotone"
                dataKey={band}
                stackId="cohort"
                stroke={BAND_COLORS[band]}
                fill={BAND_COLORS[band]}
                fillOpacity={0.7}
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        {[...BANDS].reverse().map((band) => (
          <div key={band} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BAND_COLORS[band] }} />
            <span>{band} AI</span>
          </div>
        ))}
      </div>
    </div>
  );
}
