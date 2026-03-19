'use client';

import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const CACHE_ENABLED_KEY = 'diskCacheEnabled';

export function getDiskCacheEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(CACHE_ENABLED_KEY);
    if (stored === 'false') return false;
  } catch { /* ignore */ }
  return true;
}

export function CacheSettings() {
  const [enabled, setEnabled] = useState(true);
  const [cacheInfo, setCacheInfo] = useState<{ exists: boolean; sizeKB: number; lastWritten: string | null } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setEnabled(getDiskCacheEnabled());
    fetchCacheInfo();
  }, []);

  const fetchCacheInfo = async () => {
    try {
      const res = await fetch('/api/cache/info');
      if (res.ok) {
        setCacheInfo(await res.json());
      }
    } catch { /* ignore */ }
  };

  const handleToggle = useCallback((newEnabled: boolean) => {
    setEnabled(newEnabled);
    try {
      localStorage.setItem(CACHE_ENABLED_KEY, String(newEnabled));
    } catch { /* ignore */ }
  }, []);

  const handleClearCache = useCallback(async () => {
    setClearing(true);
    try {
      await fetch('/api/cache', { method: 'DELETE' });
      await fetchCacheInfo();
    } catch { /* ignore */ }
    setClearing(false);
  }, []);

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-xl">Local Cache</CardTitle>
          <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs ml-1">
            {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Caches GitHub commit and PR data locally to speed up page loads.
          Historical data is served from cache; new data since the last fetch is always loaded fresh.
        </p>

        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <div className="text-sm font-medium">Enable disk cache</div>
            <div className="text-xs text-muted-foreground">
              When disabled, all data is fetched from GitHub on every load
            </div>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => handleToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              enabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform shadow-sm ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {cacheInfo && (
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Cache file</div>
              <div className="text-xs text-muted-foreground">
                {cacheInfo.exists ? (
                  <>
                    {cacheInfo.sizeKB.toFixed(1)} KB
                    {cacheInfo.lastWritten && (
                      <> &middot; Last updated {new Date(cacheInfo.lastWritten).toLocaleString()}</>
                    )}
                  </>
                ) : (
                  'No cache file yet'
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing || !cacheInfo.exists}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {clearing ? 'Clearing...' : 'Clear Cache'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
