'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  ErrorBar, Rectangle,
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PercentileStats, ExtremePR } from '@/lib/github-client';

const BUCKET_COLORS = {
  Human: 'hsl(215, 15%, 55%)',
  'AI-Assisted': 'hsl(262, 83%, 58%)',
  Agent: 'hsl(172, 66%, 50%)',
};

type ViewMode = 'bar' | 'boxplot';

interface ProductivityComparisonChartProps {
  title: string;
  unit: string;
  human: PercentileStats;
  aiAssisted: PercentileStats;
  agent: PercentileStats;
  isPercentage?: boolean;
  tooltip?: string;
  viewMode?: ViewMode;
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value}%`;
  if (unit === 'hours') {
    if (value >= 48) return `${(value / 24).toFixed(1)}d`;
    return `${value.toFixed(1)}h`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

// Custom shape that renders the IQR box with a median line
function BoxPlotShape(props: Record<string, unknown>) {
  const { x, y, width, height, payload } = props as {
    x: number; y: number; width: number; height: number;
    payload: { color: string; median: number; p25: number; p75: number; p10: number; p90: number };
  };
  const color = payload.color;

  // y and height represent the IQR bar (p25 to p75)
  // We need to figure out where the median line goes within this box
  const p25 = payload.p25;
  const p75 = payload.p75;
  const med = payload.median;

  // Calculate median position as fraction within the box
  const range = p75 - p25;
  // Note: in recharts, y is top of bar (p75), y+height is bottom (p25)
  const medianY = range > 0
    ? y + height * (1 - (med - p25) / range)
    : y + height / 2;

  return (
    <g>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} opacity={0.7} radius={[2, 2, 2, 2]} />
      <line
        x1={x + 2}
        y1={medianY}
        x2={x + width - 2}
        y2={medianY}
        stroke={color}
        strokeWidth={2.5}
      />
    </g>
  );
}

export function ProductivityComparisonChart({
  title,
  unit,
  human,
  aiAssisted,
  agent,
  isPercentage = false,
  tooltip,
  viewMode = 'bar',
}: ProductivityComparisonChartProps) {
  const chartData = useMemo(() => {
    const entry = (name: string, stats: PercentileStats, color: string) => ({
      name,
      median: stats.median, p10: stats.p10, p25: stats.p25, p75: stats.p75, p90: stats.p90,
      base: stats.p25,
      iqr: Math.max(0, stats.p75 - stats.p25),
      whiskerLow: [Math.max(0, stats.p25 - stats.p10)],
      whiskerHigh: [Math.max(0, stats.p90 - stats.p75)],
      min: stats.min,
      max: stats.max,
      color,
    });
    return [
      entry('Human', human, BUCKET_COLORS.Human),
      entry('AI-Assisted', aiAssisted, BUCKET_COLORS['AI-Assisted']),
      entry('Agent', agent, BUCKET_COLORS.Agent),
    ];
  }, [human, aiAssisted, agent]);

  const allZero = chartData.every(d => d.median === 0 && d.p25 === 0 && d.p75 === 0);

  const headerContent = (
    <div className="flex items-center gap-1.5 mb-3">
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
  );

  if (allZero) {
    return (
      <div>
        {headerContent}
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          No data available
        </div>
      </div>
    );
  }

  const isBoxPlot = viewMode === 'boxplot' && !isPercentage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipContent = ({ active, payload }: { active?: boolean; payload?: readonly any[] }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload as typeof chartData[0];
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-sm max-w-xs">
        <p className="font-medium mb-1">{data.name}</p>
        <p>Median: <span className="font-semibold">{formatValue(data.median, unit)}</span></p>
        {isBoxPlot ? (
          <div className="text-muted-foreground text-xs space-y-0.5 mt-1">
            <p>P90: {formatValue(data.p90, unit)}</p>
            <p>P75: {formatValue(data.p75, unit)}</p>
            <p>P25: {formatValue(data.p25, unit)}</p>
            <p>P10: {formatValue(data.p10, unit)}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            P25–P75: {formatValue(data.p25, unit)} – {formatValue(data.p75, unit)}
          </p>
        )}
      </div>
    );
  };

  const hasExtremes = chartData.some(d => d.min || d.max);

  return (
    <div>
      {headerContent}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              domain={isPercentage ? [0, 100] : [0, 'auto']}
              tickFormatter={(v) => formatValue(v, unit)}
              width={45}
            />
            <RechartsTooltip content={tooltipContent} />
            {isBoxPlot ? (
              <>
                {/* Invisible base bar from 0 to P25 */}
                <Bar dataKey="base" stackId="box" fill="transparent" maxBarSize={60} />
                {/* IQR bar from P25 to P75 with whiskers */}
                <Bar
                  dataKey="iqr"
                  stackId="box"
                  maxBarSize={60}
                  shape={<BoxPlotShape />}
                >
                  <ErrorBar dataKey="whiskerHigh" direction="y" width={8} strokeWidth={1.5} stroke="currentColor" className="text-muted-foreground" />
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </>
            ) : (
              <Bar dataKey="median" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hasExtremes && (
        <ExtremesTable data={chartData} unit={unit} />
      )}
    </div>
  );
}

function ExtremeLink({ extreme, unit }: { extreme: ExtremePR; unit: string }) {
  const url = `https://github.com/${extreme.repo}/pull/${extreme.number}`;
  const shortTitle = extreme.title.length > 25
    ? extreme.title.slice(0, 25) + '…'
    : extreme.title;
  return (
    <span>
      {formatValue(extreme.value, unit)}{' '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-500 hover:text-blue-400"
      >
        #{extreme.number}
      </a>
      <span className="text-muted-foreground/60 ml-1">{shortTitle}</span>
    </span>
  );
}

function ExtremesTable({ data, unit }: { data: Array<{ name: string; color: string; min?: ExtremePR; max?: ExtremePR }>; unit: string }) {
  return (
    <div className="mt-2 text-[11px] leading-relaxed">
      <table className="w-full">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium pr-3 pb-0.5"></th>
            <th className="text-left font-medium pr-3 pb-0.5">Min</th>
            <th className="text-left font-medium pb-0.5">Max</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            (d.min || d.max) ? (
              <tr key={d.name}>
                <td className="pr-3 font-medium" style={{ color: d.color }}>{d.name}</td>
                <td className="pr-3">
                  {d.min ? <ExtremeLink extreme={d.min} unit={unit} /> : '–'}
                </td>
                <td>
                  {d.max ? <ExtremeLink extreme={d.max} unit={unit} /> : '–'}
                </td>
              </tr>
            ) : null
          ))}
        </tbody>
      </table>
    </div>
  );
}
