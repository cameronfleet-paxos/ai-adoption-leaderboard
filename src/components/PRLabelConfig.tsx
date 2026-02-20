'use client';

import { useState } from 'react';
import { Tag, ChevronDown, X, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  type PRLabelConfig as PRLabelConfigType,
  type AITool,
  AI_TOOLS,
} from '@/lib/github-client';

interface PRLabelConfigProps {
  labelConfig: PRLabelConfigType;
  onLabelConfigChange: (config: PRLabelConfigType) => void;
  selectedRepos: string[];
}

const AI_TOOL_OPTIONS: { value: AITool; label: string }[] = Object.entries(AI_TOOLS).map(
  ([id, info]) => ({ value: id as AITool, label: info.label })
);

export function PRLabelConfig({
  labelConfig,
  onLabelConfigChange,
  selectedRepos,
}: PRLabelConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelTool, setNewLabelTool] = useState<AITool>('claude-generated');

  const enabledCount = labelConfig.labels.filter(l => l.enabled).length;
  const scanRepoCount = labelConfig.labelScanRepos.length;

  // Group labels by AI tool
  const labelsByTool = new Map<AITool, typeof labelConfig.labels>();
  for (const entry of labelConfig.labels) {
    const group = labelsByTool.get(entry.aiTool) || [];
    group.push(entry);
    labelsByTool.set(entry.aiTool, group);
  }

  const handleToggleLabel = (label: string) => {
    onLabelConfigChange({
      ...labelConfig,
      labels: labelConfig.labels.map(l =>
        l.label === label ? { ...l, enabled: !l.enabled } : l
      ),
    });
  };

  const handleRemoveLabel = (label: string) => {
    onLabelConfigChange({
      ...labelConfig,
      labels: labelConfig.labels.filter(l => l.label !== label),
    });
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (labelConfig.labels.some(l => l.label === trimmed)) return;

    onLabelConfigChange({
      ...labelConfig,
      labels: [
        ...labelConfig.labels,
        { label: trimmed, aiTool: newLabelTool, enabled: true, isDefault: false },
      ],
    });
    setNewLabel('');
  };

  const handleToggleScanRepo = (repoName: string) => {
    const isSelected = labelConfig.labelScanRepos.includes(repoName);
    onLabelConfigChange({
      ...labelConfig,
      labelScanRepos: isSelected
        ? labelConfig.labelScanRepos.filter(r => r !== repoName)
        : [...labelConfig.labelScanRepos, repoName],
    });
  };

  const handleSelectAllRepos = () => {
    onLabelConfigChange({
      ...labelConfig,
      labelScanRepos: [...selectedRepos],
    });
  };

  const handleClearAllRepos = () => {
    onLabelConfigChange({
      ...labelConfig,
      labelScanRepos: [],
    });
  };

  return (
    <Card className="mb-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted-foreground transition-transform duration-200',
                    !isOpen && '-rotate-90'
                  )}
                />
                <Tag className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-xl">PR Label Scanning</CardTitle>
                <Badge variant="secondary" className="text-xs ml-1">
                  {enabledCount} {enabledCount === 1 ? 'label' : 'labels'}, {scanRepoCount} {scanRepoCount === 1 ? 'repo' : 'repos'}
                </Badge>
              </button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Section 1: Active Labels grouped by AI tool */}
            <div>
              <h3 className="text-sm font-medium mb-3">Active Labels</h3>
              <div className="space-y-4">
                {Array.from(labelsByTool.entries()).map(([toolId, labels]) => {
                  const toolInfo = AI_TOOLS[toolId];
                  return (
                    <div key={toolId}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full', toolInfo.color)} />
                        <span className="text-sm font-medium text-muted-foreground">
                          {toolInfo.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {labels.map(entry => (
                          <div
                            key={entry.label}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors min-w-0',
                              entry.enabled
                                ? 'bg-primary/5 border-primary/20'
                                : 'opacity-60'
                            )}
                          >
                            <Checkbox
                              checked={entry.enabled}
                              onCheckedChange={() => handleToggleLabel(entry.label)}
                              className="flex-shrink-0"
                            />
                            <code className="text-xs truncate flex-1">{entry.label}</code>
                            {!entry.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 flex-shrink-0 hover:text-destructive"
                                onClick={() => handleRemoveLabel(entry.label)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Add Custom Label */}
            <div>
              <h3 className="text-sm font-medium mb-3">Add Custom Label</h3>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. ai-windsurf"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(); }}
                  className="max-w-xs"
                />
                <select
                  value={newLabelTool}
                  onChange={e => setNewLabelTool(e.target.value as AITool)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {AI_TOOL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLabel}
                  disabled={!newLabel.trim() || labelConfig.labels.some(l => l.label === newLabel.trim())}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Section 3: Repos to Scan */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Repos to Scan</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllRepos}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAllRepos}>
                    Clear All
                  </Button>
                </div>
              </div>
              {selectedRepos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No repositories selected. Choose repos above first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {selectedRepos.map(repoName => {
                      const isScanned = labelConfig.labelScanRepos.includes(repoName);
                      return (
                        <div
                          key={repoName}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer min-w-0',
                            isScanned
                              ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => handleToggleScanRepo(repoName)}
                        >
                          <Checkbox
                            checked={isScanned}
                            onCheckedChange={() => handleToggleScanRepo(repoName)}
                            className="flex-shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{repoName}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Repos not selected here still get commit message pattern scanning.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
