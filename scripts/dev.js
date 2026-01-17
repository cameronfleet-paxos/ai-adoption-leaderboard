#!/usr/bin/env node

/**
 * Interactive development server launcher
 * Prompts user to choose between GitHub App or PAT authentication mode
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           AI Adoption Leaderboard - Dev Server             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function printModeOptions() {
  console.log('Choose authentication mode:\n');
  console.log('  [1] GitHub App Mode (OAuth flow, dynamic repo selection)');
  console.log('      → Best for testing the full production experience');
  console.log('      → Requires GITHUB_APP_* environment variables\n');
  console.log('  [2] Personal Access Token Mode (simple, direct token)');
  console.log('      → Best for quick local development');
  console.log('      → Requires GITHUB_TOKEN and GITHUB_REPOS\n');
  console.log('  [3] Auto-detect (use whatever is configured)');
  console.log('      → Uses PAT if GITHUB_TOKEN is set, otherwise App mode\n');
}

function checkEnvFile() {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(envLocalPath)) {
    return envLocalPath;
  }
  if (fs.existsSync(envPath)) {
    return envPath;
  }
  return null;
}

function parseEnvFile(filePath) {
  if (!filePath) return {};

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2];
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  }

  return env;
}

function checkModeAvailability(env) {
  const hasPAT = !!env.GITHUB_TOKEN;
  const hasApp = !!(
    env.GITHUB_APP_ID &&
    env.GITHUB_APP_PRIVATE_KEY &&
    env.GITHUB_APP_CLIENT_ID &&
    env.GITHUB_APP_CLIENT_SECRET
  );

  return { hasPAT, hasApp };
}

function startDevServer(mode) {
  console.log(`\n🚀 Starting dev server in ${mode.toUpperCase()} mode...\n`);

  const envVars = { ...process.env };

  if (mode === 'pat') {
    // Force PAT mode by unsetting App variables for this session
    envVars.AUTH_MODE_OVERRIDE = 'pat';
  } else if (mode === 'app') {
    // Force App mode by unsetting PAT variable for this session
    envVars.AUTH_MODE_OVERRIDE = 'app';
  }
  // 'auto' mode doesn't set override, uses normal detection

  const child = spawn('npx', ['next', 'dev', '--turbopack'], {
    stdio: 'inherit',
    env: envVars,
    shell: true
  });

  child.on('error', (err) => {
    console.error('Failed to start dev server:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function promptForMode(availability) {
  printModeOptions();

  // Show warnings for unavailable modes
  if (!availability.hasApp) {
    console.log('  ⚠️  GitHub App credentials not found in .env.local');
  }
  if (!availability.hasPAT) {
    console.log('  ⚠️  GITHUB_TOKEN not found in .env.local');
  }
  if (!availability.hasApp && !availability.hasPAT) {
    console.log('\n  ❌ No authentication configured!');
    console.log('     Copy .env.local.example to .env.local and configure credentials.\n');
  }

  console.log('');

  rl.question('Enter choice [1/2/3]: ', (answer) => {
    rl.close();

    const choice = answer.trim();

    switch (choice) {
      case '1':
        if (!availability.hasApp) {
          console.log('\n❌ GitHub App mode requires GITHUB_APP_* environment variables.');
          console.log('   Please configure them in .env.local first.\n');
          process.exit(1);
        }
        startDevServer('app');
        break;
      case '2':
        if (!availability.hasPAT) {
          console.log('\n❌ PAT mode requires GITHUB_TOKEN and GITHUB_REPOS environment variables.');
          console.log('   Please configure them in .env.local first.\n');
          process.exit(1);
        }
        startDevServer('pat');
        break;
      case '3':
      case '':
        startDevServer('auto');
        break;
      default:
        console.log('\n❌ Invalid choice. Please enter 1, 2, or 3.\n');
        process.exit(1);
    }
  });
}

// Main
clearScreen();
printHeader();

const envFile = checkEnvFile();
if (!envFile) {
  console.log('⚠️  No .env.local or .env file found.');
  console.log('   Copy .env.local.example to .env.local to get started.\n');
}

const env = parseEnvFile(envFile);
const availability = checkModeAvailability(env);

promptForMode(availability);
