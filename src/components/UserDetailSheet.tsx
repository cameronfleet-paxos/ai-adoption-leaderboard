'use client';

import { useMemo, useState, useEffect } from 'react';
import { ExternalLink, Trophy, Medal, Award, Zap, Calendar, GitCommit, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AI_TOOLS, CLAUDE_MODELS, type AITool, type AIToolBreakdown, type ClaudeModel, type ClaudeModelBreakdown } from '@/lib/github-client';

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
  aiToolBreakdown: AIToolBreakdown;
  claudeModelBreakdown: ClaudeModelBreakdown;
}

interface UserDetailSheetProps {
  user: LeaderboardEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMITS_PER_PAGE = 20;

export function UserDetailSheet({ user, open, onOpenChange }: UserDetailSheetProps) {
  const [visibleCount, setVisibleCount] = useState(COMMITS_PER_PAGE);

  // Reset visible count when user changes
  useEffect(() => {
    setVisibleCount(COMMITS_PER_PAGE);
  }, [user?.username]);

  // Build daily commit chart data with both AI and total commits
  const chartData = useMemo(() => {
    if (!user || user.commitDetails.length === 0) return [];

    const aiByDay: Record<string, number> = {};
    for (const commit of user.commitDetails) {
      const day = new Date(commit.date).toISOString().split('T')[0];
      aiByDay[day] = (aiByDay[day] || 0) + 1;
    }

    const totalByDay: Record<string, number> = {};
    for (const dateStr of (user.allCommitDates || [])) {
      const day = new Date(dateStr).toISOString().split('T')[0];
      totalByDay[day] = (totalByDay[day] || 0) + 1;
    }

    // Merge all days from both sets
    const allDays = new Set([...Object.keys(aiByDay), ...Object.keys(totalByDay)]);
    const sortedDays = Array.from(allDays).sort();
    if (sortedDays.length === 0) return [];

    // Fill gaps between first and last day
    const result: { date: string; aiCommits: number; totalCommits: number }[] = [];
    const start = new Date(sortedDays[0]);
    const end = new Date(sortedDays[sortedDays.length - 1]);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      result.push({
        date: key,
        aiCommits: aiByDay[key] || 0,
        totalCommits: totalByDay[key] || 0,
      });
    }

    return result;
  }, [user]);

  if (!user) return null;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2: return <Medal className="h-6 w-6 text-gray-400" />;
      case 3: return <Award className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankLabel = (rank: number) => {
    switch (rank) {
      case 1: return 'Champion';
      case 2: return 'Expert';
      case 3: return 'Pioneer';
      default: return `Rank #${rank}`;
    }
  };

  const toolEntries = (['claude-coauthor', 'claude-generated', 'copilot', 'cursor'] as const).filter(
    tool => user.aiToolBreakdown[tool] > 0
  );

  const modelEntries = (['opus', 'sonnet', 'haiku', 'unknown'] as const).filter(
    model => user.claudeModelBreakdown[model] > 0
  );

  const hasClaudeCommits = user.aiToolBreakdown['claude-coauthor'] > 0 || user.aiToolBreakdown['claude-generated'] > 0;

  const getAIToolBadge = (aiTool: AITool, claudeModel?: ClaudeModel) => {
    const tool = AI_TOOLS[aiTool];
    if ((aiTool === 'claude-coauthor' || aiTool === 'claude-generated') && claudeModel) {
      const model = CLAUDE_MODELS[claudeModel];
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <div className={cn('w-2 h-2 rounded-full', model.color)} />
          {model.label}
          {aiTool === 'claude-generated' && <span className="text-muted-foreground">(Code)</span>}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <div className={cn('w-2 h-2 rounded-full', tool.color)} />
        {tool.label}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.avatar} alt={user.username} />
              <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {user.username}
                {getRankIcon(user.rank)}
              </SheetTitle>
              <SheetDescription>{getRankLabel(user.rank)}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-primary">{user.commits}</div>
            <div className="text-xs text-muted-foreground">AI Commits</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{user.totalCommits}</div>
            <div className="text-xs text-muted-foreground">Total Commits</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-primary">{user.aiPercentage}%</div>
            <div className="text-xs text-muted-foreground">Adoption</div>
          </div>
        </div>

        {/* AI Tool Breakdown */}
        {toolEntries.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              AI Tool Breakdown
            </h4>
            <div className="space-y-2">
              {/* Stacked bar */}
              <div className="flex h-4 rounded-full overflow-hidden">
                {toolEntries.map(tool => {
                  const pct = (user.aiToolBreakdown[tool] / user.commits) * 100;
                  return (
                    <TooltipProvider key={tool}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(AI_TOOLS[tool].color, 'h-full')}
                            style={{ width: `${pct}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {AI_TOOLS[tool].label}: {user.aiToolBreakdown[tool]} ({Math.round(pct)}%)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs">
                {toolEntries.map(tool => (
                  <div key={tool} className="flex items-center gap-1.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', AI_TOOLS[tool].color)} />
                    <span className="text-muted-foreground">{AI_TOOLS[tool].label}</span>
                    <span className="font-medium">{user.aiToolBreakdown[tool]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Claude Model Breakdown */}
        {hasClaudeCommits && modelEntries.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3">Claude Model Breakdown</h4>
            <div className="space-y-2">
              <div className="flex h-3 rounded-full overflow-hidden">
                {modelEntries.map(model => {
                  const claudeTotal = user.aiToolBreakdown['claude-coauthor'] + user.aiToolBreakdown['claude-generated'];
                  const pct = (user.claudeModelBreakdown[model] / claudeTotal) * 100;
                  return (
                    <TooltipProvider key={model}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(CLAUDE_MODELS[model].color, 'h-full')}
                            style={{ width: `${pct}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {CLAUDE_MODELS[model].label}: {user.claudeModelBreakdown[model]} ({Math.round(pct)}%)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {modelEntries.map(model => (
                  <div key={model} className="flex items-center gap-1.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', CLAUDE_MODELS[model].color)} />
                    <span className="text-muted-foreground">{CLAUDE_MODELS[model].label}</span>
                    <span className="font-medium">{user.claudeModelBreakdown[model]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Commit Activity Chart */}
        {chartData.length > 1 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Commit Activity
            </h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                  />
                  <Area
                    type="monotone"
                    dataKey="totalCommits"
                    name="All Commits"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.1}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="aiCommits"
                    name="AI Commits"
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
                <span>AI Commits</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-muted-foreground rounded" style={{ borderTop: '1.5px dashed' }} />
                <span>All Commits</span>
              </div>
            </div>
          </div>
        )}

        {/* Commit list */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            All AI Commits ({user.commitDetails.length})
            {user.commitDetails.length > visibleCount && (
              <span className="text-xs font-normal text-muted-foreground">
                showing {visibleCount} of {user.commitDetails.length}
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {user.commitDetails.length > 0 ? (
              <>
                {user.commitDetails.slice(0, visibleCount).map((commit) => (
                  <div key={commit.sha} className="group flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-relaxed mb-2">
                        {commit.message}
                      </p>
                      <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                        {getAIToolBadge(commit.aiTool, commit.claudeModel)}
                        <Badge variant="outline" className="text-xs">
                          {commit.repository}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(commit.date).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => window.open(commit.url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {visibleCount < user.commitDetails.length && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVisibleCount(prev => prev + COMMITS_PER_PAGE)}
                  >
                    Show More ({user.commitDetails.length - visibleCount} remaining)
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No AI commits found</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
