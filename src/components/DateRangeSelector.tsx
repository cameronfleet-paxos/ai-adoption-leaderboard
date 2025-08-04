import { useState } from 'react';

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
    
    switch (preset) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    onDateChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Date Range</h3>
      
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => handlePresetSelect('week')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activePreset === 'week' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Past Week
          </button>
          <button
            onClick={() => handlePresetSelect('month')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activePreset === 'month' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Past Month
          </button>
          <button
            onClick={() => handlePresetSelect('quarter')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activePreset === 'quarter' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Past Quarter
          </button>
          <button
            onClick={() => handlePresetSelect('year')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activePreset === 'year' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Past Year
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setActivePreset('custom');
              onDateChange(e.target.value, endDate);
            }}
            className={`px-3 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              activePreset === 'custom' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
            } text-gray-900 dark:text-white`}
          />
          
          <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setActivePreset('custom');
              onDateChange(startDate, e.target.value);
            }}
            className={`px-3 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              activePreset === 'custom' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
            } text-gray-900 dark:text-white`}
          />
          
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}