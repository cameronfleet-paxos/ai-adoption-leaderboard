/**
 * Authentication configuration for the AI Adoption Leaderboard
 *
 * Supports two modes:
 * 1. PAT Mode (Personal Access Token) - Simple local development
 *    - Set GITHUB_TOKEN in .env.local
 *    - Manually configure GITHUB_REPOS as comma-separated "owner/repo" values
 *
 * 2. App Mode (GitHub App) - Full featured, production ready
 *    - Requires GitHub App credentials
 *    - OAuth flow for user authentication
 *    - Dynamic repository selection
 */

export type AuthMode = 'pat' | 'app' | 'none';

export interface AuthConfig {
  mode: AuthMode;
  token?: string;
  repos?: { owner: string; name: string; displayName: string }[];
}

/**
 * Detect which authentication mode is configured
 */
export function getAuthMode(): AuthMode {
  // Check for mode override (set by dev script for explicit mode selection)
  const modeOverride = process.env.AUTH_MODE_OVERRIDE as AuthMode | undefined;

  if (modeOverride === 'pat') {
    if (process.env.GITHUB_TOKEN) {
      return 'pat';
    }
    // Fallback if override is set but credentials missing
    console.warn('AUTH_MODE_OVERRIDE=pat but GITHUB_TOKEN not set');
  }

  if (modeOverride === 'app') {
    if (
      process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_CLIENT_SECRET
    ) {
      return 'app';
    }
    // Fallback if override is set but credentials missing
    console.warn('AUTH_MODE_OVERRIDE=app but GitHub App credentials not set');
  }

  // Auto-detect mode: Check for PAT mode first (simpler, takes precedence for local dev)
  if (process.env.GITHUB_TOKEN) {
    return 'pat';
  }

  // Check for GitHub App mode
  if (
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_PRIVATE_KEY &&
    process.env.GITHUB_APP_CLIENT_ID &&
    process.env.GITHUB_APP_CLIENT_SECRET
  ) {
    return 'app';
  }

  return 'none';
}

/**
 * Get the configured repositories for PAT mode
 * Format: "owner/repo,owner/repo2"
 */
export function getPATRepos(): { owner: string; name: string; displayName: string }[] {
  const reposEnv = process.env.GITHUB_REPOS || '';

  if (!reposEnv.trim()) {
    return [];
  }

  return reposEnv.split(',').map(repo => {
    const trimmed = repo.trim();
    const [owner, name] = trimmed.split('/');
    return {
      owner: owner || '',
      name: name || '',
      displayName: name || trimmed
    };
  }).filter(repo => repo.owner && repo.name);
}

/**
 * Get the GitHub token for PAT mode
 */
export function getPATToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

/**
 * Check if the current configuration is valid
 */
export function isAuthConfigured(): boolean {
  const mode = getAuthMode();

  if (mode === 'pat') {
    return !!process.env.GITHUB_TOKEN;
  }

  if (mode === 'app') {
    return !!(
      process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_CLIENT_SECRET
    );
  }

  return false;
}
