# 🏆 AI Adoption Leaderboard

[![CI](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/actions/workflows/ci.yml/badge.svg)](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcameronfleet-paxos%2Fai-adoption-leaderboard)

> **Track and celebrate AI-enhanced development across your organization** 

A beautiful, modern web application that analyzes GitHub repositories to create leaderboards based on commits co-authored with Claude AI. Perfect for teams wanting to track AI adoption and celebrate developers embracing AI-assisted development.

## 🌟 Live Demo

**[🚀 Try it live: ai-adoption-leaderboard.vercel.app](https://ai-adoption-leaderboard.vercel.app/)**

![AI Adoption Leaderboard Example](example.png)

## ✨ Features

🔐 **Secure GitHub App Integration** - No personal tokens required; OAuth-based repository access  
📊 **Multi-Repository Analysis** - Analyze commits across multiple repositories simultaneously  
🤖 **Claude Co-Author Detection** - Automatically identifies commits with Claude as co-author  
🏅 **Interactive Leaderboard** - Beautiful rankings with achievement badges and detailed stats  
📅 **Flexible Date Ranges** - Analyze specific time periods with preset and custom ranges  
🎯 **Repository Selection** - Search and filter which repositories to include in analysis  
🌙 **Modern UI/UX** - Built with shadcn/ui components and responsive design  
🔒 **Privacy-First** - Secure session management with no persistent data storage  

## 🚀 Quick Start

### Option 1: Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcameronfleet-paxos%2Fai-adoption-leaderboard)

1. Click the deploy button above
2. Follow the [deployment guide](./DEPLOYMENT.md) to configure your GitHub App
3. Add environment variables in Vercel
4. Redeploy and enjoy!

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/cameronfleet-paxos/ai-adoption-leaderboard.git
cd ai-adoption-leaderboard

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Configure your GitHub App credentials in .env.local
# See setup instructions below

# Start development server
npm run dev
```

## 🛠️ Setup Instructions

### 1. Create a GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Configure:
   - **App name**: `AI Adoption Leaderboard` (or your preferred name)
   - **Homepage URL**: Your deployment URL or `http://localhost:3000`
   - **Callback URL**: `{YOUR_URL}/api/github/callback`
   - **Setup URL**: `{YOUR_URL}/api/github/installation-callback`
   - **Repository permissions**: 
     - Contents: Read
     - Metadata: Read
     - Pull requests: Read
   - **User permissions**: Email addresses: Read (optional)

### 2. Configure Environment Variables

Update `.env.local` with your GitHub App credentials:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abcdef1234567890
GITHUB_APP_CLIENT_SECRET=abcdef1234567890abcdef1234567890abcdef12
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"

# Session Security (generate a random 32+ character string)
SESSION_SECRET=your-secure-random-session-secret-32-chars-minimum
```

### 3. Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start analyzing your AI adoption!

## 🏗️ How It Works

1. **🔐 Secure Authentication**: Users authorize the GitHub App to access their selected repositories
2. **📂 Repository Selection**: Choose which repositories to analyze with search and filtering
3. **🔍 Commit Analysis**: The app scans commits looking for Claude co-author signatures:
   - `Co-Authored-By: Claude <noreply@anthropic.com>`
   - `Co-authored-by: Claude <noreply@anthropic.com>`
4. **📊 Statistical Analysis**: Calculates adoption rates, rankings, and detailed metrics
5. **🏆 Leaderboard Generation**: Creates beautiful, interactive leaderboards with achievements

## 🛡️ Security & Privacy

- ✅ **No personal access tokens** - Uses secure GitHub App OAuth flow
- ✅ **User-controlled access** - Users select which repositories to grant access to
- ✅ **Session-based security** - Encrypted sessions with automatic expiration
- ✅ **No data persistence** - No user data stored on servers
- ✅ **Short-lived tokens** - Installation tokens expire automatically

## 🚀 Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Authentication**: GitHub App OAuth + JWT
- **Session Management**: iron-session
- **Deployment**: Vercel (recommended)

## 📖 Documentation

- [📋 Deployment Guide](./DEPLOYMENT.md) - Step-by-step deployment instructions
- [🤝 Contributing](./CONTRIBUTING.md) - How to contribute to the project
- [📜 Code of Conduct](./CODE_OF_CONDUCT.md) - Community guidelines
- [🔒 Security Policy](./SECURITY.md) - Security guidelines and reporting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test them
4. Commit with a descriptive message: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) for beautiful, accessible components
- Powered by [Radix UI](https://www.radix-ui.com/) primitives
- Icons by [Lucide](https://lucide.dev/)
- Deployed on [Vercel](https://vercel.com/)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cameronfleet-paxos/ai-adoption-leaderboard&type=Date)](https://star-history.com/#cameronfleet-paxos/ai-adoption-leaderboard&Date)

---

<div align="center">

**[🚀 Try the Live Demo](https://ai-adoption-leaderboard.vercel.app/)** | **[📖 Read the Docs](./DEPLOYMENT.md)** | **[🤝 Contribute](./CONTRIBUTING.md)**

Made with ❤️ for the AI-enhanced development community

</div>