# Contributing to AI Adoption Leaderboard

First off, thank you for considering contributing to AI Adoption Leaderboard! 🎉 

It's people like you that make the open source community such a fantastic place to learn, inspire, and create. Every contribution helps make this tool better for everyone tracking AI adoption in their organizations.

## 🤔 How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots if applicable**
- **Include your environment details** (OS, browser, Node.js version, etc.)

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**
- **List some other applications where this enhancement exists, if applicable**

### 🔧 Code Contributions

#### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/ai-adoption-leaderboard.git
   cd ai-adoption-leaderboard
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up your environment**:
   ```bash
   cp .env.local.example .env.local
   # Configure your GitHub App credentials
   ```
5. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Workflow

1. **Make your changes** following our coding standards
2. **Test your changes** thoroughly:
   ```bash
   npm run dev        # Start development server
   npm run build      # Test production build
   npm run lint       # Check code style
   ```
3. **Commit your changes** with a descriptive message:
   ```bash
   git commit -m "Add feature: description of what you added"
   ```
4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Create a Pull Request** from your fork to the main repository

#### Pull Request Guidelines

- **Fill out the PR template** completely
- **Link any related issues** using keywords like "Fixes #123"
- **Include screenshots** for UI changes
- **Keep PRs focused** - one feature/fix per PR
- **Write clear commit messages** following conventional commits format
- **Update documentation** if needed
- **Add tests** for new functionality where applicable

## 🎨 Coding Standards

### Code Style

We use ESLint and Prettier to maintain consistent code style:

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
```

### Key Guidelines

- **Use TypeScript** for all new code
- **Follow React best practices** (hooks, functional components)
- **Use shadcn/ui components** when possible for consistency
- **Write accessible code** with proper ARIA labels
- **Add JSDoc comments** for complex functions
- **Keep components small** and focused on a single responsibility

### Component Structure

```tsx
// Example component structure
interface ComponentProps {
  // Props with JSDoc descriptions
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks at the top
  const [state, setState] = useState();
  
  // Event handlers
  const handleEvent = () => {
    // Implementation
  };
  
  // Early returns for loading/error states
  if (loading) return <LoadingSpinner />;
  
  // Main render
  return (
    <div className="component-wrapper">
      {/* Implementation */}
    </div>
  );
}
```

### Git Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(leaderboard): add trophy icons for top performers
fix(auth): handle expired GitHub app installations
docs(readme): update deployment instructions
```

## 🧪 Testing

### Running Tests

```bash
npm run test        # Run test suite
npm run test:watch  # Run tests in watch mode
npm run test:e2e    # Run end-to-end tests
```

### Writing Tests

- **Write tests for new features** and bug fixes
- **Use meaningful test descriptions** that explain what is being tested
- **Follow the AAA pattern** (Arrange, Act, Assert)
- **Mock external dependencies** appropriately

## 📖 Documentation

When contributing, please:

- **Update README.md** if you change functionality
- **Add JSDoc comments** for new functions/components
- **Update deployment docs** if you change setup requirements
- **Add inline comments** for complex logic

## 🔒 Security

- **Never commit sensitive data** (API keys, tokens, passwords)
- **Use environment variables** for configuration
- **Follow security best practices** for authentication and data handling
- **Report security vulnerabilities** privately via GitHub Security Advisories

## 📝 License

By contributing to AI Adoption Leaderboard, you agree that your contributions will be licensed under the MIT License.

## 🆘 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **README.md**: For setup and basic usage instructions
- **DEPLOYMENT.md**: For deployment-specific help

## 🎉 Recognition

Contributors are automatically added to our contributors list via All Contributors bot. We appreciate every contribution, no matter how small!

## 📋 Development Checklist

Before submitting a PR, ensure:

- [ ] Code follows our style guidelines
- [ ] Tests pass locally
- [ ] Build succeeds without warnings
- [ ] Documentation is updated
- [ ] PR description is clear and complete
- [ ] Related issues are linked
- [ ] Screenshots included for UI changes

---

Thank you for contributing to AI Adoption Leaderboard! Your efforts help teams worldwide track and celebrate AI-enhanced development. 🚀