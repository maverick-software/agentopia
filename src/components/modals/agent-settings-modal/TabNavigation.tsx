import React from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SYSTEM_AGENT_DISABLED_TABS, TABS, TabId } from './config';

interface TabNavigationProps {
  isMobile: boolean;
  activeTab: TabId;
  isSystemAgent: boolean;
  isAdmin: boolean;
  onTabChange: (tabId: TabId) => void;
}

export function TabNavigation({ isMobile, activeTab, isSystemAgent, isAdmin, onTabChange }: TabNavigationProps) {
  const visibleTabs = TABS.filter((tab) => !(isSystemAgent && !isAdmin && SYSTEM_AGENT_DISABLED_TABS.includes(tab.id)));

  if (isMobile) {
    return (
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-background">
        <Select value={activeTab} onValueChange={(value) => onTabChange(value as TabId)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(() => {
                const currentTab = TABS.find((tab) => tab.id === activeTab);
                const Icon = currentTab?.icon || Settings;
                return (
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{currentTab?.label || 'Select Tab'}</span>
                  </div>
                );
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {visibleTabs.map((tab) => {
              if (tab.disabled) return null;
              const Icon = tab.icon;
              return (
                <SelectItem key={tab.id} value={tab.id}>
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.comingSoon && <span className="text-xs text-muted-foreground">(Soon)</span>}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="w-56 border-r border-border dark:border-border bg-muted/30 dark:bg-muted/30">
      <div className="h-full overflow-y-auto">
        <div className="p-3 space-y-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;
            const isStandOut = tab.standOut === true;

            const tabButton = (
              <button
                key={tab.id}
                onClick={() => !isDisabled && onTabChange(tab.id)}
                disabled={isDisabled}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors',
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                    : isStandOut
                    ? isActive
                      ? 'bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground'
                      : 'hover:bg-muted dark:hover:bg-muted text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                    : isActive
                    ? 'bg-primary dark:bg-primary text-primary-foreground dark:text-primary-foreground'
                    : 'hover:bg-muted dark:hover:bg-muted text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground',
                )}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={cn('h-4 w-4 flex-shrink-0', isStandOut && !isActive && 'text-blue-600 dark:text-blue-400')} />
                  <div className={cn('font-medium text-sm', isStandOut && 'font-semibold')}>{tab.label}</div>
                  {tab.comingSoon && (
                    <div className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soon</div>
                  )}
                </div>
                {isActive && !isDisabled && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            );

            if (tab.comingSoon && isDisabled) {
              return (
                <TooltipProvider key={tab.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>{tabButton}</TooltipTrigger>
                    <TooltipContent>
                      <p>Coming Soon</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return tabButton;
          })}
        </div>
      </div>
    </div>
  );
}
