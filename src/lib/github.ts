interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

// AI tool detection types
export type AITool = 'claude-coauthor' | 'claude-generated' | 'copilot';

// Claude model variants detected from co-author signatures
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku' | 'unknown';

export interface AIToolInfo {
  id: AITool;
  label: string;
  description: string;
  color: string;
}

export interface ClaudeModelInfo {
  id: ClaudeModel;
  label: string;
  color: string;
}

export const AI_TOOLS: Record<AITool, AIToolInfo> = {
  'claude-coauthor': {
    id: 'claude-coauthor',
    label: 'Claude Co-author',
    description: 'Co-authored by Claude (Opus, Sonnet, etc.)',
    color: 'bg-purple-500',
  },
  'claude-generated': {
    id: 'claude-generated',
    label: 'Claude Code',
    description: 'Generated with Claude Code',
    color: 'bg-indigo-500',
  },
  'copilot': {
    id: 'copilot',
    label: 'GitHub Copilot',
    description: 'Co-authored by GitHub Copilot',
    color: 'bg-blue-500',
  },
};

export const CLAUDE_MODELS: Record<ClaudeModel, ClaudeModelInfo> = {
  'opus': {
    id: 'opus',
    label: 'Opus',
    color: 'bg-amber-500',
  },
  'sonnet': {
    id: 'sonnet',
    label: 'Sonnet',
    color: 'bg-violet-500',
  },
  'haiku': {
    id: 'haiku',
    label: 'Haiku',
    color: 'bg-emerald-500',
  },
  'unknown': {
    id: 'unknown',
    label: 'Claude',
    color: 'bg-purple-400',
  },
};

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  url: string;
  repository: string;
  aiTool: AITool;
  claudeModel?: ClaudeModel; // Only set when aiTool is claude-coauthor or claude-generated
}

export interface ClaudeModelBreakdown {
  opus: number;
  sonnet: number;
  haiku: number;
  unknown: number;
}

export interface AIToolBreakdown {
  'claude-coauthor': number;
  'claude-generated': number;
  'copilot': number;
}

export interface FullAIBreakdown {
  byTool: AIToolBreakdown;
  byClaudeModel: ClaudeModelBreakdown;
}

interface LeaderboardData {
  totalCommits: number;
  aiCommits: number;
  aiToolBreakdown: AIToolBreakdown;
  claudeModelBreakdown: ClaudeModelBreakdown;
  activeUsers: number;
  leaderboard: {
    rank: number;
    username: string;
    commits: number;
    totalCommits: number;
    aiPercentage: number;
    avatar: string;
    commitDetails: CommitDetail[];
    aiToolBreakdown: AIToolBreakdown;
    claudeModelBreakdown: ClaudeModelBreakdown;
  }[];
}

import { githubApp } from '@/lib/github-app';
import { getAuthMode, getPATToken } from '@/lib/auth-config';

export interface Repository {
  owner: string;
  name: string;
  displayName: string;
}

export async function fetchCommitData(
  dateRange?: { start: Date; end: Date },
  repositories?: Repository[],
  installationId?: number
): Promise<LeaderboardData> {

  let startDate: Date;
  let endDate: Date;

  if (dateRange) {
    startDate = dateRange.start;
    endDate = dateRange.end;
  } else {
    // Default to past week
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  }

  // Determine authentication method
  const authMode = getAuthMode();
  let token: string | undefined;

  if (authMode === 'pat') {
    // Use personal access token
    token = getPATToken();
  } else if (installationId) {
    // Use GitHub App installation token
    try {
      token = await githubApp.getInstallationToken(installationId);
    } catch (error) {
      console.error('Failed to get installation token:', error);
      throw new Error('Authentication failed. Please re-authorize the app.');
    }
  }

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Adoption-Leaderboard'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const emptyToolBreakdown: AIToolBreakdown = {
    'claude-coauthor': 0,
    'claude-generated': 0,
    'copilot': 0,
  };

  const emptyModelBreakdown: ClaudeModelBreakdown = {
    opus: 0,
    sonnet: 0,
    haiku: 0,
    unknown: 0,
  };

  try {
    let allCommits: (GitHubCommit & { repository: string })[] = [];

    // Use provided repositories or empty array
    const reposToFetch = repositories || [];

    if (reposToFetch.length === 0) {
      console.log('No repositories provided');
      return {
        totalCommits: 0,
        aiCommits: 0,
        aiToolBreakdown: { ...emptyToolBreakdown },
        claudeModelBreakdown: { ...emptyModelBreakdown },
        activeUsers: 0,
        leaderboard: []
      };
    }
    
    // Fetch commits from selected repositories
    for (const repository of reposToFetch) {
      console.log(`Fetching commits from ${repository.owner}/${repository.name}`);
      
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/commits?since=${startDate.toISOString()}&until=${endDate.toISOString()}&per_page=100&page=${page}`;
        console.log(`Fetching page ${page} from:`, url);
        
        const response = await fetch(url, { headers });

        console.log(`Page ${page} response status:`, response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`GitHub API error for ${repository.name}:`, response.status, errorText);
          // Continue with other repositories instead of throwing
          break;
        }

        const commits: GitHubCommit[] = await response.json();
        console.log(`Page ${page} fetched commits from ${repository.name}:`, commits.length);
        
        // Add repository information to each commit
        const commitsWithRepo = commits.map(commit => ({
          ...commit,
          repository: repository.displayName
        }));
        
        allCommits = allCommits.concat(commitsWithRepo);
        
        // Check if there are more pages
        const linkHeader = response.headers.get('link');
        hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;
        page++;

        // Safety check to prevent infinite loops (100 pages = 10,000 commits per repo)
        if (page > 100) {
          console.warn(`Stopping pagination after 100 pages for safety on ${repository.name}`);
          break;
        }
      }
    }
    
    console.log('Total commits fetched across all pages:', allCommits.length);
    console.log('First few commits:', allCommits.slice(0, 3).map(c => ({ 
      sha: c.sha, 
      author: c.author?.login, 
      message: c.commit.message.split('\n')[0] 
    })));
    
    // Extract Claude model from co-author line
    // Matches patterns like "Claude Opus 4.5", "Claude Sonnet 4.5", "Claude" (unknown model)
    function extractClaudeModel(message: string): ClaudeModel {
      const lowerMessage = message.toLowerCase();

      // Check for specific model names in co-author line
      if (lowerMessage.includes('claude opus')) {
        return 'opus';
      }
      if (lowerMessage.includes('claude sonnet')) {
        return 'sonnet';
      }
      if (lowerMessage.includes('claude haiku')) {
        return 'haiku';
      }

      // Default to unknown if just "Claude" without model specification
      return 'unknown';
    }

    // Detect AI tool used in a commit message
    // Returns the AI tool type, optional model, or null if no AI assistance detected
    // Priority: claude-coauthor > claude-generated > copilot (to avoid double counting)
    function detectAITool(message: string): { aiTool: AITool; claudeModel?: ClaudeModel } | null {
      const lowerMessage = message.toLowerCase();

      // 1. Claude Co-author pattern (matches Claude, Claude Opus 4.5, Claude Sonnet 4.5, etc.)
      // Using regex to match any "Co-authored-by: Claude" with optional model name
      const claudeCoAuthorRegex = /co-authored-by:\s*claude[^<]*<[^>]*@anthropic\.com>/i;
      if (claudeCoAuthorRegex.test(message)) {
        return {
          aiTool: 'claude-coauthor',
          claudeModel: extractClaudeModel(message)
        };
      }

      // 2. Generated with Claude Code pattern
      // Note: Claude Code footer doesn't specify model, so we mark as unknown
      if (lowerMessage.includes('generated with [claude code]') ||
          lowerMessage.includes('generated with claude code')) {
        return {
          aiTool: 'claude-generated',
          claudeModel: 'unknown' // Claude Code doesn't specify model in footer
        };
      }

      // 3. GitHub Copilot Co-author pattern
      const copilotCoAuthorRegex = /co-authored-by:\s*copilot\s*</i;
      if (copilotCoAuthorRegex.test(message)) {
        return { aiTool: 'copilot' };
      }

      return null;
    }

    // Filter commits that have AI assistance and track by tool type and model
    const aiCommitsWithTool: { commit: typeof allCommits[0]; aiTool: AITool; claudeModel?: ClaudeModel }[] = [];
    const globalToolBreakdown: AIToolBreakdown = { ...emptyToolBreakdown };
    const globalModelBreakdown: ClaudeModelBreakdown = { ...emptyModelBreakdown };

    allCommits.forEach(commit => {
      const detection = detectAITool(commit.commit.message);
      if (detection) {
        aiCommitsWithTool.push({ commit, ...detection });
        globalToolBreakdown[detection.aiTool]++;

        // Track Claude model if this is a Claude commit
        if (detection.claudeModel) {
          globalModelBreakdown[detection.claudeModel]++;
        }

        console.log(`Found ${detection.aiTool}${detection.claudeModel ? ` (${detection.claudeModel})` : ''} commit:`, {
          sha: commit.sha,
          author: commit.author?.login,
          message: commit.commit.message.split('\n')[0]
        });
      }
    });

    console.log('Total commits:', allCommits.length);
    console.log('AI-assisted commits:', aiCommitsWithTool.length);
    console.log('AI tool breakdown:', globalToolBreakdown);
    console.log('Claude model breakdown:', globalModelBreakdown);

    // Count total commits by user
    const userTotalCommits = new Map<string, number>();
    allCommits.forEach(commit => {
      if (commit.author?.login) {
        const username = commit.author.login;
        userTotalCommits.set(username, (userTotalCommits.get(username) || 0) + 1);
      }
    });

    // Count AI commits by user and collect commit details with tool and model breakdown
    const userCommits = new Map<string, {
      count: number;
      avatar: string;
      commits: CommitDetail[];
      aiToolBreakdown: AIToolBreakdown;
      claudeModelBreakdown: ClaudeModelBreakdown;
    }>();

    aiCommitsWithTool.forEach(({ commit, aiTool, claudeModel }) => {
      if (commit.author?.login) {
        const username = commit.author.login;
        const existing = userCommits.get(username) || {
          count: 0,
          avatar: commit.author.avatar_url,
          commits: [],
          aiToolBreakdown: { ...emptyToolBreakdown },
          claudeModelBreakdown: { ...emptyModelBreakdown }
        };

        // Find the repository info for this commit
        const repoInfo = reposToFetch.find(repo => repo.displayName === commit.repository);
        const repoOwner = repoInfo?.owner || 'unknown';
        const repoName = repoInfo?.name || 'unknown';

        const commitDetail: CommitDetail = {
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line as summary
          date: commit.commit.author.date,
          url: `https://github.com/${repoOwner}/${repoName}/commit/${commit.sha}`,
          repository: commit.repository,
          aiTool,
          claudeModel
        };

        // Update the user's AI tool breakdown
        const updatedToolBreakdown = { ...existing.aiToolBreakdown };
        updatedToolBreakdown[aiTool]++;

        // Update the user's Claude model breakdown
        const updatedModelBreakdown = { ...existing.claudeModelBreakdown };
        if (claudeModel) {
          updatedModelBreakdown[claudeModel]++;
        }

        userCommits.set(username, {
          count: existing.count + 1,
          avatar: commit.author.avatar_url,
          commits: [...existing.commits, commitDetail],
          aiToolBreakdown: updatedToolBreakdown,
          claudeModelBreakdown: updatedModelBreakdown
        });
      }
    });

    // Create leaderboard
    const leaderboard = Array.from(userCommits.entries())
      .map(([username, data]) => {
        const totalCommits = userTotalCommits.get(username) || 0;
        const aiPercentage = totalCommits > 0 ? Math.round((data.count / totalCommits) * 100) : 0;

        return {
          username,
          commits: data.count,
          totalCommits,
          aiPercentage,
          avatar: data.avatar,
          commitDetails: data.commits,
          aiToolBreakdown: data.aiToolBreakdown,
          claudeModelBreakdown: data.claudeModelBreakdown
        };
      })
      .sort((a, b) => b.commits - a.commits)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry
      }));

    return {
      totalCommits: allCommits.length,
      aiCommits: aiCommitsWithTool.length,
      aiToolBreakdown: globalToolBreakdown,
      claudeModelBreakdown: globalModelBreakdown,
      activeUsers: userCommits.size,
      leaderboard
    };
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    // Return empty data on error
    return {
      totalCommits: 0,
      aiCommits: 0,
      aiToolBreakdown: { ...emptyToolBreakdown },
      claudeModelBreakdown: { ...emptyModelBreakdown },
      activeUsers: 0,
      leaderboard: []
    };
  }
}