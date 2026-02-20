'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { AI_TOOLS, type AIToolBreakdown, type AITool } from '@/lib/github-client';

const TOOL_COLORS: Record<AITool, string> = {
  'claude-coauthor': '#a855f7',
  'claude-generated': '#6366f1',
  'copilot': '#3b82f6',
  'cursor': '#06b6d4',
  'codex': '#22c55e',
  'gemini': '#ef4444',
  'agent': '#f97316',
};

interface AIToolDistributionChartProps {
  aiToolBreakdown: AIToolBreakdown;
  totalAICommits: number;
}

// Group Claude Co-author + Claude Code into a single "Claude" entry for the chart
const DISPLAY_GROUPS: { name: string; tools: AITool[]; color: string }[] = [
  { name: 'Claude', tools: ['claude-coauthor', 'claude-generated'], color: '#a855f7' },
  { name: 'GitHub Copilot', tools: ['copilot'], color: '#3b82f6' },
  { name: 'Cursor', tools: ['cursor'], color: '#06b6d4' },
  { name: 'OpenAI Codex', tools: ['codex'], color: '#22c55e' },
  { name: 'Gemini CLI', tools: ['gemini'], color: '#ef4444' },
  { name: 'AI Agents', tools: ['agent'], color: '#f97316' },
];

export function AIToolDistributionChart({ aiToolBreakdown, totalAICommits }: AIToolDistributionChartProps) {
  const chartData = useMemo(() => {
    return DISPLAY_GROUPS
      .map(group => {
        const value = group.tools.reduce((sum, tool) => sum + (aiToolBreakdown[tool] || 0), 0);
        return {
          name: group.name,
          value,
          percentage: totalAICommits > 0 ? Math.round((value / totalAICommits) * 1000) / 10 : 0,
          color: group.color,
        };
      })
      .filter(entry => entry.value > 0);
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
              minAngle={3}
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
