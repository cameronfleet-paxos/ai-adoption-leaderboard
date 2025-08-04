# AI Adoption Leaderboard

A lightweight web application that tracks and ranks developers by commits co-authored with Claude across your GitHub repositories. Users authorize the app to access their repositories, and the leaderboard analyzes commits for Claude co-authorship.

## Features

- **GitHub App Integration** - No personal tokens required; users authorize repository access
- **Multi-Repository Analysis** - Analyze commits across multiple repositories
- **Claude Co-Author Detection** - Identifies commits with Claude as co-author
- **Interactive Leaderboard** - Rankings by Claude collaboration percentage
- **Date Range Filtering** - Analyze specific time periods
- **Repository Selection** - Choose which authorized repositories to include

## Setup

### 1. Create a GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in the required fields:
   - **App name**: `ai-adoption-leaderboard` (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Callback URL**: `http://localhost:3000/api/github/callback`
   - **Webhook URL**: Leave blank (not needed)
   - **Repository permissions**: Set "Contents" to "Read"
   - **User permissions**: Set "Email addresses" to "Read" (optional)
4. Generate a private key and download it
5. Note your App ID, Client ID, and Client Secret

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your GitHub App credentials:

```bash
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abcdef1234567890
GITHUB_APP_CLIENT_SECRET=abcdef1234567890abcdef1234567890abcdef12
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

### 3. Install and Run

```bash
npm install
npm run dev
```

### 4. Open and Authorize

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Connect GitHub Repositories"
3. Authorize the app and select repositories to analyze
4. View your Claude co-authorship leaderboard!

## How It Works

1. **Authorization**: Users click "Connect GitHub Repositories" and are redirected to GitHub
2. **Repository Selection**: Users choose which repositories to grant access to
3. **Analysis**: The app fetches commits from authorized repositories
4. **Detection**: Searches for commits with Claude co-author signatures:
   - `Co-Authored-By: Claude <noreply@anthropic.com>`
   - `Co-authored-by: Claude <noreply@anthropic.com>`
5. **Ranking**: Creates leaderboard based on Claude collaboration percentage

## Architecture

- **Next.js 15** with App Router
- **GitHub App OAuth** for secure, token-free authentication  
- **JWT-based** GitHub App authentication
- **Stateless design** - no user sessions or database required
- **Client-side** repository selection and filtering

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed step-by-step deployment instructions.

Quick deployment to Vercel:
1. Deploy to Vercel from GitHub
2. Create GitHub App with production URLs
3. Configure environment variables in Vercel
4. Redeploy

## Security

- No personal access tokens required
- Users control repository access through GitHub App installation
- Short-lived installation tokens for API requests
- No persistent user data storage