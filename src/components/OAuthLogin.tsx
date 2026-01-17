'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface OAuthLoginProps {
  onShowPATForm?: () => void;
}

export function OAuthLogin({ onShowPATForm }: OAuthLoginProps) {
  const [includePrivate, setIncludePrivate] = useState(false);

  const handleLogin = () => {
    // Redirect to the OAuth initiation endpoint with private preference
    const url = includePrivate ? '/api/auth/github?private=true' : '/api/auth/github';
    window.location.href = url;
  };

  return (
    <Card className="max-w-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </div>
        <CardTitle className="text-2xl">Connect with GitHub</CardTitle>
        <CardDescription className="text-base">
          Sign in with your GitHub account to analyze AI-assisted commits across your repositories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <Button onClick={handleLogin} size="lg" className="w-full">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </Button>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            {includePrivate ? (
              <>Permissions: <code className="bg-muted px-1 rounded">repo</code> (read/write) and <code className="bg-muted px-1 rounded">read:org</code></>
            ) : (
              <>Permissions: <code className="bg-muted px-1 rounded">public_repo</code> (read-only) and <code className="bg-muted px-1 rounded">read:org</code></>
            )}
          </p>
        </div>

        {onShowPATForm && (
          <div className="pt-4 border-t">
            <button
              onClick={onShowPATForm}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Use Personal Access Token instead
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
