'use client';

import { useState, useCallback, useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TrendPoint {
  bucket: string;     // "2025-01-06" or "2025-01"
  label: string;      // "Jan 6" or "Jan '25"
  human: number | null;
  aiAssisted: number | null;
  agent: number | null;
  combined: number | null;
}

export type TrendViewMode = 'split' | 'combined';

const SPLIT_SERIES = [
  { key: 'human' as const, name: 'Human', color: 'hsl(215, 15%, 55%)' },
  { key: 'aiAssisted' as const, name: 'AI-Assisted', color: 'hsl(262, 83%, 58%)' },
  { key: 'agent' as const, name: 'Agent', color: 'hsl(172, 66%, 50%)' },
];

const COMBINED_SERIES = [
  { key: 'combined' as const, name: 'All PRs', color: 'hsl(220, 70%, 55%)' },
];

interface TrendLineChartProps {
  data: TrendPoint[];
  title: string;
  unit: string;
  tooltip?: string;
  valueFormatter?: (value: number) => string;
  viewMode?: TrendViewMode;
  excludeZero?: boolean;
}

function defaultFormatter(value: number, unit: string): string {
  if (unit === 'hours') {
    if (value >= 48) return `${(value / 24).toFixed(1)}d`;
    return `${value.toFixed(1)}h`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export function TrendLineChart({ data, title, unit, tooltip, valueFormatter, viewMode = 'split', excludeZero = false }: TrendLineChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const fmt = useCallback((v: number) => valueFormatter ? valueFormatter(v) : defaultFormatter(v, unit), [valueFormatter, unit]);
  const showDots = data.length <= 12;

  const yDomain = useMemo(() => {
    if (!excludeZero) return [0, 'auto'] as [number, string];
    const activeKeys = (viewMode === 'split' ? SPLIT_SERIES : COMBINED_SERIES)
      .filter(s => !hiddenSeries.has(s.key))
      .map(s => s.key);
    const allValues = data.flatMap(p => activeKeys.map(k => p[k])).filter((v): v is number => v != null && v > 0);
    if (allValues.length === 0) return [0, 'auto'] as [number, string];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const buffer = (maxVal - minVal) * 0.1 || minVal * 0.1;
    return [Math.max(0, minVal - buffer), 'auto'] as [number, string];
  }, [excludeZero, data, viewMode, hiddenSeries]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLegendClick = useCallback((entry: any) => {
    const key = String(entry.dataKey);
    if (!key) return;
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipContent = ({ active, payload, label }: { active?: boolean; payload?: readonly any[]; label?: string | number }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-sm max-w-xs">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: { name: string; value: number | null; color: string }) => (
          entry.value != null && (
            <p key={entry.name} style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{fmt(entry.value)}</span> {unit}
            </p>
          )
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {tooltip && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={fmt} width={45} domain={yDomain} />
            <RechartsTooltip content={tooltipContent} />
            {viewMode === 'split' && (
              <Legend
                onClick={handleLegendClick}
                wrapperStyle={{ cursor: 'pointer', fontSize: 11 }}
              />
            )}
            {(viewMode === 'split' ? SPLIT_SERIES : COMBINED_SERIES).map(s => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                dot={showDots ? { r: 3 } : false}
                connectNulls
                hide={hiddenSeries.has(s.key)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
