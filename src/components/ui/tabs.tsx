'use client';

import { cn } from '@/lib/utils';

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-muted p-1',
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TabsTrigger({ children, active, onClick, className }: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
}
