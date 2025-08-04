# Security Policy

## Supported Versions

We actively support the latest version of AI Adoption Leaderboard. Security updates will be applied to the current release version.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you believe you have found a security vulnerability in AI Adoption Leaderboard, please report it to us as described below.

### Reporting Process

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them using one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to our [Security Advisories page](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/security/advisories)
   - Click "Report a vulnerability"
   - Fill out the form with detailed information

2. **Email**
   - Send an email to the repository maintainers
   - Include "SECURITY" in the subject line
   - Provide detailed information about the vulnerability

### What to Include

Please include the following information in your security report:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s)** related to the manifestation of the issue
- **Location of the affected source code** (tag/branch/commit or direct URL)
- **Any special configuration** required to reproduce the issue
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the issue**, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Assessment**: We will provide an initial assessment within 5 business days
- **Resolution**: We will work to resolve confirmed vulnerabilities as quickly as possible, typically within 30 days
- **Disclosure**: Once fixed, we will coordinate with you on responsible disclosure

### Security Measures

AI Adoption Leaderboard implements several security measures:

- **GitHub App Authentication**: Secure OAuth flow with limited scopes
- **Environment Variable Protection**: Sensitive data stored in environment variables
- **HTTPS Only**: All communications use encrypted connections
- **Input Validation**: User inputs are validated and sanitized
- **Dependency Scanning**: Regular updates and vulnerability scanning of dependencies
- **Static Analysis**: Automated code analysis for security issues

### Responsible Disclosure

We believe in responsible disclosure and will:

- Work with you to understand and resolve the issue quickly
- Keep you informed about our progress
- Credit you for the discovery (if desired) once the issue is resolved
- Not take legal action against researchers who:
  - Make a good faith effort to avoid privacy violations and service disruption
  - Report vulnerabilities promptly
  - Allow us reasonable time to resolve issues before disclosure

### Security Best Practices for Users

When using AI Adoption Leaderboard:

- **Keep your GitHub App credentials secure**
- **Use environment variables** for sensitive configuration
- **Regularly update dependencies** in your deployment
- **Monitor your GitHub App installation** for any unusual activity
- **Use HTTPS** for all deployments
- **Review repository permissions** regularly

### Security Updates

Security updates will be:

- **Released as patches** to the latest version
- **Documented** in release notes and security advisories
- **Announced** through GitHub releases and security advisories

### Scope

This security policy applies to:

- The main AI Adoption Leaderboard application
- All code in this repository
- Dependencies and third-party integrations
- Deployment configurations and examples

### Out of Scope

The following are generally out of scope:

- Vulnerabilities in third-party services (GitHub, Vercel, etc.)
- Issues requiring physical access to devices
- Social engineering attacks
- Issues in outdated versions or unsupported configurations

## Questions?

If you have questions about this security policy, please open a discussion in our [GitHub Discussions](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/discussions) or contact the maintainers.

Thank you for helping keep AI Adoption Leaderboard and our users safe! 🔒