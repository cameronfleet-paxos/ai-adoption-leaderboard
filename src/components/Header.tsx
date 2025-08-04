import { Settings, ExternalLink, Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  repositoryCount?: number;
  onManageSettings?: () => void;
  onAddOrganizations?: () => void;
  onLogout?: () => void;
  isAuthenticated?: boolean;
}

export function Header({ 
  repositoryCount, 
  onManageSettings, 
  onAddOrganizations, 
  onLogout, 
  isAuthenticated = false 
}: HeaderProps) {

  return (
    <header className="relative mb-12">
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                AI Adoption Leaderboard
              </h1>
            </div>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track and celebrate developers using AI to enhance their productivity through
            <span className="font-semibold text-blue-600 dark:text-blue-400"> Claude co-authored commits</span>
          </p>
        </div>
        
        {isAuthenticated && (
          <div className="absolute top-0 right-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <div className="font-medium">GitHub App Settings</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {repositoryCount} {repositoryCount === 1 ? 'repository' : 'repositories'} connected
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onManageSettings}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddOrganizations}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Organizations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}