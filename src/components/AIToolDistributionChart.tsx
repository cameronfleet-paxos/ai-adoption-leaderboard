'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChevronLeft, ZoomIn, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import { type AIToolBreakdown, type AITool, type ClaudeModelBreakdown, type ClaudeModel } from '@/lib/github-client';

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  url: string;
  repository: string;
  aiTool: AITool;
  claudeModel?: ClaudeModel;
}

interface AIToolDistributionChartProps {
  aiToolBreakdown: AIToolBreakdown;
  totalAICommits: number;
  claudeModelBreakdown?: ClaudeModelBreakdown;
  commitDetails?: CommitDetail[];
}

const DISPLAY_GROUPS: { name: string; tools: AITool[]; color: string; drillable?: boolean }[] = [
  { name: 'Claude', tools: ['claude-coauthor', 'claude-generated'], color: '#a855f7', drillable: true },
  { name: 'GitHub Copilot', tools: ['copilot'], color: '#3b82f6' },
  { name: 'Cursor', tools: ['cursor'], color: '#06b6d4' },
  { name: 'OpenAI Codex', tools: ['codex'], color: '#22c55e' },
  { name: 'Gemini CLI', tools: ['gemini'], color: '#ef4444' },
  { name: 'AI Agents', tools: ['agent'], color: '#f97316' },
];

const MODEL_GROUPS: { name: string; key: keyof ClaudeModelBreakdown; color: string }[] = [
  { name: 'Opus', key: 'opus', color: '#f59e0b' },
  { name: 'Sonnet', key: 'sonnet', color: '#a855f7' },
  { name: 'Haiku', key: 'haiku', color: '#10b981' },
  { name: 'Fable', key: 'fable', color: '#f43f5e' },
  { name: 'Unknown', key: 'unknown', color: '#94a3b8' },
];

// Returns { sortKey: 'YYYY-MM-DD', label: 'M/DD' } for the Monday of the commit's week
function getWeekKey(dateStr: string): { sortKey: string; label: string } {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return {
    sortKey: `${yyyy}-${mm}-${dd}`,
    label: `${d.getUTCMonth() + 1}/${dd}`,
  };
}

export function AIToolDistributionChart({ aiToolBreakdown, totalAICommits, claudeModelBreakdown, commitDetails }: AIToolDistributionChartProps) {
  const [drilldown, setDrilldown] = useState(false);
  const [hoveredClaude, setHoveredClaude] = useState(false);
  const [viewMode, setViewMode] = useState<'pie' | 'timeline'>('pie');
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const toggleLine = (name: string) =>
    setHiddenLines(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const chartData = useMemo(() => {
    return DISPLAY_GROUPS
      .map(group => {
        const value = group.tools.reduce((sum, tool) => sum + (aiToolBreakdown[tool] || 0), 0);
        return {
          name: group.name,
          value,
          percentage: totalAICommits > 0 ? Math.round((value / totalAICommits) * 1000) / 10 : 0,
          color: group.color,
          drillable: group.drillable,
        };
      })
      .filter(entry => entry.value > 0);
  }, [aiToolBreakdown, totalAICommits]);

  const claudeTotal = useMemo(
    () => DISPLAY_GROUPS[0].tools.reduce((sum, tool) => sum + (aiToolBreakdown[tool] || 0), 0),
    [aiToolBreakdown]
  );

  const modelData = useMemo(() => {
    if (!claudeModelBreakdown) return [];
    return MODEL_GROUPS
      .map(m => ({
        name: m.name,
        value: claudeModelBreakdown[m.key] || 0,
        percentage: claudeTotal > 0 ? Math.round(((claudeModelBreakdown[m.key] || 0) / claudeTotal) * 1000) / 10 : 0,
        color: m.color,
      }))
      .filter(entry => entry.value > 0);
  }, [claudeModelBreakdown, claudeTotal]);

  const timelineData = useMemo(() => {
    if (!commitDetails?.length) return [];

    const weekMap = new Map<string, Record<string, string | number>>();
    for (const commit of commitDetails) {
      const { sortKey, label } = getWeekKey(commit.date);
      const group = DISPLAY_GROUPS.find(g => g.tools.includes(commit.aiTool));
      if (!group) continue;
      if (!weekMap.has(sortKey)) weekMap.set(sortKey, { label });
      const entry = weekMap.get(sortKey)!;
      entry[group.name] = ((entry[group.name] as number) || 0) + 1;
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entry]) => ({ week: entry.label, ...entry, label: undefined }));
  }, [commitDetails]);

  const activeData = drilldown ? modelData : chartData;
  const centerTotal = drilldown ? claudeTotal : totalAICommits;
  const centerLabel = drilldown ? 'Claude commits' : 'AI commits';

  // Which groups actually appear in timeline data
  const timelineGroups = useMemo(() => {
    if (!timelineData.length) return DISPLAY_GROUPS;
    const keys = new Set(timelineData.flatMap(row => Object.keys(row).filter(k => k !== 'week')));
    return DISPLAY_GROUPS.filter(g => keys.has(g.name));
  }, [timelineData]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No AI-assisted commits found
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {drilldown && viewMode === 'pie' && (
          <button
            onClick={() => setDrilldown(false)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            All tools
          </button>
        )}
        <h3 className="text-sm font-medium flex-1">
          {viewMode === 'pie' && drilldown ? 'Claude — by model' : 'AI Tool Distribution'}
        </h3>
        {commitDetails && commitDetails.length > 0 && (
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <button
              onClick={() => { setViewMode('pie'); }}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${viewMode === 'pie' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Pie chart"
            >
              <PieIcon className="h-3 w-3" />
              Pie
            </button>
            <button
              onClick={() => { setViewMode('timeline'); setDrilldown(false); }}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${viewMode === 'timeline' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Over time"
            >
              <BarChart2 className="h-3 w-3" />
              Over time
            </button>
          </div>
        )}
      </div>

      {viewMode === 'timeline' ? (
        <div className="w-full">
          {timelineData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
              Not enough data for timeline view
            </div>
          ) : (
            <>
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value) => [`${value} commits`]}
                />
                {timelineGroups.map(group => (
                  <Line
                    key={group.name}
                    type="monotone"
                    dataKey={group.name}
                    stroke={group.color}
                    strokeWidth={2}
                    dot={false}
                    hide={hiddenLines.has(group.name)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
              {timelineGroups.map(group => {
                const hidden = hiddenLines.has(group.name);
                return (
                  <button
                    key={group.name}
                    onClick={() => toggleLine(group.name)}
                    className="flex items-center gap-1.5 transition-opacity"
                    style={{ opacity: hidden ? 0.35 : 1 }}
                  >
                    <svg width="16" height="8">
                      <line x1="0" y1="4" x2="16" y2="4" stroke={group.color} strokeWidth={hidden ? 1.5 : 2.5} strokeDasharray={hidden ? '3 2' : undefined} />
                      <circle cx="8" cy="4" r="2.5" fill={group.color} />
                    </svg>
                    <span style={{ color: group.color, textDecoration: hidden ? 'line-through' : undefined }}>
                      {group.name}
                    </span>
                  </button>
                );
              })}
            </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="relative h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={hoveredClaude && !drilldown ? 90 : 85}
                  paddingAngle={2}
                  minAngle={3}
                  dataKey="value"
                  onClick={(entry) => {
                    if (!drilldown && entry?.drillable) setDrilldown(true);
                  }}
                  onMouseEnter={(entry) => {
                    if (!drilldown && entry?.drillable) setHoveredClaude(true);
                  }}
                  onMouseLeave={() => setHoveredClaude(false)}
                  style={{ cursor: drilldown ? 'default' : 'pointer' }}
                >
                  {activeData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      stroke={!drilldown && (entry as typeof chartData[0]).drillable && hoveredClaude ? '#fff' : 'none'}
                      strokeWidth={2}
                      opacity={!drilldown && hoveredClaude && !(entry as typeof chartData[0]).drillable ? 0.5 : 1}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value, name) => [
                    typeof value === 'number' ? `${value} commits` : '-',
                    drilldown ? `Claude ${name}` : name,
                  ]}
                  content={!drilldown ? ({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-md px-3 py-2 text-xs shadow-md">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground">{item.value} commits ({item.percentage}%)</p>
                        {item.drillable && (
                          <p className="text-purple-500 mt-1 font-medium">Click to see model breakdown →</p>
                        )}
                      </div>
                    );
                  } : undefined}
                />
                <text
                  x="50%"
                  y="48%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: '24px', fontWeight: 700, fill: 'currentColor' }}
                >
                  {centerTotal}
                </text>
                <text
                  x="50%"
                  y="60%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: '11px', fill: '#888' }}
                >
                  {centerLabel}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            {activeData.map((entry) => {
              const isDrillable = !drilldown && (entry as typeof chartData[0]).drillable;
              return (
                <div
                  key={entry.name}
                  className={`flex items-center gap-1.5 ${isDrillable ? 'cursor-pointer hover:text-foreground transition-colors group' : ''}`}
                  onClick={() => { if (isDrillable) setDrilldown(true); }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className={isDrillable ? 'group-hover:underline underline-offset-2' : ''}>{entry.name}</span>
                  <span className="font-medium text-foreground">{entry.value}</span>
                  <span>({entry.percentage}%)</span>
                  {isDrillable && <ZoomIn className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
