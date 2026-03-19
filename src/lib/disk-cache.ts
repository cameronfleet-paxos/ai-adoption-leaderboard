/**
 * Local disk cache for GitHub data.
 *
 * Caches commit data, PR label results, and PR details at
 * ~/.ai-adoption-leaderboard/cache.json so that subsequent page loads
 * only fetch new/unseen data from GitHub.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// --- Types ---

export interface CachedCommit {
  sha: string;
  repository: string;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  message: string;
}

export interface CachedPRLabelResult {
  sha: string;
  username: string;
  aiTool: string;
  repo: string;
  date: string;
}

export interface CachedPRDetail {
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

export interface CachedMergedPR {
  number: number;
  repoOwner: string;
  repoName: string;
  repoDisplayName: string;
  author: string;
  title: string;
  body: string;
  mergedAt: string;
}

interface RepoSection<T> {
  latestDate: string;
  earliestDate: string;
  items: Record<string, T>;
}

export interface DiskCache {
  version: 1;
  lastWrittenAt: string; // ISO timestamp of last cache write
  commits: Record<string, RepoSection<CachedCommit>>;
  prLabelResults: Record<string, RepoSection<CachedPRLabelResult>>;
  prDetails: Record<string, CachedPRDetail>;
  mergedPRs: Record<string, RepoSection<CachedMergedPR>>; // per-repo merged PR listings
}

export interface CoverageGap {
  start: string;
  end: string;
}

export interface RepoCoverage {
  commits: { earliest: string | null; latest: string | null; gaps: CoverageGap[] };
  prLabels: { earliest: string | null; latest: string | null; gaps: CoverageGap[] };
  mergedPRs: { earliest: string | null; latest: string | null; gaps: CoverageGap[] };
}

// --- Constants ---

const CACHE_DIR = path.join(os.homedir(), '.ai-adoption-leaderboard');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

// --- Helpers ---

function emptyCache(): DiskCache {
  return { version: 1, lastWrittenAt: new Date().toISOString(), commits: {}, prLabelResults: {}, prDetails: {}, mergedPRs: {} };
}

export function readCache(): DiskCache {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return emptyCache();
    // Backfill fields for caches created before they existed
    if (!parsed.lastWrittenAt) {
      parsed.lastWrittenAt = new Date(0).toISOString();
    }
    if (!parsed.mergedPRs) {
      parsed.mergedPRs = {};
    }
    return parsed as DiskCache;
  } catch {
    return emptyCache();
  }
}

export function writeCache(cache: DiskCache): void {
  cache.lastWrittenAt = new Date().toISOString();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmpFile = CACHE_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(cache), 'utf-8');
  fs.renameSync(tmpFile, CACHE_FILE);
}

export function deleteCache(): void {
  try {
    fs.unlinkSync(CACHE_FILE);
  } catch {
    // File may not exist
  }
}

export function getCacheInfo(): { exists: boolean; sizeKB: number; lastWritten: string | null } {
  try {
    const stat = fs.statSync(CACHE_FILE);
    const cache = readCache();
    return {
      exists: true,
      sizeKB: Math.round((stat.size / 1024) * 10) / 10,
      lastWritten: cache.lastWrittenAt || null,
    };
  } catch {
    return { exists: false, sizeKB: 0, lastWritten: null };
  }
}

// --- Commits ---

function computeGaps(
  earliest: string | null,
  latest: string | null,
  start: string,
  end: string,
): CoverageGap[] {
  if (!earliest || !latest) return [{ start, end }];

  const gaps: CoverageGap[] = [];
  if (start < earliest) {
    gaps.push({ start, end: earliest });
  }
  if (end > latest) {
    gaps.push({ start: latest, end });
  }
  return gaps;
}

export function getCachedCommits(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): { items: CachedCommit[]; fullHit: boolean; gaps: CoverageGap[] } {
  const section = cache.commits[repoKey];
  if (!section) {
    return { items: [], fullHit: false, gaps: [{ start, end }] };
  }

  const gaps = computeGaps(section.earliestDate, section.latestDate, start, end);
  const fullHit = gaps.length === 0;

  const items = Object.values(section.items).filter(c => {
    return c.authorDate >= start && c.authorDate <= end;
  });

  return { items, fullHit, gaps };
}

export function mergeCommits(
  cache: DiskCache,
  repoKey: string,
  items: CachedCommit[],
): void {
  if (!cache.commits[repoKey]) {
    cache.commits[repoKey] = { latestDate: '', earliestDate: '', items: {} };
  }
  const section = cache.commits[repoKey];

  for (const item of items) {
    section.items[item.sha] = item;
    if (!section.earliestDate || item.authorDate < section.earliestDate) {
      section.earliestDate = item.authorDate;
    }
    if (!section.latestDate || item.authorDate > section.latestDate) {
      section.latestDate = item.authorDate;
    }
  }
}

// --- PR Label Results ---

export function getCachedPRLabels(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): { items: CachedPRLabelResult[]; fullHit: boolean; gaps: CoverageGap[] } {
  const section = cache.prLabelResults[repoKey];
  if (!section) {
    return { items: [], fullHit: false, gaps: [{ start, end }] };
  }

  const gaps = computeGaps(section.earliestDate, section.latestDate, start, end);
  const fullHit = gaps.length === 0;

  const items = Object.values(section.items).filter(pr => {
    return pr.date >= start && pr.date <= end;
  });

  return { items, fullHit, gaps };
}

export function mergePRLabels(
  cache: DiskCache,
  repoKey: string,
  items: CachedPRLabelResult[],
): void {
  if (!cache.prLabelResults[repoKey]) {
    cache.prLabelResults[repoKey] = { latestDate: '', earliestDate: '', items: {} };
  }
  const section = cache.prLabelResults[repoKey];

  for (const item of items) {
    section.items[item.sha] = item;
    if (!section.earliestDate || item.date < section.earliestDate) {
      section.earliestDate = item.date;
    }
    if (!section.latestDate || item.date > section.latestDate) {
      section.latestDate = item.date;
    }
  }
}

// --- PR Details ---

export function getCachedPRDetails(
  cache: DiskCache,
  keys: string[],
): Map<string, CachedPRDetail> {
  const result = new Map<string, CachedPRDetail>();
  for (const key of keys) {
    const detail = cache.prDetails[key];
    if (detail) result.set(key, detail);
  }
  return result;
}

export function mergePRDetails(
  cache: DiskCache,
  items: Record<string, CachedPRDetail>,
): void {
  Object.assign(cache.prDetails, items);
}

// --- Merged PR Listings ---

export function getCachedMergedPRs(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): { items: CachedMergedPR[]; fullHit: boolean; gaps: CoverageGap[] } {
  const section = cache.mergedPRs[repoKey];
  if (!section) {
    return { items: [], fullHit: false, gaps: [{ start, end }] };
  }

  const gaps = computeGaps(section.earliestDate, section.latestDate, start, end);
  const fullHit = gaps.length === 0;

  const items = Object.values(section.items).filter(pr => {
    return pr.mergedAt >= start && pr.mergedAt <= end;
  });

  return { items, fullHit, gaps };
}

export function mergeMergedPRs(
  cache: DiskCache,
  repoKey: string,
  items: CachedMergedPR[],
): void {
  if (!cache.mergedPRs[repoKey]) {
    cache.mergedPRs[repoKey] = { latestDate: '', earliestDate: '', items: {} };
  }
  const section = cache.mergedPRs[repoKey];

  for (const item of items) {
    const key = `${item.number}`;
    section.items[key] = item;
    if (!section.earliestDate || item.mergedAt < section.earliestDate) {
      section.earliestDate = item.mergedAt;
    }
    if (!section.latestDate || item.mergedAt > section.latestDate) {
      section.latestDate = item.mergedAt;
    }
  }
}

export function expandMergedPRCoverage(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): void {
  if (!cache.mergedPRs[repoKey]) {
    cache.mergedPRs[repoKey] = { latestDate: end, earliestDate: start, items: {} };
    return;
  }
  const section = cache.mergedPRs[repoKey];
  if (start < section.earliestDate) section.earliestDate = start;
  if (end > section.latestDate) section.latestDate = end;
}

// --- Coverage ---

export function getCoverage(
  cache: DiskCache,
  repoKeys: string[],
  start: string,
  end: string,
): Record<string, RepoCoverage> {
  const result: Record<string, RepoCoverage> = {};

  // Clamp effective latestDate to lastWrittenAt — any time after
  // the last cache write may have new data on GitHub.
  const lastWritten = cache.lastWrittenAt;
  const clampLatest = (latest: string | null): string | null => {
    if (!latest) return null;
    if (lastWritten && latest > lastWritten) return lastWritten;
    return latest;
  };

  for (const key of repoKeys) {
    const commitSection = cache.commits[key];
    const prLabelSection = cache.prLabelResults[key];

    const commitLatest = clampLatest(commitSection?.latestDate || null);
    const prLabelLatest = clampLatest(prLabelSection?.latestDate || null);
    const mergedPRSection = cache.mergedPRs[key];
    const mergedPRLatest = clampLatest(mergedPRSection?.latestDate || null);

    result[key] = {
      commits: {
        earliest: commitSection?.earliestDate || null,
        latest: commitLatest,
        gaps: computeGaps(
          commitSection?.earliestDate || null,
          commitLatest,
          start,
          end,
        ),
      },
      prLabels: {
        earliest: prLabelSection?.earliestDate || null,
        latest: prLabelLatest,
        gaps: computeGaps(
          prLabelSection?.earliestDate || null,
          prLabelLatest,
          start,
          end,
        ),
      },
      mergedPRs: {
        earliest: mergedPRSection?.earliestDate || null,
        latest: mergedPRLatest,
        gaps: computeGaps(
          mergedPRSection?.earliestDate || null,
          mergedPRLatest,
          start,
          end,
        ),
      },
    };
  }

  return result;
}

// --- Boundary date updates ---

/**
 * Expand coverage boundaries for a repo's commit section even when
 * no commits were fetched in the gap (i.e. the date range had zero results).
 */
export function expandCommitCoverage(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): void {
  if (!cache.commits[repoKey]) {
    cache.commits[repoKey] = { latestDate: end, earliestDate: start, items: {} };
    return;
  }
  const section = cache.commits[repoKey];
  if (start < section.earliestDate) section.earliestDate = start;
  if (end > section.latestDate) section.latestDate = end;
}

export function expandPRLabelCoverage(
  cache: DiskCache,
  repoKey: string,
  start: string,
  end: string,
): void {
  if (!cache.prLabelResults[repoKey]) {
    cache.prLabelResults[repoKey] = { latestDate: end, earliestDate: start, items: {} };
    return;
  }
  const section = cache.prLabelResults[repoKey];
  if (start < section.earliestDate) section.earliestDate = start;
  if (end > section.latestDate) section.latestDate = end;
}
