import jwt from 'jsonwebtoken';

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    type: string;
  };
  repositories?: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  }[];
}

interface InstallationToken {
  token: string;
  expires_at: string;
}

export class GitHubAppAuth {
  private appId: string;
  private privateKey: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    // Defer environment variable loading to when they're actually needed
  }

  private loadEnvVars() {
    if (!this.appId) {
      this.appId = process.env.GITHUB_APP_ID!;
      this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY!;
      this.clientId = process.env.GITHUB_APP_CLIENT_ID!;
      this.clientSecret = process.env.GITHUB_APP_CLIENT_SECRET!;

      // Environment variables loaded successfully

      if (!this.appId || !this.privateKey || !this.clientId || !this.clientSecret) {
        throw new Error('Missing required GitHub App environment variables');
      }
    }
  }

  /**
   * Generate a JWT token for authenticating as the GitHub App
   */
  generateJWT(): string {
    this.loadEnvVars();
    
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iat: now - 60, // issued 60 seconds in the past to allow for clock drift
      exp: now + (10 * 60), // expires in 10 minutes
      iss: this.appId
    };

    // Replace literal \n with actual newlines in private key
    const privateKey = this.privateKey.replace(/\\n/g, '\n');
    
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  /**
   * Get installation access token for a specific installation
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const jwtToken = this.generateJWT();
    
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Adoption-Leaderboard'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get installation token: ${response.status} ${errorText}`);
    }

    const tokenData: InstallationToken = await response.json();
    return tokenData.token;
  }

  /**
   * Get repositories accessible by an installation
   */
  async getInstallationRepositories(installationId: number): Promise<GitHubInstallation['repositories']> {
    const token = await this.getInstallationToken(installationId);
    
    const response = await fetch(
      `https://api.github.com/installation/repositories`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Adoption-Leaderboard'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get installation repositories: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.repositories;
  }

  /**
   * Exchange OAuth code for installation information
   */
  async exchangeCodeForInstallation(code: string): Promise<{ installationId: number; repositories: any[] }> {
    this.loadEnvVars();
    
    // First, exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`OAuth error: ${tokenData.error_description}`);
    }

    // Get user's installations
    const installationsResponse = await fetch('https://api.github.com/user/installations', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Adoption-Leaderboard'
      }
    });

    if (!installationsResponse.ok) {
      throw new Error(`Failed to get installations: ${installationsResponse.status}`);
    }

    const installationsData = await installationsResponse.json();
    
    // Process user installations
    
    if (!installationsData.installations || installationsData.installations.length === 0) {
      throw new Error('No installations found. Please install the GitHub App first by visiting: https://github.com/apps/ai-adoption-leaderboard/installations/new');
    }

    // Get all repositories from all installations
    let allRepositories: any[] = [];
    let primaryInstallationId = installationsData.installations[0].id;

    for (const installation of installationsData.installations) {
      try {
        const repos = await this.getInstallationRepositories(installation.id);
        if (repos && repos.length > 0) {
          allRepositories.push(...repos);
          // Use the installation with the most repositories as primary
          if (repos.length > allRepositories.length) {
            primaryInstallationId = installation.id;
          }
        }
      } catch (error) {
        console.warn(`Failed to get repositories for installation ${installation.id}:`, error);
      }
    }

    if (allRepositories.length === 0) {
      throw new Error('No repositories found in any installation. Please ensure the GitHub App has access to at least one repository.');
    }

    return {
      installationId: primaryInstallationId,
      repositories: allRepositories
    };
  }

  /**
   * Get the GitHub App installation URL
   */
  async getInstallationUrl(redirectUri?: string, state?: string): Promise<string> {
    try {
      // Get the app information to get the correct slug
      const jwtToken = this.generateJWT();
      const response = await fetch('https://api.github.com/app', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Adoption-Leaderboard'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get app info: ${response.status}`);
      }

      const appData = await response.json();
      const appSlug = appData.slug || appData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      const params = new URLSearchParams();
      
      if (redirectUri) {
        params.append('redirect_uri', redirectUri);
      }
      
      if (state) {
        params.append('state', state);
      }

      // For GitHub Apps, we need to use installations/new for the selection page
      return `https://github.com/apps/${appSlug}/installations/new?${params.toString()}`;
    } catch (error) {
      console.error('Failed to get app info, using fallback:', error);
      // Fallback to a generic installation URL using the app ID
      const params = new URLSearchParams();
      
      if (redirectUri) {
        params.append('redirect_uri', redirectUri);
      }
      
      if (state) {
        params.append('state', state);
      }

      return `https://github.com/settings/installations/new?target_id=${this.appId}&${params.toString()}`;
    }
  }

  /**
   * Get the OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    this.loadEnvVars();
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user',
    });
    
    if (state) {
      params.append('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
}

// Create a singleton instance that's only instantiated when needed
let _githubApp: GitHubAppAuth | null = null;

export const githubApp = {
  getInstance(): GitHubAppAuth {
    if (!_githubApp) {
      _githubApp = new GitHubAppAuth();
    }
    return _githubApp;
  },
  
  // Proxy methods for backwards compatibility
  async getInstallationToken(installationId: number): Promise<string> {
    return this.getInstance().getInstallationToken(installationId);
  },
  
  async getInstallationRepositories(installationId: number) {
    return this.getInstance().getInstallationRepositories(installationId);
  },
  
  async exchangeCodeForInstallation(code: string) {
    return this.getInstance().exchangeCodeForInstallation(code);
  },
  
  async getInstallationUrl(redirectUri?: string, state?: string): Promise<string> {
    return this.getInstance().getInstallationUrl(redirectUri, state);
  },
  
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    return this.getInstance().getAuthorizationUrl(redirectUri, state);
  }
};