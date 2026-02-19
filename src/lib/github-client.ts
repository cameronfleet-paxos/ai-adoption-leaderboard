/**
 * Client-side GitHub data fetching
 *
 * This module runs entirely in the browser, calling GitHub API directly.
 * No server-side code required.
 */

// Re-export types from the original github.ts
export type AITool = 'claude-coauthor' | 'claude-generated' | 'copilot' | 'cursor' | 'codex' | 'gemini';
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
  'cursor': {
    id: 'cursor',
    label: 'Cursor',
    description: 'Co-authored by Cursor AI',
    color: 'bg-cyan-500',
  },
  'codex': {
    id: 'codex',
    label: 'OpenAI Codex',
    description: 'Generated with OpenAI Codex CLI',
    color: 'bg-green-500',
  },
  'gemini': {
    id: 'gemini',
    label: 'Gemini CLI',
    description: 'Generated with Gemini CLI',
    color: 'bg-red-500',
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

export interface Repository {
  owner: string;
  name: string;
  displayName: string;
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
  'cursor': number;
  'codex': number;
  'gemini': number;
}

export interface FetchProgress {
  completedRepos: number;
  totalRepos: number;
  activeRepos: string[];    // names of repos currently being fetched (up to 3)
  commitsFetched: number;   // running total across all repos
  totalCommitsEstimate: number | null; // total across all repos, null if unknown
  phase: 'counting' | 'fetching' | 'fetching-prs' | 'analyzing';
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

export interface LeaderboardEntry {
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

export interface LeaderboardData {
  totalCommits: number;
  aiCommits: number;
  aiToolBreakdown: AIToolBreakdown;
  claudeModelBreakdown: ClaudeModelBreakdown;
  activeUsers: number;
  leaderboard: LeaderboardEntry[];
}

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

const emptyToolBreakdown = (): AIToolBreakdown => ({
  'claude-coauthor': 0,
  'claude-generated': 0,
  'copilot': 0,
  'cursor': 0,
  'codex': 0,
  'gemini': 0,
});

const emptyModelBreakdown = (): ClaudeModelBreakdown => ({
  opus: 0,
  sonnet: 0,
  haiku: 0,
  unknown: 0,
});

/**
 * Extract Claude model from co-author line
 */
function extractClaudeModel(message: string): ClaudeModel {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('claude opus')) {
    return 'opus';
  }
  if (lowerMessage.includes('claude sonnet')) {
    return 'sonnet';
  }
  if (lowerMessage.includes('claude haiku')) {
    return 'haiku';
  }

  return 'unknown';
}

/**
 * Detect AI tool used in a commit message
 */
function detectAITool(message: string): { aiTool: AITool; claudeModel?: ClaudeModel } | null {
  const lowerMessage = message.toLowerCase();

  // 1. Claude Co-author pattern
  const claudeCoAuthorRegex = /co-authored-by:\s*claude[^<]*<[^>]*@anthropic\.com>/i;
  if (claudeCoAuthorRegex.test(message)) {
    return {
      aiTool: 'claude-coauthor',
      claudeModel: extractClaudeModel(message)
    };
  }

  // 2. Generated with Claude Code pattern
  if (lowerMessage.includes('generated with [claude code]') ||
      lowerMessage.includes('generated with claude code')) {
    return {
      aiTool: 'claude-generated',
      claudeModel: 'unknown'
    };
  }

  // 3. GitHub Copilot Co-author pattern
  const copilotCoAuthorRegex = /co-authored-by:\s*copilot\s*</i;
  if (copilotCoAuthorRegex.test(message)) {
    return { aiTool: 'copilot' };
  }

  // 4. Cursor AI Co-author pattern
  const cursorCoAuthorRegex = /co-authored-by:\s*cursor\s*<[^>]*@cursor\.com>/i;
  if (cursorCoAuthorRegex.test(message)) {
    return { aiTool: 'cursor' };
  }

  return null;
}

/**
 * Run async tasks with a concurrency limit using a worker pool pattern.
 * Workers pull from a shared queue so fast repos don't block slow ones.
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workerLoop = async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => workerLoop()));
}

/** Map PR label names to AITool types */
const PR_LABEL_TO_TOOL: Record<string, AITool> = {
  'ai-claude-code': 'claude-generated',
  'ai-codex': 'codex',
  'ai-codex-cli': 'codex',
  'ai-copilot': 'copilot',
  'ai-cursor-agent': 'cursor',
  'ai-cursor-chat': 'cursor',
  'ai-gemini-cli': 'gemini',
};

const AI_PR_LABELS = Object.keys(PR_LABEL_TO_TOOL);

interface PRLabelResult {
  sha: string;
  username: string;
  aiTool: AITool;
  repo: string;
  date: string;
}

/**
 * Fetch merged PRs with AI labels and resolve their merge commit SHAs.
 */
async function fetchAILabeledPRs(
  token: string,
  repositories: Repository[],
  startDate: Date,
  endDate: Date,
  onProgress?: (msg: string) => void,
): Promise<PRLabelResult[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  const results: PRLabelResult[] = [];
  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];

  // Deduplicate by PR number per repo (a PR can match multiple labels)
  const seenPRs = new Set<string>();

  for (const repo of repositories) {
    // Search per-label since GitHub search ANDs multiple label: qualifiers
    for (const label of AI_PR_LABELS) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const q = encodeURIComponent(
          `repo:${repo.owner}/${repo.name} is:pr is:merged merged:${startISO}..${endISO} label:${label}`
        );
        const url = `https://api.github.com/search/issues?q=${q}&per_page=100&page=${page}`;

        const response = await fetch(url, { headers });
        if (!response.ok) {
          console.error(`Search API error for ${repo.name} label=${label}:`, response.status);
          break;
        }

        const data = await response.json();
        const items = data.items || [];

        // For each PR, get the merge_commit_sha
        await runWithConcurrency(items, 3, async (item: { number: number; labels: { name: string }[]; user?: { login: string } }) => {
          const prKey = `${repo.owner}/${repo.name}#${item.number}`;
          if (seenPRs.has(prKey)) return;
          seenPRs.add(prKey);

          const prUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls/${item.number}`;
          const prResponse = await fetch(prUrl, { headers });
          if (!prResponse.ok) return;

          const prData = await prResponse.json();
          const mergeSha = prData.merge_commit_sha;
          if (!mergeSha) return;

          // Find which AI label(s) are on this PR — use the first matching one
          const aiLabel = item.labels.find(l => PR_LABEL_TO_TOOL[l.name]);
          if (!aiLabel) return;

          const aiTool = PR_LABEL_TO_TOOL[aiLabel.name];
          results.push({
            sha: mergeSha,
            username: item.user?.login || prData.user?.login || '',
            aiTool,
            repo: repo.displayName,
            date: prData.merged_at || '',
          });
        });

        onProgress?.(`Scanning PRs in ${repo.displayName} (${results.length} found)`);

        hasMore = items.length === 100;
        page++;

        if (page > 10) break; // safety limit
      }
    }
  }

  return results;
}

/**
 * Fetch commit data from GitHub API (client-side)
 */
export async function fetchCommitDataClient(
  token: string,
  repositories: Repository[],
  dateRange?: { start: Date; end: Date },
  onProgress?: (progress: FetchProgress) => void
): Promise<LeaderboardData> {
  let startDate: Date;
  let endDate: Date;

  if (dateRange) {
    startDate = dateRange.start;
    endDate = dateRange.end;
  } else {
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  }

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  if (repositories.length === 0) {
    return {
      totalCommits: 0,
      aiCommits: 0,
      aiToolBreakdown: emptyToolBreakdown(),
      claudeModelBreakdown: emptyModelBreakdown(),
      activeUsers: 0,
      leaderboard: []
    };
  }

  const allCommits: (GitHubCommit & { repository: string })[] = [];

  // Phase 1: Count total commits across all repos (1 lightweight request per repo)
  let totalCommitsEstimate: number | null = null;

  onProgress?.({
    completedRepos: 0,
    totalRepos: repositories.length,
    activeRepos: [],
    commitsFetched: 0,
    totalCommitsEstimate: null,
    phase: 'counting',
  });

  try {
    const counts = await Promise.all(
      repositories.map(async (repo) => {
        const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?since=${startDate.toISOString()}&until=${endDate.toISOString()}&per_page=1`;
        const response = await fetch(url, { headers });
        if (!response.ok) return 0;
        const linkHeader = response.headers.get('link');
        if (!linkHeader) {
          // No link header means 0 or 1 commits
          const body = await response.json();
          return Array.isArray(body) ? body.length : 0;
        }
        const match = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
        return match ? parseInt(match[1], 10) : 1;
      })
    );
    totalCommitsEstimate = counts.reduce((sum, c) => sum + c, 0);
  } catch (err) {
    console.error('Failed to count commits:', err);
    // Continue without estimate
  }

  // Phase 2: Fetch commits from all repositories (3 concurrent workers)
  const activeRepoNames = new Set<string>();
  let completedRepos = 0;

  const emitFetchProgress = () => {
    onProgress?.({
      completedRepos,
      totalRepos: repositories.length,
      activeRepos: Array.from(activeRepoNames),
      commitsFetched: allCommits.length,
      totalCommitsEstimate,
      phase: 'fetching',
    });
  };

  await runWithConcurrency(repositories, 3, async (repository) => {
    activeRepoNames.add(repository.displayName);
    emitFetchProgress();

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/commits?since=${startDate.toISOString()}&until=${endDate.toISOString()}&per_page=100&page=${page}`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
          console.error(`GitHub API error for ${repository.name}:`, response.status);
          break;
        }

        const commits: GitHubCommit[] = await response.json();

        const commitsWithRepo = commits.map(commit => ({
          ...commit,
          repository: repository.displayName
        }));

        allCommits.push(...commitsWithRepo);
        emitFetchProgress();

        const linkHeader = response.headers.get('link');
        hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;
        page++;

        if (page > 500) {
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to fetch commits for ${repository.name}:`, err);
    }

    activeRepoNames.delete(repository.displayName);
    completedRepos++;
    emitFetchProgress();
  });

  onProgress?.({
    completedRepos: repositories.length,
    totalRepos: repositories.length,
    activeRepos: [],
    commitsFetched: allCommits.length,
    totalCommitsEstimate,
    phase: 'analyzing',
  });

  // Process commits
  const aiCommitsWithTool: { commit: typeof allCommits[0]; aiTool: AITool; claudeModel?: ClaudeModel }[] = [];
  const globalToolBreakdown = emptyToolBreakdown();
  const globalModelBreakdown = emptyModelBreakdown();

  allCommits.forEach(commit => {
    const detection = detectAITool(commit.commit.message);
    if (detection) {
      aiCommitsWithTool.push({ commit, ...detection });
      globalToolBreakdown[detection.aiTool]++;

      if (detection.claudeModel) {
        globalModelBreakdown[detection.claudeModel]++;
      }
    }
  });

  // Phase 3: Enrich with PR label data
  onProgress?.({
    completedRepos: repositories.length,
    totalRepos: repositories.length,
    activeRepos: [],
    commitsFetched: allCommits.length,
    totalCommitsEstimate,
    phase: 'fetching-prs',
  });

  try {
    const prResults = await fetchAILabeledPRs(
      token,
      repositories,
      startDate,
      endDate,
      (msg) => {
        onProgress?.({
          completedRepos: repositories.length,
          totalRepos: repositories.length,
          activeRepos: [msg],
          commitsFetched: allCommits.length,
          totalCommitsEstimate,
          phase: 'fetching-prs',
        });
      }
    );

    // Build set of already-detected AI commit SHAs
    const detectedSHAs = new Set(aiCommitsWithTool.map(entry => entry.commit.sha));

    // Build SHA-to-commit index for fast lookup
    const commitBySHA = new Map(allCommits.map(c => [c.sha, c]));

    for (const pr of prResults) {
      if (detectedSHAs.has(pr.sha)) continue; // already detected, skip

      const commit = commitBySHA.get(pr.sha);
      if (!commit) continue; // merge commit not in our fetched commits

      aiCommitsWithTool.push({ commit, aiTool: pr.aiTool });
      globalToolBreakdown[pr.aiTool]++;
      detectedSHAs.add(pr.sha);
    }
  } catch (err) {
    console.error('Failed to fetch AI-labeled PRs:', err);
    // Continue without PR label data
  }

  // Count total commits by user and collect all commit dates
  const userTotalCommits = new Map<string, number>();
  const userAllCommitDates = new Map<string, string[]>();
  allCommits.forEach(commit => {
    if (commit.author?.login) {
      const username = commit.author.login;
      userTotalCommits.set(username, (userTotalCommits.get(username) || 0) + 1);
      const dates = userAllCommitDates.get(username) || [];
      dates.push(commit.commit.author.date);
      userAllCommitDates.set(username, dates);
    }
  });

  // Count AI commits by user
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
        aiToolBreakdown: emptyToolBreakdown(),
        claudeModelBreakdown: emptyModelBreakdown()
      };

      const repoInfo = repositories.find(repo => repo.displayName === commit.repository);
      const repoOwner = repoInfo?.owner || 'unknown';
      const repoName = repoInfo?.name || 'unknown';

      const commitDetail: CommitDetail = {
        sha: commit.sha,
        message: commit.commit.message.split('\n')[0],
        date: commit.commit.author.date,
        url: `https://github.com/${repoOwner}/${repoName}/commit/${commit.sha}`,
        repository: commit.repository,
        aiTool,
        claudeModel
      };

      const updatedToolBreakdown = { ...existing.aiToolBreakdown };
      updatedToolBreakdown[aiTool]++;

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

  // Build avatar lookup from all commits
  const userAvatars = new Map<string, string>();
  allCommits.forEach(commit => {
    if (commit.author?.login && commit.author.avatar_url && !userAvatars.has(commit.author.login)) {
      userAvatars.set(commit.author.login, commit.author.avatar_url);
    }
  });

  // Create leaderboard from ALL users (not just AI users)
  const leaderboard = Array.from(userTotalCommits.entries())
    .map(([username, totalCommits]) => {
      const aiData = userCommits.get(username);
      const avatar = aiData?.avatar || userAvatars.get(username) || '';
      const aiCount = aiData?.count || 0;
      const aiPercentage = totalCommits > 0 ? Math.round((aiCount / totalCommits) * 100) : 0;

      return {
        username,
        commits: aiCount,
        totalCommits,
        aiPercentage,
        avatar,
        commitDetails: aiData?.commits || [],
        allCommitDates: userAllCommitDates.get(username) || [],
        aiToolBreakdown: aiData?.aiToolBreakdown || emptyToolBreakdown(),
        claudeModelBreakdown: aiData?.claudeModelBreakdown || emptyModelBreakdown(),
      };
    })
    .sort((a, b) => {
      // Primary: AI commits descending (AI users first)
      if (b.commits !== a.commits) return b.commits - a.commits;
      // Secondary: total commits descending
      return b.totalCommits - a.totalCommits;
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));

  return {
    totalCommits: allCommits.length,
    aiCommits: aiCommitsWithTool.length,
    aiToolBreakdown: globalToolBreakdown,
    claudeModelBreakdown: globalModelBreakdown,
    activeUsers: userTotalCommits.size,
    leaderboard
  };
}


/**
 * Fetch user info from GitHub API
 */
export async function fetchUserClient(token: string): Promise<{ login: string; avatar_url: string; name: string | null }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

/**
 * Validate a GitHub token
 */
export async function validateTokenClient(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

