/**
 * Client-side GitHub data fetching
 *
 * This module runs entirely in the browser, calling GitHub API directly.
 * No server-side code required.
 */

// Re-export types from the original github.ts
export type AITool = 'claude-coauthor' | 'claude-generated' | 'copilot' | 'cursor' | 'codex' | 'gemini' | 'agent';
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
  'agent': {
    id: 'agent',
    label: 'AI Agent',
    description: 'Commits from AI agent users',
    color: 'bg-orange-500',
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

export interface PRLabelEntry {
  label: string;
  aiTool: AITool;
  enabled: boolean;
  isDefault: boolean;
}

export interface PRLabelConfig {
  labels: PRLabelEntry[];
  labelScanRepos: string[];
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
  'agent': number;
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

// --- Productivity Metrics Types ---

export type PRCategory = 'human' | 'ai-assisted' | 'agent';

export interface PRMetricsRaw {
  number: number;
  repo: string;
  author: string;
  title: string;
  mergedAt: string;
  firstCommitDate: string;
  additions: number;
  deletions: number;
  reviewRounds: number;
  reviewComments: number;
  isRevert: boolean;
  category: PRCategory;
  isLookback?: boolean;
}

export interface ExtremePR {
  value: number;
  number: number;
  repo: string;
  title: string;
}

export interface PercentileStats {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  min?: ExtremePR;
  max?: ExtremePR;
}

export interface BucketMetrics {
  prCount: number;
  cycleTime: PercentileStats;
  prSize: PercentileStats;
  reviewRounds: PercentileStats;
  revertRate: number;
  reviewComments: PercentileStats;
}

export interface ProductivityMetrics {
  human: BucketMetrics;
  aiAssisted: BucketMetrics;
  agent: BucketMetrics;
  totalPRsAnalyzed: number;
  prs: PRMetricsRaw[];
}

export interface ProductivityFetchProgress {
  phase: 'listing-prs' | 'fetching-details' | 'computing';
  completedPRs: number;
  totalPRs: number;
  completedRepos?: number;
  totalRepos?: number;
  activeRepos?: string[];
}

// --- End Productivity Metrics Types ---

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

// --- In-memory single-entry cache for leaderboard data ---
export type CommitWithRepo = GitHubCommit & { repository: string };

interface LeaderboardCacheEntry {
  reposKey: string;
  labelKey: string;
  startDate: Date;
  endDate: Date;
  allCommits: CommitWithRepo[];
  prResults: PRLabelResult[];
  repositories: Repository[];
}

let leaderboardCache: LeaderboardCacheEntry | null = null;

function computeReposKey(repos: Repository[]): string {
  return repos.map(r => `${r.owner}/${r.name}`).sort().join(',');
}

function computeLabelKey(labelConfig: PRLabelConfig | undefined): string {
  if (!labelConfig) return 'default';
  const activeLabels = labelConfig.labels
    .filter(l => l.enabled)
    .map(l => `${l.label}:${l.aiTool}`)
    .sort()
    .join(',');
  const scanRepos = [...labelConfig.labelScanRepos].sort().join(',');
  return `${activeLabels}|${scanRepos}`;
}

/** Clear the in-memory leaderboard cache (e.g. for a manual refresh). */
export function clearLeaderboardCache(): void {
  leaderboardCache = null;
}

/**
 * Build LeaderboardData from raw commits and PR results.
 * Pure computation — no API calls.
 */
function analyzeCommits(
  allCommits: CommitWithRepo[],
  prResults: PRLabelResult[],
  repositories: Repository[],
): LeaderboardData {
  const aiCommitsWithTool: { commit: CommitWithRepo; aiTool: AITool; claudeModel?: ClaudeModel }[] = [];
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

  // Enrich with PR label data
  const detectedSHAs = new Set(aiCommitsWithTool.map(entry => entry.commit.sha));
  const commitBySHA = new Map(allCommits.map(c => [c.sha, c]));

  for (const pr of prResults) {
    if (detectedSHAs.has(pr.sha)) continue;
    const commit = commitBySHA.get(pr.sha);
    if (!commit) continue;
    aiCommitsWithTool.push({ commit, aiTool: pr.aiTool });
    globalToolBreakdown[pr.aiTool]++;
    detectedSHAs.add(pr.sha);
  }

  // Agent detection
  {
    const agentUserSHAs = new Set<string>();
    for (const commit of allCommits) {
      const username = commit.author?.login;
      if (username && username.endsWith('-agent[bot]')) {
        agentUserSHAs.add(commit.sha);
      }
    }

    for (const entry of aiCommitsWithTool) {
      if (agentUserSHAs.has(entry.commit.sha) && entry.aiTool !== 'agent') {
        globalToolBreakdown[entry.aiTool]--;
        entry.aiTool = 'agent';
        entry.claudeModel = undefined;
        globalToolBreakdown['agent']++;
        agentUserSHAs.delete(entry.commit.sha);
      }
    }

    for (const commit of allCommits) {
      if (agentUserSHAs.has(commit.sha)) {
        aiCommitsWithTool.push({ commit, aiTool: 'agent' });
        globalToolBreakdown['agent']++;
      }
    }
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
      if (b.commits !== a.commits) return b.commits - a.commits;
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

const emptyToolBreakdown = (): AIToolBreakdown => ({
  'claude-coauthor': 0,
  'claude-generated': 0,
  'copilot': 0,
  'cursor': 0,
  'codex': 0,
  'gemini': 0,
  'agent': 0,
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

  // 5. Codex Co-author pattern
  const codexCoAuthorRegex = /co-authored-by:\s*codex\s*<[^>]*@openai\.com>/i;
  if (codexCoAuthorRegex.test(message)) {
    return { aiTool: 'codex' };
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
export const DEFAULT_PR_LABEL_TO_TOOL: Record<string, AITool> = {
  'ai-claude-code': 'claude-generated',
  'ai-codex': 'codex',
  'ai-codex-cli': 'codex',
  'ai-copilot': 'copilot',
  'ai-cursor-agent': 'cursor',
  'ai-cursor-chat': 'cursor',
  'ai-gemini-cli': 'gemini',
};

const AI_PR_LABELS = Object.keys(DEFAULT_PR_LABEL_TO_TOOL);

export function getDefaultPRLabelConfig(selectedRepos: string[]): PRLabelConfig {
  return {
    labels: Object.entries(DEFAULT_PR_LABEL_TO_TOOL).map(([label, aiTool]) => ({
      label,
      aiTool,
      enabled: true,
      isDefault: true,
    })),
    labelScanRepos: selectedRepos,
  };
}

interface PRScanProgress {
  currentRepo: string;
  completedLabels: number;
  totalLabels: number;
  prsFound: number;
  status?: string;
}

export interface PRLabelResult {
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
  onProgress?: (progress: PRScanProgress) => void,
  labelConfig?: PRLabelConfig,
): Promise<PRLabelResult[]> {
  // Build active label map from config or use defaults
  const activeLabelMap: Record<string, AITool> = {};
  if (labelConfig) {
    for (const entry of labelConfig.labels) {
      if (entry.enabled) activeLabelMap[entry.label] = entry.aiTool;
    }
  } else {
    Object.assign(activeLabelMap, DEFAULT_PR_LABEL_TO_TOOL);
  }
  const activeLabels = Object.keys(activeLabelMap);
  if (activeLabels.length === 0) return [];

  const reposToScan = labelConfig
    ? repositories.filter(r => labelConfig.labelScanRepos.includes(r.name))
    : repositories;
  if (reposToScan.length === 0) return [];

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  const results: PRLabelResult[] = [];
  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];

  // Deduplicate by PR number per repo (a PR can match multiple labels)
  const seenPRs = new Set<string>();

  // Track search API calls to proactively throttle (GitHub allows 30/min)
  let searchCallTimestamps: number[] = [];

  const throttleSearchAPI = async () => {
    const now = Date.now();
    // Remove timestamps older than 60s
    searchCallTimestamps = searchCallTimestamps.filter(t => now - t < 60000);
    // If we've made 28+ calls in the last 60s, wait until the oldest one ages out
    if (searchCallTimestamps.length >= 28) {
      const oldestInWindow = searchCallTimestamps[0];
      const waitMs = 60000 - (now - oldestInWindow) + 1000;
      if (waitMs > 0) {
        const totalSecs = Math.ceil(waitMs / 1000);
        for (let remaining = totalSecs; remaining > 0; remaining--) {
          onProgress?.({
            currentRepo: currentRepoName,
            completedLabels: currentCompletedLabels,
            totalLabels: activeLabels.length,
            prsFound: results.length,
            status: `Throttling to avoid rate limit... ${remaining}s`,
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    searchCallTimestamps.push(Date.now());
  };

  // Countdown wait helper — ticks every second so the UI updates in real time
  const countdownWait = async (waitMs: number, reason: string) => {
    const totalSecs = Math.ceil(waitMs / 1000);
    for (let remaining = totalSecs; remaining > 0; remaining--) {
      onProgress?.({
        currentRepo: currentRepoName,
        completedLabels: currentCompletedLabels,
        totalLabels: activeLabels.length,
        prsFound: results.length,
        status: `${reason} ${remaining}s`,
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  let currentRepoName = '';
  let currentCompletedLabels = 0;

  for (const repo of reposToScan) {
    currentCompletedLabels = 0;
    currentRepoName = repo.displayName;

    // Search per-label since GitHub search ANDs multiple label: qualifiers
    for (const label of activeLabels) {
      onProgress?.({
        currentRepo: repo.displayName,
        completedLabels: currentCompletedLabels,
        totalLabels: activeLabels.length,
        prsFound: results.length,
      });

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const q = encodeURIComponent(
          `repo:${repo.owner}/${repo.name} is:pr is:merged merged:${startISO}..${endISO} label:${label}`
        );
        const url = `https://api.github.com/search/issues?q=${q}&per_page=100&page=${page}`;

        // Proactively throttle to stay under 30 req/min
        await throttleSearchAPI();

        let response = await fetch(url, { headers });

        // Rate limit handling: retry once after countdown wait
        if (response.status === 403 || response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const resetHeader = response.headers.get('x-ratelimit-reset');
          let waitMs = 10000; // default 10s
          if (retryAfter) {
            waitMs = parseInt(retryAfter, 10) * 1000;
          } else if (resetHeader) {
            waitMs = Math.max(0, parseInt(resetHeader, 10) * 1000 - Date.now()) + 1000;
          }
          await countdownWait(waitMs, 'Rate limited, retrying in');
          response = await fetch(url, { headers });
        }

        if (!response.ok) {
          console.warn(`Search API error for ${repo.name} label=${label}:`, response.status);
          break; // skip remaining pages for this label, continue to next label
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
          const aiLabel = item.labels.find(l => activeLabelMap[l.name]);
          if (!aiLabel) return;

          const aiTool = activeLabelMap[aiLabel.name];
          results.push({
            sha: mergeSha,
            username: item.user?.login || prData.user?.login || '',
            aiTool,
            repo: repo.displayName,
            date: prData.merged_at || '',
          });
        });

        onProgress?.({
          currentRepo: repo.displayName,
          completedLabels: currentCompletedLabels,
          totalLabels: activeLabels.length,
          prsFound: results.length,
        });

        hasMore = items.length === 100;
        page++;

        if (page > 10) break; // safety limit
      }

      currentCompletedLabels++;
    }
  }

  return results;
}

/**
 * Fetch commit data from GitHub API (client-side)
 */
export interface CachedDataInput {
  commits: Record<string, Array<{
    sha: string;
    repository: string;
    authorLogin: string | null;
    authorAvatarUrl: string | null;
    authorName: string;
    authorEmail: string;
    authorDate: string;
    message: string;
  }>>;
  prLabels: Record<string, Array<{
    sha: string;
    username: string;
    aiTool: string;
    repo: string;
    date: string;
  }>>;
  coverage: Record<string, {
    commits: { earliest: string | null; latest: string | null; gaps: Array<{ start: string; end: string }> };
    prLabels: { earliest: string | null; latest: string | null; gaps: Array<{ start: string; end: string }> };
  }>;
}

export async function fetchCommitDataClient(
  token: string,
  repositories: Repository[],
  dateRange?: { start: Date; end: Date },
  onProgress?: (progress: FetchProgress) => void,
  labelConfig?: PRLabelConfig,
  cachedData?: CachedDataInput,
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

  const reposKey = computeReposKey(repositories);
  const labelKey = computeLabelKey(labelConfig);

  // Check cache: exact match or subset interval
  if (leaderboardCache && leaderboardCache.reposKey === reposKey && leaderboardCache.labelKey === labelKey) {
    if (startDate >= leaderboardCache.startDate && endDate <= leaderboardCache.endDate) {
      // Cached data covers this interval — filter and re-analyze
      const filteredCommits = leaderboardCache.allCommits.filter(c => {
        const d = new Date(c.commit.author.date);
        return d >= startDate && d <= endDate;
      });
      const filteredPRs = leaderboardCache.prResults.filter(pr => {
        if (!pr.date) return false;
        const d = new Date(pr.date);
        return d >= startDate && d <= endDate;
      });
      return analyzeCommits(filteredCommits, filteredPRs, leaderboardCache.repositories);
    }
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

  const allCommits: CommitWithRepo[] = [];

  // Helper: convert cached commit to CommitWithRepo
  const cachedToCommitWithRepo = (c: CachedDataInput['commits'][string][number]): CommitWithRepo => ({
    sha: c.sha,
    repository: c.repository,
    commit: {
      author: { name: c.authorName, email: c.authorEmail, date: c.authorDate },
      message: c.message,
    },
    author: c.authorLogin ? { login: c.authorLogin, avatar_url: c.authorAvatarUrl || '' } : null,
  });

  // Determine which repos need fetching vs are fully cached
  const reposToFetch: Repository[] = [];
  const repoGaps = new Map<string, Array<{ start: string; end: string }>>();

  for (const repo of repositories) {
    const repoKey = `${repo.owner}/${repo.name}`;
    const coverage = cachedData?.coverage?.[repoKey];

    if (coverage && coverage.commits.gaps.length === 0) {
      // Full cache hit — use cached commits directly
      const cached = cachedData.commits[repoKey] || [];
      allCommits.push(...cached.map(cachedToCommitWithRepo));
    } else {
      reposToFetch.push(repo);
      if (coverage && coverage.commits.gaps.length > 0) {
        repoGaps.set(repoKey, coverage.commits.gaps);
        // Also include cached commits for this repo (partial hit)
        const cached = cachedData?.commits?.[repoKey] || [];
        allCommits.push(...cached.map(cachedToCommitWithRepo));
      }
    }
  }

  // Phase 1: Count total commits across repos that need fetching
  let totalCommitsEstimate: number | null = null;

  if (reposToFetch.length > 0) {
    onProgress?.({
      completedRepos: 0,
      totalRepos: repositories.length,
      activeRepos: [],
      commitsFetched: allCommits.length,
      totalCommitsEstimate: null,
      phase: 'counting',
    });

    try {
      const counts = await Promise.all(
        reposToFetch.map(async (repo) => {
          const repoKey = `${repo.owner}/${repo.name}`;
          const gaps = repoGaps.get(repoKey);

          if (gaps && gaps.length > 0) {
            // Count only gap ranges
            let total = 0;
            for (const gap of gaps) {
              const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?since=${new Date(gap.start).toISOString()}&until=${new Date(gap.end).toISOString()}&per_page=1`;
              const response = await fetch(url, { headers });
              if (!response.ok) continue;
              const linkHeader = response.headers.get('link');
              if (!linkHeader) {
                const body = await response.json();
                total += Array.isArray(body) ? body.length : 0;
              } else {
                const match = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
                total += match ? parseInt(match[1], 10) : 1;
              }
            }
            return total;
          }

          const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?since=${startDate.toISOString()}&until=${endDate.toISOString()}&per_page=1`;
          const response = await fetch(url, { headers });
          if (!response.ok) return 0;
          const linkHeader = response.headers.get('link');
          if (!linkHeader) {
            const body = await response.json();
            return Array.isArray(body) ? body.length : 0;
          }
          const match = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
          return match ? parseInt(match[1], 10) : 1;
        })
      );
      totalCommitsEstimate = counts.reduce((sum, c) => sum + c, 0) + allCommits.length;
    } catch (err) {
      console.warn('Failed to count commits:', err);
    }
  } else {
    // All repos fully cached — skip counting phase
    totalCommitsEstimate = allCommits.length;
  }

  // Phase 2: Fetch commits from repos that need fetching (3 concurrent workers)
  const activeRepoNames = new Set<string>();
  let completedRepos = repositories.length - reposToFetch.length;

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

  if (reposToFetch.length > 0) {
    await runWithConcurrency(reposToFetch, 3, async (repository) => {
      activeRepoNames.add(repository.displayName);
      emitFetchProgress();

      const repoKey = `${repository.owner}/${repository.name}`;
      const gaps = repoGaps.get(repoKey);

      // Determine date ranges to fetch
      const ranges = gaps && gaps.length > 0
        ? gaps.map(g => ({ since: new Date(g.start), until: new Date(g.end) }))
        : [{ since: startDate, until: endDate }];

      // Track SHAs already loaded from cache to avoid duplicates
      const existingSHAs = new Set(allCommits.filter(c => c.repository === repository.displayName).map(c => c.sha));

      for (const range of ranges) {
        try {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/commits?since=${range.since.toISOString()}&until=${range.until.toISOString()}&per_page=100&page=${page}`;

            const response = await fetch(url, { headers });

            if (!response.ok) {
              console.warn(`GitHub API error for ${repository.name}:`, response.status);
              break;
            }

            const commits: GitHubCommit[] = await response.json();

            const commitsWithRepo = commits
              .filter(c => !existingSHAs.has(c.sha))
              .map(commit => ({
                ...commit,
                repository: repository.displayName
              }));

            for (const c of commitsWithRepo) existingSHAs.add(c.sha);
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
          console.warn(`Failed to fetch commits for ${repository.name}:`, err);
        }
      }

      activeRepoNames.delete(repository.displayName);
      completedRepos++;
      emitFetchProgress();
    });
  }

  onProgress?.({
    completedRepos: repositories.length,
    totalRepos: repositories.length,
    activeRepos: [],
    commitsFetched: allCommits.length,
    totalCommitsEstimate,
    phase: 'analyzing',
  });

  // Phase 3: Fetch PR label data
  // Check which repos have full PR label cache coverage
  let prResults: PRLabelResult[] = [];

  // Collect cached PR labels
  if (cachedData?.prLabels) {
    for (const repoKey of Object.keys(cachedData.prLabels)) {
      const coverage = cachedData.coverage?.[repoKey];
      if (coverage && coverage.prLabels.gaps.length === 0) {
        // Full hit — use cached PR labels
        const cachedItems = cachedData.prLabels[repoKey] || [];
        prResults.push(...cachedItems.map(item => ({
          sha: item.sha,
          username: item.username,
          aiTool: item.aiTool as AITool,
          repo: item.repo,
          date: item.date,
        })));
      }
    }
  }

  // Determine which repos still need PR label scanning
  const prLabelReposToFetch = repositories.filter(repo => {
    const repoKey = `${repo.owner}/${repo.name}`;
    const coverage = cachedData?.coverage?.[repoKey];
    return !coverage || coverage.prLabels.gaps.length > 0;
  });

  if (prLabelReposToFetch.length > 0) {
    onProgress?.({
      completedRepos: repositories.length,
      totalRepos: repositories.length,
      activeRepos: [],
      commitsFetched: allCommits.length,
      totalCommitsEstimate,
      phase: 'fetching-prs',
    });

    try {
      const freshPRResults = await fetchAILabeledPRs(
        token,
        prLabelReposToFetch,
        startDate,
        endDate,
        (prProgress) => {
          onProgress?.({
            completedRepos: repositories.length,
            totalRepos: repositories.length,
            activeRepos: [
              prProgress.status ||
              `${prProgress.currentRepo}: label ${prProgress.completedLabels}/${prProgress.totalLabels} (${prProgress.prsFound} PRs found)`
            ],
            commitsFetched: allCommits.length,
            totalCommitsEstimate,
            phase: 'fetching-prs',
          });
        },
        labelConfig,
      );
      prResults.push(...freshPRResults);
    } catch (err) {
      console.error('Failed to fetch AI-labeled PRs:', err);
    }
  }

  // Store raw data in cache for future subset queries
  leaderboardCache = {
    reposKey,
    labelKey,
    startDate,
    endDate,
    allCommits,
    prResults,
    repositories,
  };

  const result = analyzeCommits(allCommits, prResults, repositories);
  return Object.assign(result, { _rawCommits: allCommits, _rawPRResults: prResults });
}


// --- Productivity Metrics Helpers ---

function computePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) return { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (arr: number[], p: number) => {
    const idx = (p / 100) * (arr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return arr[lower];
    return arr[lower] + (arr[upper] - arr[lower]) * (idx - lower);
  };
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    median: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

export function categorizePR(
  prAuthor: string,
  commitSHAs: string[],
  commitMessages: string[],
  aiCommitSHAs: Set<string>,
  agentUsernames: Set<string>,
): PRCategory {
  // Agent: PR author ends with -agent[bot] or is in agentUsernames
  if (prAuthor.endsWith('-agent[bot]') || agentUsernames.has(prAuthor)) {
    return 'agent';
  }

  // AI-assisted: any commit SHA is in aiCommitSHAs or detectAITool matches a commit message
  for (const sha of commitSHAs) {
    if (aiCommitSHAs.has(sha)) return 'ai-assisted';
  }
  for (const msg of commitMessages) {
    if (detectAITool(msg) !== null) return 'ai-assisted';
  }

  return 'human';
}

function emptyBucketMetrics(): BucketMetrics {
  return {
    prCount: 0,
    cycleTime: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 },
    prSize: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 },
    reviewRounds: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 },
    revertRate: 0,
    reviewComments: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 },
  };
}

function findExtremes(values: number[], prs: PRMetricsRaw[]): { min: ExtremePR; max: ExtremePR } {
  let minIdx = 0, maxIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[minIdx]) minIdx = i;
    if (values[i] > values[maxIdx]) maxIdx = i;
  }
  const toExtreme = (idx: number): ExtremePR => ({
    value: values[idx],
    number: prs[idx].number,
    repo: prs[idx].repo,
    title: prs[idx].title,
  });
  return { min: toExtreme(minIdx), max: toExtreme(maxIdx) };
}

function computeBucketMetrics(prs: PRMetricsRaw[]): BucketMetrics {
  if (prs.length === 0) return emptyBucketMetrics();

  const cycleTimes = prs.map(pr => {
    const first = new Date(pr.firstCommitDate).getTime();
    const merged = new Date(pr.mergedAt).getTime();
    return Math.max(0, (merged - first) / (1000 * 60 * 60)); // hours
  });

  const sizes = prs.map(pr => pr.additions + pr.deletions);
  const rounds = prs.map(pr => pr.reviewRounds);
  const comments = prs.map(pr => pr.reviewComments);
  const reverts = prs.filter(pr => pr.isRevert).length;

  const withExtremes = (values: number[]): PercentileStats => {
    const stats = computePercentiles(values);
    const extremes = findExtremes(values, prs);
    return { ...stats, min: extremes.min, max: extremes.max };
  };

  return {
    prCount: prs.length,
    cycleTime: withExtremes(cycleTimes),
    prSize: withExtremes(sizes),
    reviewRounds: withExtremes(rounds),
    revertRate: prs.length > 0 ? Math.round((reverts / prs.length) * 1000) / 10 : 0,
    reviewComments: withExtremes(comments),
  };
}

const PR_CAP = 20000;

/**
 * Batch-fetch PR details using GitHub GraphQL API.
 * Fetches additions, deletions, review comments, commits (first date + messages/SHAs),
 * and reviews in a single request per batch of up to 10 PRs.
 */
async function fetchPRDetailsBatchGraphQL(
  token: string,
  prs: Array<{ number: number; repo: Repository }>,
): Promise<Map<string, {
  additions: number;
  deletions: number;
  reviewComments: number;
  firstCommitDate: string | null;
  commitSHAs: string[];
  commitMessages: string[];
  reviewRounds: number;
}>> {
  // Build a GraphQL query that fetches all PRs in one request
  const fragments = prs.map((pr, i) => `
    pr${i}: repository(owner: "${pr.repo.owner}", name: "${pr.repo.name}") {
      pullRequest(number: ${pr.number}) {
        additions
        deletions
        reviewThreads(first: 100) {
          nodes {
            comments { totalCount }
          }
        }
        reviews(first: 50) {
          nodes { state author { ... on User { __typename } ... on Bot { __typename } } }
        }
        commits(first: 100) {
          nodes {
            commit {
              oid
              message
              authoredDate
            }
          }
        }
      }
    }`).join('\n');

  const query = `query { ${fragments} }`;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const results = new Map<string, {
    additions: number;
    deletions: number;
    reviewComments: number;
    firstCommitDate: string | null;
    commitSHAs: string[];
    commitMessages: string[];
    reviewRounds: number;
  }>();

  if (!response.ok) {
    console.warn('GraphQL API error:', response.status);
    return results;
  }

  const json = await response.json();
  if (json.errors) {
    console.warn('GraphQL partial errors (some PRs may be inaccessible):', json.errors.length, 'errors');
  }

  const data = json.data || {};

  for (let i = 0; i < prs.length; i++) {
    const prData = data[`pr${i}`]?.pullRequest;
    if (!prData) continue;

    const key = `${prs[i].repo.owner}/${prs[i].repo.name}#${prs[i].number}`;

    // Parse commits
    const commitNodes = prData.commits?.nodes || [];
    const commitSHAs: string[] = [];
    const commitMessages: string[] = [];
    let firstCommitDate: string | null = null;

    if (commitNodes.length > 0) {
      // Sort by date ascending
      const sorted = [...commitNodes].sort((a: { commit: { authoredDate: string } }, b: { commit: { authoredDate: string } }) =>
        new Date(a.commit.authoredDate).getTime() - new Date(b.commit.authoredDate).getTime()
      );
      firstCommitDate = sorted[0].commit.authoredDate;
      for (const node of commitNodes) {
        commitSHAs.push(node.commit.oid);
        commitMessages.push(node.commit.message || '');
      }
    }

    // Parse reviews — count CHANGES_REQUESTED + APPROVED, excluding bots/dismissed
    let reviewRounds = 0;
    const reviewNodes = prData.reviews?.nodes || [];
    for (const review of reviewNodes) {
      if (review.state === 'DISMISSED') continue;
      if (review.author?.__typename === 'Bot') continue;
      if (review.state === 'CHANGES_REQUESTED' || review.state === 'APPROVED') {
        reviewRounds++;
      }
    }

    results.set(key, {
      additions: prData.additions || 0,
      deletions: prData.deletions || 0,
      reviewComments: (prData.reviewThreads?.nodes || []).reduce(
        (sum: number, thread: { comments?: { totalCount?: number } }) =>
          sum + (thread.comments?.totalCount || 0),
        0,
      ),
      firstCommitDate,
      commitSHAs,
      commitMessages,
      reviewRounds,
    });
  }

  return results;
}

/**
 * Fetch productivity metrics from merged PRs, categorized into human/ai-assisted/agent buckets.
 */
export interface CachedPRDetailInput {
  number: number;
  repo: string;
  author: string;
  title: string;
  mergedAt: string;
  firstCommitDate: string;
  additions: number;
  deletions: number;
  reviewRounds: number;
  reviewComments: number;
  isRevert: boolean;
  commitSHAs: string[];
  commitMessages: string[];
}

export interface CachedMergedPRInput {
  number: number;
  repoOwner: string;
  repoName: string;
  repoDisplayName: string;
  author: string;
  title: string;
  body: string;
  mergedAt: string;
}

export interface ProductivityCacheInput {
  prDetails?: Map<string, CachedPRDetailInput>;
  mergedPRs?: Record<string, CachedMergedPRInput[]>;
  coverage?: Record<string, { mergedPRs: { gaps: Array<{ start: string; end: string }> } }>;
}

export async function fetchProductivityMetrics(
  token: string,
  repositories: Repository[],
  dateRange: { start: Date; end: Date },
  aiCommitSHAs: Set<string>,
  agentUsernames: Set<string>,
  onProgress?: (progress: ProductivityFetchProgress) => void,
  cachedPRDetails?: Map<string, CachedPRDetailInput>,
  boostLookbackDays: number = 90,
  cachedProductivity?: ProductivityCacheInput,
): Promise<ProductivityMetrics> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  const startDate = dateRange.start;
  const endDate = dateRange.end;

  // For the AI Productivity Boost card, we need "before" data for engineers
  // who adopted AI near the start of the date range. Fetch extra lookback PRs.
  const lookbackStart = new Date(startDate);
  lookbackStart.setDate(lookbackStart.getDate() - boostLookbackDays);

  // Phase 1: List merged PRs per repo
  const allPRs: Array<{
    number: number;
    repo: Repository;
    author: string;
    title: string;
    body: string;
    mergedAt: string;
    isLookback: boolean;
  }> = [];

  // Load cached merged PR listings
  const reposToListPRs: Repository[] = [];
  const repoMergedPRGaps = new Map<string, Array<{ start: string; end: string }>>();
  for (const repo of repositories) {
    const repoKey = `${repo.owner}/${repo.name}`;
    const coverage = cachedProductivity?.coverage?.[repoKey];
    const cached = cachedProductivity?.mergedPRs?.[repoKey];

    // Always load cached items if available
    if (cached) {
      const seenNumbers = new Set<number>();
      for (const pr of cached) {
        if (seenNumbers.has(pr.number)) continue;
        seenNumbers.add(pr.number);
        const mergedDate = new Date(pr.mergedAt);
        allPRs.push({
          number: pr.number,
          repo: { owner: pr.repoOwner, name: pr.repoName, displayName: pr.repoDisplayName },
          author: pr.author,
          title: pr.title,
          body: pr.body,
          mergedAt: pr.mergedAt,
          isLookback: mergedDate < startDate,
        });
      }
    }

    if (!coverage || coverage.mergedPRs.gaps.length > 0) {
      reposToListPRs.push(repo);
      if (coverage) {
        repoMergedPRGaps.set(repoKey, coverage.mergedPRs.gaps);
      }
    }
  }

  const activeRepoNames = new Set<string>();
  let completedRepos = repositories.length - reposToListPRs.length;

  const emitListProgress = () => {
    onProgress?.({
      phase: 'listing-prs',
      completedPRs: allPRs.length,
      totalPRs: allPRs.length,
      completedRepos,
      totalRepos: repositories.length,
      activeRepos: Array.from(activeRepoNames),
    });
  };

  emitListProgress();

  // Track existing PR numbers per repo to dedup with cached
  const existingPRKeys = new Set(allPRs.map(pr => `${pr.repo.owner}/${pr.repo.name}#${pr.number}`));

  if (reposToListPRs.length > 0) {
    // Track search API calls for rate limiting (30/min for search)
    let searchTimestamps: number[] = [];
    const throttleSearch = async () => {
      const now = Date.now();
      searchTimestamps = searchTimestamps.filter(t => now - t < 60000);
      if (searchTimestamps.length >= 28) {
        const oldest = searchTimestamps[0];
        const waitMs = 60000 - (now - oldest) + 1000;
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
      }
      searchTimestamps.push(Date.now());
    };

    // Use Search API — returns only merged PRs in date range, much more efficient.
    // Search API caps at 1000 results per query, so split large ranges into monthly chunks.

    // Helper: search one date range for a repo
    const searchMergedPRs = async (repo: Repository, rangeStart: string, rangeEnd: string) => {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const q = encodeURIComponent(
          `repo:${repo.owner}/${repo.name} is:pr is:merged merged:${rangeStart}..${rangeEnd}`
        );
        const url = `https://api.github.com/search/issues?q=${q}&per_page=100&page=${page}&sort=updated&order=desc`;

        await throttleSearch();
        let response = await fetch(url, { headers });

        // Rate limit retry
        if (response.status === 403 || response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const resetHeader = response.headers.get('x-ratelimit-reset');
          let waitMs = 10000;
          if (retryAfter) {
            waitMs = parseInt(retryAfter, 10) * 1000;
          } else if (resetHeader) {
            waitMs = Math.max(0, parseInt(resetHeader, 10) * 1000 - Date.now()) + 1000;
          }
          await new Promise(r => setTimeout(r, Math.min(waitMs, 60000)));
          response = await fetch(url, { headers });
        }

        if (!response.ok) {
          console.warn(`Search API error listing PRs for ${repo.name}:`, response.status);
          break;
        }

        const data = await response.json();
        const items = data.items || [];

        for (const pr of items) {
          const mergedAt = pr.pull_request?.merged_at;
          if (!mergedAt) continue;

          const prKey = `${repo.owner}/${repo.name}#${pr.number}`;
          if (existingPRKeys.has(prKey)) continue;
          existingPRKeys.add(prKey);

          const mergedDate = new Date(mergedAt);

          allPRs.push({
            number: pr.number,
            repo,
            author: pr.user?.login || '',
            title: pr.title || '',
            body: pr.body || '',
            mergedAt,
            isLookback: mergedDate < startDate,
          });
        }

        emitListProgress();

        hasMore = items.length === 100;
        page++;
        if (page > 10) break; // Search API max 1000 results per query
      }
    };

    // Build monthly date chunks to avoid 1000 result cap
    const buildMonthlyChunks = (from: Date, to: Date): Array<{ start: string; end: string }> => {
      const chunks: Array<{ start: string; end: string }> = [];
      const cursor = new Date(from);
      cursor.setDate(1); // start of month
      while (cursor < to) {
        const chunkStart = new Date(Math.max(cursor.getTime(), from.getTime()));
        const nextMonth = new Date(cursor);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const chunkEnd = new Date(Math.min(nextMonth.getTime(), to.getTime()));
        chunks.push({
          start: chunkStart.toISOString().split('T')[0],
          end: chunkEnd.toISOString().split('T')[0],
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return chunks;
    };

    await runWithConcurrency(reposToListPRs, 3, async (repo) => {
      activeRepoNames.add(repo.displayName);
      emitListProgress();

      const repoKey = `${repo.owner}/${repo.name}`;
      const gaps = repoMergedPRGaps.get(repoKey);

      // Only fetch the gap ranges (not the full lookback range)
      const ranges = gaps && gaps.length > 0
        ? gaps.map(g => ({ start: g.start.split('T')[0], end: g.end.split('T')[0] }))
        : [{ start: lookbackStart.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] }];

      for (const range of ranges) {
        const rangeDays = (new Date(range.end).getTime() - new Date(range.start).getTime()) / (1000 * 60 * 60 * 24);
        if (rangeDays > 90) {
          const chunks = buildMonthlyChunks(new Date(range.start), new Date(range.end));
          for (const chunk of chunks) {
            await searchMergedPRs(repo, chunk.start, chunk.end);
          }
        } else {
          await searchMergedPRs(repo, range.start, range.end);
        }
      }

      activeRepoNames.delete(repo.displayName);
      completedRepos++;
      emitListProgress();
    });
  }

  // Cap at PR_CAP (most recent)
  const wasCapped = allPRs.length > PR_CAP;
  const cappedPRs = wasCapped
    ? allPRs.sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()).slice(0, PR_CAP)
    : allPRs;

  const totalPRs = cappedPRs.length;
  if (totalPRs === 0) {
    return {
      human: emptyBucketMetrics(),
      aiAssisted: emptyBucketMetrics(),
      agent: emptyBucketMetrics(),
      totalPRsAnalyzed: 0,
      prs: [],
    };
  }

  // Phase 2: Batch-fetch PR details via GraphQL (10 PRs per query)
  // Split PRs into cached vs uncached
  const prMetrics: PRMetricsRaw[] = [];
  const uncachedPRs: typeof cappedPRs = [];
  const newPRDetailsForCache: Record<string, CachedPRDetailInput> = {};

  for (const pr of cappedPRs) {
    const key = `${pr.repo.owner}/${pr.repo.name}#${pr.number}`;
    const cached = cachedPRDetails?.get(key);

    if (cached) {
      // Re-derive category from current aiCommitSHAs/agentUsernames
      const category = categorizePR(cached.author, cached.commitSHAs, cached.commitMessages, aiCommitSHAs, agentUsernames);
      prMetrics.push({
        number: cached.number,
        repo: cached.repo,
        author: cached.author,
        title: cached.title,
        mergedAt: cached.mergedAt,
        firstCommitDate: cached.firstCommitDate,
        additions: cached.additions,
        deletions: cached.deletions,
        reviewRounds: cached.reviewRounds,
        reviewComments: cached.reviewComments,
        isRevert: cached.isRevert,
        category,
        isLookback: pr.isLookback,
      });
    } else {
      uncachedPRs.push(pr);
    }
  }

  const BATCH_SIZE = 10;
  let completedDetails = prMetrics.length;

  onProgress?.({ phase: 'fetching-details', completedPRs: completedDetails, totalPRs });

  if (uncachedPRs.length > 0) {
    const batches: Array<typeof uncachedPRs> = [];
    for (let i = 0; i < uncachedPRs.length; i += BATCH_SIZE) {
      batches.push(uncachedPRs.slice(i, i + BATCH_SIZE));
    }

    await runWithConcurrency(batches, 5, async (batch) => {
      let detailsMap: Map<string, {
        additions: number;
        deletions: number;
        reviewComments: number;
        firstCommitDate: string | null;
        commitSHAs: string[];
        commitMessages: string[];
        reviewRounds: number;
      }>;

      try {
        detailsMap = await fetchPRDetailsBatchGraphQL(token, batch);
      } catch (err) {
        console.warn('GraphQL batch failed, skipping batch:', err);
        completedDetails += batch.length;
        onProgress?.({ phase: 'fetching-details', completedPRs: completedDetails, totalPRs });
        return;
      }

      for (const pr of batch) {
        const key = `${pr.repo.owner}/${pr.repo.name}#${pr.number}`;
        const details = detailsMap.get(key);

        const additions = details?.additions || 0;
        const deletions = details?.deletions || 0;
        const reviewComments = details?.reviewComments || 0;
        const firstCommitDate = details?.firstCommitDate || pr.mergedAt;
        const commitSHAs = details?.commitSHAs || [];
        const commitMessages = details?.commitMessages || [];
        const reviewRounds = details?.reviewRounds || 0;

        const isRevert = /^Revert ".+"/.test(pr.title) ||
          (!!pr.body && pr.body.includes('This reverts commit'));

        const category = categorizePR(pr.author, commitSHAs, commitMessages, aiCommitSHAs, agentUsernames);

        prMetrics.push({
          number: pr.number,
          repo: pr.repo.displayName,
          author: pr.author,
          title: pr.title,
          mergedAt: pr.mergedAt,
          firstCommitDate,
          additions,
          deletions,
          reviewRounds,
          reviewComments,
          isRevert,
          category,
          isLookback: pr.isLookback,
        });

        // Track for disk cache (category excluded — re-derived at read time)
        newPRDetailsForCache[key] = {
          number: pr.number,
          repo: pr.repo.displayName,
          author: pr.author,
          title: pr.title,
          mergedAt: pr.mergedAt,
          firstCommitDate,
          additions,
          deletions,
          reviewRounds,
          reviewComments,
          isRevert,
          commitSHAs,
          commitMessages,
        };

        completedDetails++;
      }

      onProgress?.({ phase: 'fetching-details', completedPRs: completedDetails, totalPRs });
    });
  }

  // Phase 3: Compute metrics (exclude lookback PRs from main comparison)
  onProgress?.({ phase: 'computing', completedPRs: totalPRs, totalPRs });

  const inRangePRs = prMetrics.filter(pr => !pr.isLookback);
  const humanPRs = inRangePRs.filter(pr => pr.category === 'human');
  const aiAssistedPRs = inRangePRs.filter(pr => pr.category === 'ai-assisted');
  const agentPRs = inRangePRs.filter(pr => pr.category === 'agent');

  const metricsResult: ProductivityMetrics = {
    human: computeBucketMetrics(humanPRs),
    aiAssisted: computeBucketMetrics(aiAssistedPRs),
    agent: computeBucketMetrics(agentPRs),
    totalPRsAnalyzed: inRangePRs.length,
    prs: prMetrics, // full set including lookback for boost card
  };

  // Build merged PR listing for cache
  const _rawMergedPRs: Record<string, CachedMergedPRInput[]> = {};
  for (const pr of allPRs) {
    const repoKey = `${pr.repo.owner}/${pr.repo.name}`;
    if (!_rawMergedPRs[repoKey]) _rawMergedPRs[repoKey] = [];
    _rawMergedPRs[repoKey].push({
      number: pr.number,
      repoOwner: pr.repo.owner,
      repoName: pr.repo.name,
      repoDisplayName: pr.repo.displayName,
      author: pr.author,
      title: pr.title,
      body: pr.body,
      mergedAt: pr.mergedAt,
    });
  }

  return Object.assign(metricsResult, { _newPRDetails: newPRDetailsForCache, _rawMergedPRs });
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

