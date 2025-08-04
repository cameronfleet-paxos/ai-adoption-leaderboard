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

interface CommitDetail {
  sha: string;
  message: string;
  date: string;
  url: string;
  repository: string;
}

interface LeaderboardData {
  totalCommits: number;
  claudeCommits: number;
  activeUsers: number;
  leaderboard: {
    rank: number;
    username: string;
    commits: number;
    totalCommits: number;
    claudePercentage: number;
    avatar: string;
    commitDetails: CommitDetail[];
  }[];
}

import { githubApp } from '@/lib/github-app';

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
  
  // Get installation token if installationId is provided
  let token: string | undefined;
  
  if (installationId) {
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

  try {
    let allCommits: (GitHubCommit & { repository: string })[] = [];
    
    // Use provided repositories or empty array
    const reposToFetch = repositories || [];
    
    if (reposToFetch.length === 0) {
      console.log('No repositories provided');
      return {
        totalCommits: 0,
        claudeCommits: 0,
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
        
        // Safety check to prevent infinite loops
        if (page > 10) {
          console.warn(`Stopping pagination after 10 pages for safety on ${repository.name}`);
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
    
    // Debug: Look for commits that might contain "claude" in any form
    const potentialClaudeCommits = allCommits.filter(commit => 
      commit.commit.message.toLowerCase().includes('claude')
    );
    console.log('Commits containing "claude":', potentialClaudeCommits.length);
    potentialClaudeCommits.slice(0, 5).forEach(commit => {
      console.log('Potential Claude commit:', {
        sha: commit.sha,
        author: commit.author?.login,
        message: commit.commit.message
      });
    });
    
    // Filter commits that have Claude as co-author
    const claudeCommits = allCommits.filter(commit => {
      const message = commit.commit.message;
      
      // Check for various Claude co-author formats
      const claudePatterns = [
        'Co-Authored-By: Claude <noreply@anthropic.com>',
        'Co-authored-by: Claude <noreply@anthropic.com>',
        'co-authored-by: Claude <noreply@anthropic.com>',
        'Co-Authored-By: claude <noreply@anthropic.com>',
        'Co-authored-by: claude <noreply@anthropic.com>'
      ];
      
      const hasClaudeCoAuthor = claudePatterns.some(pattern => message.includes(pattern));
      
      if (hasClaudeCoAuthor) {
        console.log('Found Claude co-authored commit:', {
          sha: commit.sha,
          author: commit.author?.login,
          message: commit.commit.message
        });
      }
      return hasClaudeCoAuthor;
    });
    
    console.log('Total commits:', allCommits.length);
    console.log('Claude co-authored commits:', claudeCommits.length);

    // Count total commits by user
    const userTotalCommits = new Map<string, number>();
    allCommits.forEach(commit => {
      if (commit.author?.login) {
        const username = commit.author.login;
        userTotalCommits.set(username, (userTotalCommits.get(username) || 0) + 1);
      }
    });

    // Count Claude commits by user and collect commit details
    const userCommits = new Map<string, { count: number; avatar: string; commits: CommitDetail[] }>();
    
    claudeCommits.forEach(commit => {
      if (commit.author?.login) {
        const username = commit.author.login;
        const existing = userCommits.get(username) || { count: 0, avatar: commit.author.avatar_url, commits: [] };
        
        // Find the repository info for this commit
        const repoInfo = reposToFetch.find(repo => repo.displayName === commit.repository);
        const repoOwner = repoInfo?.owner || 'unknown';
        const repoName = repoInfo?.name || 'unknown';
        
        const commitDetail: CommitDetail = {
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line as summary
          date: commit.commit.author.date,
          url: `https://github.com/${repoOwner}/${repoName}/commit/${commit.sha}`,
          repository: commit.repository
        };
        
        userCommits.set(username, { 
          count: existing.count + 1, 
          avatar: commit.author.avatar_url,
          commits: [...existing.commits, commitDetail]
        });
      }
    });

    // Create leaderboard
    const leaderboard = Array.from(userCommits.entries())
      .map(([username, data]) => {
        const totalCommits = userTotalCommits.get(username) || 0;
        const claudePercentage = totalCommits > 0 ? Math.round((data.count / totalCommits) * 100) : 0;
        
        return {
          username,
          commits: data.count,
          totalCommits,
          claudePercentage,
          avatar: data.avatar,
          commitDetails: data.commits
        };
      })
      .sort((a, b) => b.commits - a.commits)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry
      }));

    return {
      totalCommits: allCommits.length,
      claudeCommits: claudeCommits.length,
      activeUsers: userCommits.size,
      leaderboard
    };
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    // Return mock data on error
    return {
      totalCommits: 0,
      claudeCommits: 0,
      activeUsers: 0,
      leaderboard: []
    };
  }
}