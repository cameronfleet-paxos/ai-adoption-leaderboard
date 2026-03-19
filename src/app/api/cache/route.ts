import { NextRequest, NextResponse } from 'next/server';
import { getAuthMode } from '@/lib/auth-config';
import {
  readCache,
  writeCache,
  deleteCache,
  getCachedCommits,
  getCachedPRLabels,
  getCachedPRDetails,
  getCachedMergedPRs,
  mergeCommits,
  mergePRLabels,
  mergePRDetails,
  mergeMergedPRs,
  getCoverage,
  expandCommitCoverage,
  expandPRLabelCoverage,
  expandMergedPRCoverage,
  type CachedCommit,
  type CachedPRLabelResult,
  type CachedPRDetail,
  type CachedMergedPR,
} from '@/lib/disk-cache';

function getToken(request: NextRequest): string | null {
  const authMode = getAuthMode();
  if (authMode === 'pat') {
    return process.env.GITHUB_TOKEN ?? null;
  }
  return request.cookies.get('github_access_token')?.value ?? null;
}

/**
 * GET /api/cache?repos=owner/repo1,owner/repo2&start=ISO&end=ISO
 *
 * Optional: &prDetailKeys=owner/repo#1,owner/repo#2 for PR detail lookups
 *
 * Returns cached items within date range + per-repo coverage gaps.
 */
export async function GET(request: NextRequest) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repos = searchParams.get('repos')?.split(',').filter(Boolean) || [];
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const prDetailKeysParam = searchParams.get('prDetailKeys');

  if (repos.length === 0 || !start || !end) {
    return NextResponse.json({ error: 'Missing repos, start, or end' }, { status: 400 });
  }

  const cache = readCache();

  // Get cached commits and PR labels per repo
  const commits: Record<string, CachedCommit[]> = {};
  const prLabels: Record<string, CachedPRLabelResult[]> = {};
  const mergedPRs: Record<string, CachedMergedPR[]> = {};

  for (const repo of repos) {
    const commitResult = getCachedCommits(cache, repo, start, end);
    commits[repo] = commitResult.items;

    const prResult = getCachedPRLabels(cache, repo, start, end);
    prLabels[repo] = prResult.items;

    const mergedPRResult = getCachedMergedPRs(cache, repo, start, end);
    mergedPRs[repo] = mergedPRResult.items;
  }

  // Get coverage info
  const coverage = getCoverage(cache, repos, start, end);

  // Get PR details if requested
  let prDetails: Record<string, CachedPRDetail> = {};
  if (prDetailKeysParam !== null) {
    const keys = prDetailKeysParam.split(',').filter(Boolean);
    if (keys.length > 0) {
      const detailsMap = getCachedPRDetails(cache, keys);
      prDetails = Object.fromEntries(detailsMap);
    } else {
      // Empty param = return all PR details for the requested repos
      for (const [key, detail] of Object.entries(cache.prDetails)) {
        // key format: "owner/repo#number"
        const repoKey = key.split('#')[0];
        if (repos.includes(repoKey)) {
          // Filter by date range
          if (detail.mergedAt >= start && detail.mergedAt <= end) {
            prDetails[key] = detail;
          }
        }
      }
    }
  }

  return NextResponse.json({ commits, prLabels, mergedPRs, coverage, prDetails });
}

/**
 * POST /api/cache
 *
 * Body: { commits, prLabels, prDetails, mergedPRs, coverageExpansions }
 * Merges new data into the cache and writes atomically.
 */
export async function POST(request: NextRequest) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const cache = readCache();

  // Merge commits per repo
  if (body.commits) {
    for (const [repoKey, items] of Object.entries(body.commits)) {
      mergeCommits(cache, repoKey, items as CachedCommit[]);
    }
  }

  // Merge PR label results per repo
  if (body.prLabels) {
    for (const [repoKey, items] of Object.entries(body.prLabels)) {
      mergePRLabels(cache, repoKey, items as CachedPRLabelResult[]);
    }
  }

  // Merge PR details
  if (body.prDetails) {
    mergePRDetails(cache, body.prDetails as Record<string, CachedPRDetail>);
  }

  // Merge merged PR listings
  if (body.mergedPRs) {
    for (const [repoKey, items] of Object.entries(body.mergedPRs)) {
      mergeMergedPRs(cache, repoKey, items as CachedMergedPR[]);
    }
  }

  // Expand coverage boundaries (for gaps that returned zero results)
  if (body.coverageExpansions) {
    for (const expansion of body.coverageExpansions as Array<{ repoKey: string; start: string; end: string; type: 'commits' | 'prLabels' | 'mergedPRs' }>) {
      if (expansion.type === 'commits') {
        expandCommitCoverage(cache, expansion.repoKey, expansion.start, expansion.end);
      } else if (expansion.type === 'prLabels') {
        expandPRLabelCoverage(cache, expansion.repoKey, expansion.start, expansion.end);
      } else if (expansion.type === 'mergedPRs') {
        expandMergedPRCoverage(cache, expansion.repoKey, expansion.start, expansion.end);
      }
    }
  }

  writeCache(cache);

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/cache
 *
 * Deletes the cache file entirely.
 */
export async function DELETE(request: NextRequest) {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  deleteCache();
  return NextResponse.json({ ok: true });
}
