import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trophy, Medal, Award, Zap, Calendar, GitCommit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  aiToolBreakdown: AIToolBreakdown;
  claudeModelBreakdown: ClaudeModelBreakdown;
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
  hasSelectedRepos?: boolean;
}

export function Leaderboard({ data, isLoading, hasSelectedRepos = true }: LeaderboardProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
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

    const tools = (['claude-coauthor', 'claude-generated', 'copilot', 'cursor'] as const).filter(
      tool => toolBreakdown[tool] > 0
    );

    const models = (['opus', 'sonnet', 'haiku', 'unknown'] as const).filter(
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
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          AI Adoption Leaderboard
          <Badge variant="secondary" className="ml-auto">
            {data.length} {data.length === 1 ? 'developer' : 'developers'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((entry) => {
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
                              <AIToolBreakdownBar
                                toolBreakdown={entry.aiToolBreakdown}
                                modelBreakdown={entry.claudeModelBreakdown}
                                total={entry.commits}
                              />
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
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}