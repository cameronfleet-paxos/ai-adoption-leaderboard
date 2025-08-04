import { TrendingUp, GitCommit, Users, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  totalCommits: number;
  claudeCommits: number;
  activeUsers: number;
  isLoading?: boolean;
  hasSelectedRepos?: boolean;
}

export function StatsCards({ totalCommits, claudeCommits, activeUsers, isLoading = false, hasSelectedRepos = true }: StatsCardsProps) {
  const adoptionRate = totalCommits > 0 ? Math.round((claudeCommits / totalCommits) * 100) : 0;

  const stats = [
    {
      title: 'Total Commits',
      value: totalCommits,
      icon: GitCommit,
      description: 'All commits in selected repositories',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
    },
    {
      title: 'Claude Co-authored',
      value: claudeCommits,
      icon: Zap,
      description: 'Commits enhanced with AI assistance',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/10',
    },
    {
      title: 'Active Developers',
      value: activeUsers,
      icon: Users,
      description: 'Contributors in the selected timeframe',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/10',
    },
    {
      title: 'AI Adoption Rate',
      value: `${adoptionRate}%`,
      icon: TrendingUp,
      description: 'Percentage of commits using AI assistance',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasSelectedRepos) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => {
          const IconComponent = stat.icon;
          return (
            <Card key={i} className="opacity-60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <IconComponent className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Select repositories to view data
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, i) => {
        const IconComponent = stat.icon;
        return (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <IconComponent className={cn('h-4 w-4', stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}