'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  requestDeviceCode,
  pollForToken,
  fetchUser,
  saveAuthState,
  type DeviceCodeResponse,
  type GitHubUser,
} from '@/lib/github-device-auth';

interface DeviceFlowAuthProps {
  onAuthenticated: (token: string, user: GitHubUser) => void;
}

type AuthStep = 'idle' | 'requesting' | 'waiting' | 'polling' | 'success' | 'error';

export function DeviceFlowAuth({ onAuthenticated }: DeviceFlowAuthProps) {
  const [step, setStep] = useState<AuthStep>('idle');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);

  const startAuth = useCallback(async () => {
    setStep('requesting');
    setError(null);

    try {
      const code = await requestDeviceCode(includePrivate);
      setDeviceCode(code);
      setStep('waiting');

      // Start polling in the background
      const token = await pollForToken(
        code.device_code,
        code.interval,
        code.expires_in,
        () => setStep('polling')
      );

      // Fetch user info
      const user = await fetchUser(token);

      // Save to localStorage
      saveAuthState(token, user);

      setStep('success');

      // Notify parent
      onAuthenticated(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setStep('error');
    }
  }, [onAuthenticated, includePrivate]);

  const copyCode = useCallback(async () => {
    if (!deviceCode?.user_code) return;

    try {
      await navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = deviceCode.user_code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceCode?.user_code]);

  const openGitHub = useCallback(() => {
    if (deviceCode?.verification_uri) {
      window.open(deviceCode.verification_uri, '_blank');
    }
  }, [deviceCode?.verification_uri]);

  // Idle state - show connect button
  if (step === 'idle') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Connect GitHub</CardTitle>
          <CardDescription className="text-base">
            Sign in with GitHub to analyze AI-assisted commits across your repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Repository access option */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePrivate}
                onChange={(e) => setIncludePrivate(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <div className="text-sm">
                <span className="font-medium">Include private repositories</span>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Requires full repository access. Leave unchecked for read-only public repo access.
                </p>
              </div>
            </label>
          </div>

          <Button onClick={startAuth} size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </Button>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {includePrivate ? (
                <>Permissions: <code className="bg-muted px-1 rounded">repo</code> (read/write) and <code className="bg-muted px-1 rounded">read:org</code></>
              ) : (
                <>Permissions: <code className="bg-muted px-1 rounded">public_repo</code> (read-only) and <code className="bg-muted px-1 rounded">read:org</code></>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Requesting state - show loading
  if (step === 'requesting') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connecting...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  // Waiting/Polling state - show device code
  if (step === 'waiting' || step === 'polling') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Enter Code on GitHub</CardTitle>
          <CardDescription className="text-base">
            Copy this code and enter it on GitHub to complete sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Code Display */}
          <div className="bg-muted rounded-lg p-6 text-center">
            <div className="font-mono text-4xl font-bold tracking-widest text-primary mb-4">
              {deviceCode?.user_code}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </>
              )}
            </Button>
          </div>

          {/* Open GitHub Button */}
          <Button onClick={openGitHub} size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Open GitHub to Enter Code
          </Button>

          {/* Status */}
          <div className="text-center text-sm text-muted-foreground">
            {step === 'polling' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Waiting for authorization...
              </div>
            ) : (
              'Click the button above after copying the code'
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Authentication Failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">{error}</p>
          <Button onClick={() => setStep('idle')} size="lg" className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success state (brief, before redirect)
  return (
    <Card className="max-w-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle className="text-2xl">Connected!</CardTitle>
        <CardDescription>Loading your repositories...</CardDescription>
      </CardHeader>
    </Card>
  );
}
