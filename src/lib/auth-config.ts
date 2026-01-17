/**
 * Authentication configuration for the AI Adoption Leaderboard
 *
 * Supports three modes:
 * 1. PAT Mode (Personal Access Token) - Simple local development
 *    - Set GITHUB_TOKEN in .env.local
 *    - Manually configure GITHUB_REPOS as comma-separated "owner/repo" values
 *
 * 2. OAuth Mode - Production ready with secure token exchange
 *    - Uses GitHub OAuth Web Application Flow
 *    - Client secret stored securely in Vercel Edge Functions
 *    - Dynamic repository selection
 *
 * 3. None - No authentication configured
 */

export type AuthMode = 'pat' | 'oauth' | 'none';

export interface AuthConfig {
  mode: AuthMode;
  token?: string;
  repos?: { owner: string; name: string; displayName: string }[];
}

/**
 * Detect which authentication mode is configured
 * This runs server-side to detect available credentials
 */
export function getAuthMode(): AuthMode {
  // Check for mode override (set explicitly in env)
  const modeOverride = process.env.AUTH_MODE_OVERRIDE as AuthMode | undefined;

  if (modeOverride === 'pat') {
    if (process.env.GITHUB_TOKEN) {
      return 'pat';
    }
    console.warn('AUTH_MODE_OVERRIDE=pat but GITHUB_TOKEN not set');
  }

  if (modeOverride === 'oauth') {
    if (process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      return 'oauth';
    }
    console.warn('AUTH_MODE_OVERRIDE=oauth but OAuth credentials not set');
  }

  // Auto-detect mode: Check for PAT mode first (simpler, takes precedence for local dev)
  if (process.env.GITHUB_TOKEN) {
    return 'pat';
  }

  // Check for OAuth mode (production)
  if (process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return 'oauth';
  }

  return 'none';
}

/**
 * Check if OAuth is available (client-side safe)
 * Only checks the public client ID which is safe to expose
 */
export function isOAuthAvailable(): boolean {
  return !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
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

  if (mode === 'oauth') {
    return !!(
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET
    );
  }

  return false;
}
