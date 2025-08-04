# Deployment Guide: AI Adoption Leaderboard

## Prerequisites
- GitHub App (will be created during setup)
- Vercel account
- Access to GitHub organizations you want to analyze

## Step-by-Step Deployment

### 1. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New" → "Project" 
4. Import `cameronfleet-paxos/ai-adoption-leaderboard`
5. Click "Deploy" (it will fail initially - that's expected)

### 2. Create GitHub App
1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in:
   - **GitHub App name**: `AI Adoption Leaderboard` (or similar unique name)
   - **Homepage URL**: Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
   - **Callback URL**: `https://your-app.vercel.app/api/github/callback`
   - **Setup URL**: `https://your-app.vercel.app/api/github/installation-callback`
   - **Webhook URL**: Leave blank
   - **Webhook secret**: Leave blank
4. **Permissions** - Set these to "Read-only":
   - Repository permissions:
     - Contents: Read
     - Metadata: Read
     - Pull requests: Read
   - Account permissions:
     - Email addresses: Read
5. **Where can this GitHub App be installed?** Select "Any account"
6. Click "Create GitHub App"

### 3. Get GitHub App Credentials
After creating the app:
1. Note the **App ID** (shown at top of app page)
2. Copy the **Client ID** 
3. Generate and copy **Client Secret**
4. Generate and download **Private Key** (.pem file)

### 4. Configure Vercel Environment Variables
1. Go to your Vercel project dashboard
2. Go to Settings → Environment Variables
3. Add these variables:
   - `GITHUB_APP_ID`: Your App ID
   - `GITHUB_APP_CLIENT_ID`: Your Client ID  
   - `GITHUB_APP_CLIENT_SECRET`: Your Client Secret
   - `GITHUB_APP_PRIVATE_KEY`: Paste entire private key content (including BEGIN/END lines)

### 5. Redeploy
1. Go to Vercel Deployments tab
2. Click "Redeploy" on latest deployment
3. Your app should now work!

### 6. Test Installation
1. Visit your deployed app URL
2. Click "Install & Connect GitHub App"
3. Install the app on your desired organizations/repositories
4. Verify the leaderboard loads correctly

## Troubleshooting
- If deployment fails, check Vercel function logs
- If authentication fails, verify GitHub App callback URLs match your domain
- If no commits show, ensure repositories have Claude co-authored commits

## Usage
Users can:
1. Install the GitHub App on their organizations
2. Select repositories to analyze
3. View AI adoption metrics and leaderboards
4. Add additional organizations as needed