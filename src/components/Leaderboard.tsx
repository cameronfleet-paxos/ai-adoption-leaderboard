import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trophy, Medal, Award, Zap, Calendar, GitCommit, ArrowUp, ArrowDown, BarChart3, Cpu, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AI_TOOLS, CLAUDE_MODELS, type AITool, type AIToolBreakdown, type ClaudeModel, type ClaudeModelBreakdown } from '@/lib/github-client';
import { UserDetailSheet } from '@/components/UserDetailSheet';

const MODEL_ORDER = ['opus', 'sonnet', 'haiku', 'fable', 'unknown'] as const;

// Tailwind bg classes can't be dynamic — map them explicitly
const MODEL_BG: Record<string, string> = {
  'bg-amber-500': 'bg-amber-500',
  'bg-violet-500': 'bg-violet-500',
  'bg-emerald-500': 'bg-emerald-500',
  'bg-rose-500': 'bg-rose-500',
  'bg-purple-400': 'bg-purple-400',
};

interface EngineerModelStats {
  username: string;
  avatar: string;
  primaryModel: typeof MODEL_ORDER[number];
  breakdown: ClaudeModelBreakdown;
  totalClaudeCommits: number;
}

interface ModelInsightsPanelProps {
  data: Array<{ username: string; avatar: string; claudeModelBreakdown: ClaudeModelBreakdown; aiToolBreakdown: AIToolBreakdown }>;
}

export function ModelInsightsPanel({ data }: ModelInsightsPanelProps) {
  const [open, setOpen] = useState(false);

  const claudeEngineers: EngineerModelStats[] = useMemo(() => {
    return data
      .filter(e => (e.aiToolBreakdown['claude-coauthor'] || 0) + (e.aiToolBreakdown['claude-generated'] || 0) > 0)
      .map(e => {
        const bd = e.claudeModelBreakdown;
        const total = MODEL_ORDER.reduce((s, k) => s + (bd[k] || 0), 0);
        const primary = [...MODEL_ORDER].sort((a, b) => (bd[b] || 0) - (bd[a] || 0))[0];
        return { username: e.username, avatar: e.avatar, primaryModel: primary, breakdown: bd, totalClaudeCommits: total };
      })
      .filter(e => e.totalClaudeCommits > 0);
  }, [data]);

  // Aggregate commit counts across all engineers
  const orgTotals = useMemo(() => {
    const totals: ClaudeModelBreakdown = { opus: 0, sonnet: 0, haiku: 0, fable: 0, unknown: 0 };
    for (const e of claudeEngineers) {
      for (const k of MODEL_ORDER) totals[k] = (totals[k] || 0) + (e.breakdown[k] || 0);
    }
    return totals;
  }, [claudeEngineers]);

  const orgTotal = MODEL_ORDER.reduce((s, k) => s + orgTotals[k], 0);

  // Engineers grouped by primary model
  const byPrimary = useMemo(() => {
    const groups: Record<string, EngineerModelStats[]> = {};
    for (const e of claudeEngineers) {
      if (!groups[e.primaryModel]) groups[e.primaryModel] = [];
      groups[e.primaryModel].push(e);
    }
    return groups;
  }, [claudeEngineers]);

  // Engineers who have ever used fable (even if not primary)
  const fableUsers = useMemo(() =>
    claudeEngineers.filter(e => (e.breakdown.fable || 0) > 0),
  [claudeEngineers]);

  if (claudeEngineers.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Model Insights
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)} className="gap-1.5 text-xs">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? 'Hide' : 'Show model insights'}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-6">
          {/* Org-wide commit distribution */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Org-wide Claude commit distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden mb-2 gap-px">
              {MODEL_ORDER.filter(k => orgTotals[k] > 0).map(k => (
                <div
                  key={k}
                  className={cn(MODEL_BG[CLAUDE_MODELS[k].color])}
                  style={{ width: `${(orgTotals[k] / orgTotal) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {MODEL_ORDER.filter(k => orgTotals[k] > 0).map(k => (
                <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={cn('w-2 h-2 rounded-full', MODEL_BG[CLAUDE_MODELS[k].color])} />
                  <span className="font-medium text-foreground">{CLAUDE_MODELS[k].label}</span>
                  <span>{orgTotals[k]} commits</span>
                  <span className="opacity-60">({Math.round((orgTotals[k] / orgTotal) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Primary model breakdown by engineer count */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Primary model by engineer</p>
            <TooltipProvider>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MODEL_ORDER.filter(k => byPrimary[k]?.length > 0).map(k => {
                const engineers = byPrimary[k];
                const info = CLAUDE_MODELS[k];
                return (
                  <div key={k} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', MODEL_BG[info.color])} />
                      <span className="font-semibold text-sm">{info.label}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">{engineers.length} engineer{engineers.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {engineers.slice(0, 8).map(e => (
                        <Tooltip key={e.username}>
                          <TooltipTrigger asChild>
                            <Avatar className="h-6 w-6 cursor-default">
                              <AvatarImage src={e.avatar} alt={e.username} />
                              <AvatarFallback className="text-[9px]">{e.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{e.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(((e.breakdown[k] || 0) / e.totalClaudeCommits) * 100)}% {info.label} · {e.totalClaudeCommits} Claude commits
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {engineers.length > 8 && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground font-medium">
                          +{engineers.length - 8}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </TooltipProvider>
          </div>

          {/* Fable early adopters */}
          {fableUsers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                Fable early adopters
                <span className="opacity-60">— {fableUsers.length} engineer{fableUsers.length !== 1 ? 's' : ''} have tried it</span>
              </p>
              <TooltipProvider>
                <div className="flex flex-wrap gap-2">
                  {fableUsers.map(e => (
                    <Tooltip key={e.username}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-full pl-0.5 pr-2.5 py-0.5 cursor-default">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={e.avatar} alt={e.username} />
                            <AvatarFallback className="text-[8px]">{e.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{e.username}</span>
                          <span className="text-xs text-muted-foreground">{e.breakdown.fable}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{e.username}</p>
                        <p className="text-xs text-muted-foreground">{e.breakdown.fable} Fable commit{(e.breakdown.fable || 0) !== 1 ? 's' : ''} · {Math.round(((e.breakdown.fable || 0) / e.totalClaudeCommits) * 100)}% of their Claude usage</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

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

import type { ToolFilter } from '@/lib/tool-filter';

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
  hasSelectedRepos?: boolean;
  toolFilter?: ToolFilter;
}

type SortField = 'commits' | 'aiPercentage';
type SortDirection = 'asc' | 'desc';

const CLAUDE_TOOLS: AITool[] = ['claude-coauthor', 'claude-generated'];

export function Leaderboard({ data, isLoading, hasSelectedRepos = true, toolFilter = 'all' }: LeaderboardProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showModelInsights, setShowModelInsights] = useState(false);
  const [sortField, setSortField] = useState<SortField>('commits');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailUser, setDetailUser] = useState<LeaderboardEntry | null>(null);

  // Recompute entries when filtered by tool
  const filteredData = useMemo(() => {
    if (toolFilter === 'all') return data;

    if (toolFilter === 'agents') {
      return data.filter(entry => entry.username.endsWith('-agent[bot]') || entry.aiToolBreakdown['agent'] > 0);
    }

    const matchesFilter = (tool: AITool) =>
      toolFilter === 'claude' ? CLAUDE_TOOLS.includes(tool) : tool === toolFilter;

    return data.map(entry => {
      const filteredCommits = toolFilter === 'claude'
        ? CLAUDE_TOOLS.reduce((sum, t) => sum + (entry.aiToolBreakdown[t] || 0), 0)
        : entry.aiToolBreakdown[toolFilter] || 0;
      const filteredDetails = entry.commitDetails.filter(c => matchesFilter(c.aiTool));
      const aiPercentage = entry.totalCommits > 0 ? Math.round((filteredCommits / entry.totalCommits) * 100) : 0;

      return {
        ...entry,
        commits: filteredCommits,
        aiPercentage,
        commitDetails: filteredDetails,
      };
    });
  }, [data, toolFilter]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const multiplier = sortDirection === 'desc' ? -1 : 1;
      return (a[sortField] - b[sortField]) * multiplier;
    });
    return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
  }, [filteredData, sortField, sortDirection]);

  const handleSortClick = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleUser = (username: string) => {
    setExpandedUser(expandedUser === username ? null : username);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBadgeVariant = (rank: number) => {
    switch (rank) {
      case 1:
        return "default";
      case 2:
        return "secondary";
      case 3:
        return "outline";
      default:
        return "outline";
    }
  };

  // Render AI tool breakdown as colored segments with optional model breakdown
  const AIToolBreakdownBar = ({
    toolBreakdown,
    modelBreakdown,
    total
  }: {
    toolBreakdown: AIToolBreakdown;
    modelBreakdown: ClaudeModelBreakdown;
    total: number;
  }) => {
    if (total === 0) return null;

    const tools = (['claude-coauthor', 'claude-generated', 'copilot', 'cursor', 'codex', 'gemini', 'agent'] as const).filter(
      tool => toolBreakdown[tool] > 0
    );

    const models = (['opus', 'sonnet', 'haiku', 'fable', 'unknown'] as const).filter(
      model => modelBreakdown[model] > 0
    );

    // Check if we have Claude commits to show model breakdown
    const hasClaudeCommits = toolBreakdown['claude-coauthor'] > 0 || toolBreakdown['claude-generated'] > 0;

    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {/* Tool breakdown */}
          <div className="flex items-center gap-1.5">
            {tools.map(tool => (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', AI_TOOLS[tool].color)} />
                    <span className="text-xs text-muted-foreground">{toolBreakdown[tool]}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{AI_TOOLS[tool].label}</p>
                  <p className="text-xs text-muted-foreground">{AI_TOOLS[tool].description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {/* Model breakdown (shown if any Claude commits) */}
          {hasClaudeCommits && models.length > 0 && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <div className="flex items-center gap-1">
                {models.map(model => (
                  <Tooltip key={model}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-0.5">
                        <div className={cn('w-1.5 h-1.5 rounded-full', CLAUDE_MODELS[model].color)} />
                        <span className="text-[10px] text-muted-foreground">{modelBreakdown[model]}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{CLAUDE_MODELS[model].label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
    );
  };

  // Get badge for AI tool type with optional model
  const getAIToolBadge = (aiTool: AITool, claudeModel?: ClaudeModel) => {
    const tool = AI_TOOLS[aiTool];

    // For Claude tools, show the model if available
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
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Leaderboard</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasSelectedRepos) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Leaderboard</h2>
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select repositories to view leaderboard
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose one or more repositories above to see commit statistics and developer rankings.
          </p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            AI Adoption Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <GitCommit className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2">No commits found</h3>
            <p className="text-sm text-muted-foreground">
              No commits were found in the selected repositories and time range.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            AI Adoption Leaderboard
            <Badge variant="secondary">
              {data.length} {data.length === 1 ? 'developer' : 'developers'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={showModelInsights ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowModelInsights(v => !v)}
              className="text-xs text-muted-foreground gap-1.5 mr-2"
            >
              <Cpu className="h-3 w-3" />
              {showModelInsights ? 'Hide model breakdowns' : 'Show model breakdowns'}
            </Button>
            <span className="text-xs text-muted-foreground mr-1">Sort by:</span>
            <Button
              variant={sortField === 'commits' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortClick('commits')}
              className="text-xs"
            >
              <Zap className="h-3 w-3 mr-1" />
              AI Commits
              {sortField === 'commits' && (
                sortDirection === 'desc'
                  ? <ArrowDown className="h-3 w-3 ml-1" />
                  : <ArrowUp className="h-3 w-3 ml-1" />
              )}
            </Button>
            <Button
              variant={sortField === 'aiPercentage' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortClick('aiPercentage')}
              className="text-xs"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Adoption %
              {sortField === 'aiPercentage' && (
                sortDirection === 'desc'
                  ? <ArrowDown className="h-3 w-3 ml-1" />
                  : <ArrowUp className="h-3 w-3 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedData.map((entry) => {
          const isNonAIUser = entry.commits === 0;
          return (
          <Collapsible key={entry.username}>
            <div className={cn(
              "rounded-lg border transition-all duration-200 hover:shadow-md",
              entry.rank <= 3 && !isNonAIUser ? "bg-gradient-to-r from-primary/5 to-transparent" : "",
              isNonAIUser ? "opacity-50" : ""
            )}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-4 h-auto justify-start hover:bg-transparent"
                  onClick={() => toggleUser(entry.username)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10">
                        {getRankIcon(entry.rank)}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={entry.avatar} alt={entry.username} />
                        <AvatarFallback>
                          {entry.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{entry.username}</h3>
                          {entry.rank <= 3 && (
                            <Badge variant={getRankBadgeVariant(entry.rank)} className="text-xs">
                              {entry.rank === 1 ? '🥇 Champion' : entry.rank === 2 ? '🥈 Expert' : '🥉 Pioneer'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {isNonAIUser ? (
                            <span className="flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              {entry.totalCommits} total commits
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {entry.commits} AI commits
                              </span>
                              {showModelInsights ? (() => {
                                const bd = entry.claudeModelBreakdown;
                                const claudeTotal = MODEL_ORDER.reduce((s, k) => s + (bd[k] || 0), 0);
                                if (claudeTotal === 0) return (
                                  <AIToolBreakdownBar
                                    toolBreakdown={entry.aiToolBreakdown}
                                    modelBreakdown={entry.claudeModelBreakdown}
                                    total={entry.commits}
                                  />
                                );
                                const sorted = [...MODEL_ORDER]
                                  .map(k => ({ k, count: bd[k] || 0, info: CLAUDE_MODELS[k] }))
                                  .filter(m => m.count > 0)
                                  .sort((a, b) => b.count - a.count);
                                const primary = sorted[0];
                                return (
                                  <span className="flex items-center gap-2 text-xs">
                                    <span className="flex items-center gap-1">
                                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', MODEL_BG[primary.info.color])} />
                                      <span className="font-medium text-foreground">{primary.info.label}</span>
                                      <span className="text-muted-foreground">{Math.round((primary.count / claudeTotal) * 100)}%</span>
                                    </span>
                                    {sorted.slice(1).map(m => (
                                      <span key={m.k} className="flex items-center gap-1 text-muted-foreground">
                                        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', MODEL_BG[m.info.color])} />
                                        <span>{m.info.label}</span>
                                        <span>{Math.round((m.count / claudeTotal) * 100)}%</span>
                                      </span>
                                    ))}
                                  </span>
                                );
                              })() : (
                                <AIToolBreakdownBar
                                  toolBreakdown={entry.aiToolBreakdown}
                                  modelBreakdown={entry.claudeModelBreakdown}
                                  total={entry.commits}
                                />
                              )}
                              <span className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3" />
                                {entry.totalCommits} total
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className={cn("text-2xl font-bold", isNonAIUser ? "text-muted-foreground" : "text-primary")}>
                          {entry.aiPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">adoption rate</div>
                      </div>
                      {expandedUser === entry.username ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                {expandedUser === entry.username && (
                  <div className="px-4 pb-4 border-t">
                    <div className="pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Recent AI-Enhanced Commits
                      </h4>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {entry.commitDetails.length > 0 ? (
                          entry.commitDetails.map((commit) => (
                            <div key={commit.sha} className="group flex items-start space-x-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
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
                                    View commit
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No commit details available</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => setDetailUser(entry)}
                      >
                        <BarChart3 className="h-3.5 w-3.5 mr-2" />
                        View Detailed Stats
                      </Button>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
          );
        })}
      </CardContent>
      <UserDetailSheet
        user={detailUser}
        open={detailUser !== null}
        onOpenChange={(open) => { if (!open) setDetailUser(null); }}
      />
    </Card>
  );
}