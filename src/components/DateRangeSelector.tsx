import { useState } from 'react';
import { Calendar, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DateRangeSelector({ startDate, endDate, onDateChange, onRefresh, isLoading = false }: DateRangeSelectorProps) {
  const [activePreset, setActivePreset] = useState<string>('week');

  const handlePresetSelect = (preset: string) => {
    setActivePreset(preset);
    const end = new Date();
    const start = new Date();
    
    // Set end date to tomorrow to include all of today
    end.setDate(end.getDate() + 1);
    
    switch (preset) {
      case 'week':
        start.setDate(start.getDate() - 6); // 7 days including today
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        start.setDate(start.getDate() + 1); // Adjust to include today
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        start.setDate(start.getDate() + 1); // Adjust to include today
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        start.setDate(start.getDate() + 1); // Adjust to include today
        break;
    }
    
    onDateChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const presets = [
    { key: 'week', label: 'Past Week', icon: Calendar },
    { key: 'month', label: 'Past Month', icon: Calendar },
    { key: 'quarter', label: 'Past Quarter', icon: Calendar },
    { key: 'year', label: 'Past Year', icon: Calendar },
  ];

  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Date Range Selection
          {activePreset !== 'custom' && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {presets.find(p => p.key === activePreset)?.label}
            </Badge>
          )}
          {activePreset === 'custom' && (
            <Badge variant="outline" className="ml-auto text-xs">
              Custom Range
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const IconComponent = preset.icon;
            return (
              <Button
                key={preset.key}
                variant={activePreset === preset.key ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetSelect(preset.key)}
                className="text-sm"
              >
                <IconComponent className="h-3 w-3 mr-1" />
                {preset.label}
              </Button>
            );
          })}
        </div>
        
        {/* Custom date inputs */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              From:
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setActivePreset('custom');
                onDateChange(e.target.value, endDate);
              }}
              className={cn(
                "w-auto",
                activePreset === 'custom' && "ring-1 ring-primary"
              )}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              To:
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setActivePreset('custom');
                onDateChange(startDate, e.target.value);
              }}
              className={cn(
                "w-auto",
                activePreset === 'custom' && "ring-1 ring-primary"
              )}
            />
          </div>
          
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="secondary"
            className="ml-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}