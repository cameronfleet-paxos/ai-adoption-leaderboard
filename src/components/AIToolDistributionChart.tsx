'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { AI_TOOLS, type AIToolBreakdown, type AITool } from '@/lib/github-client';

const TOOL_COLORS: Record<AITool, string> = {
  'claude-coauthor': '#a855f7',
  'claude-generated': '#6366f1',
  'copilot': '#3b82f6',
  'cursor': '#06b6d4',
};

interface AIToolDistributionChartProps {
  aiToolBreakdown: AIToolBreakdown;
  totalAICommits: number;
}

export function AIToolDistributionChart({ aiToolBreakdown, totalAICommits }: AIToolDistributionChartProps) {
  const chartData = useMemo(() => {
    return (Object.keys(AI_TOOLS) as AITool[])
      .filter((tool) => aiToolBreakdown[tool] > 0)
      .map((tool) => ({
        name: AI_TOOLS[tool].label,
        value: aiToolBreakdown[tool],
        percentage: totalAICommits > 0 ? Math.round((aiToolBreakdown[tool] / totalAICommits) * 1000) / 10 : 0,
        color: TOOL_COLORS[tool],
      }));
  }, [aiToolBreakdown, totalAICommits]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No AI-assisted commits found
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">AI Tool Distribution</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value, name) => [typeof value === 'number' ? `${value} commits` : '-', name]}
            />
            {/* Center text */}
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-2xl font-bold"
              style={{ fontSize: '24px', fontWeight: 700 }}
            >
              {totalAICommits}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground"
              style={{ fontSize: '11px' }}
            >
              AI commits
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
            <span className="font-medium text-foreground">{entry.value}</span>
            <span>({entry.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
