'use client';

import React from 'react';
import { ChevronDown, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TaskPriority, PRIORITY_CONFIGS, type PriorityConfig } from '../types/template.types';

interface PrioritySelectorProps {
  value?: TaskPriority | null;
  onChange: (priority: TaskPriority | null) => void;
  disabled?: boolean;
  className?: string;
  error?: string;
  placeholder?: string;
}

export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  className,
  error,
  placeholder = 'Select priority'
}: PrioritySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedConfig = value ? PRIORITY_CONFIGS[value] : null;

  const handleSelect = (priority: TaskPriority | null) => {
    onChange(priority);
    setIsOpen(false);
  };

  const PriorityOption = ({ config, onSelect }: { 
    config: PriorityConfig; 
    onSelect: () => void;
  }) => (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-sm transition-colors text-left"
    >
      <Flag className={cn('h-4 w-4', config.color)} />
      <span className="flex-1">{config.label}</span>
      <div className={cn(
        'w-2 h-2 rounded-full',
        config.color.replace('text-', 'bg-')
      )} />
    </button>
  );

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedConfig && 'text-muted-foreground',
              error && 'border-destructive',
              className
            )}
          >
            <div className="flex items-center gap-2 flex-1">
              {selectedConfig ? (
                <>
                  <Flag className={cn('h-4 w-4', selectedConfig.color)} />
                  <span>{selectedConfig.label}</span>
                  <div className={cn(
                    'w-2 h-2 rounded-full ml-auto mr-2',
                    selectedConfig.color.replace('text-', 'bg-')
                  )} />
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span>{placeholder}</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 bg-card border border-border" align="start">
          <div className="space-y-1">
            {/* Clear selection option */}
            <button
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-sm transition-colors text-left text-muted-foreground"
            >
              <Flag className="h-4 w-4" />
              <span>No priority</span>
            </button>
            
            {/* Priority options */}
            <div className="border-t border-border my-1" />
            <PriorityOption 
              config={PRIORITY_CONFIGS[TaskPriority.HIGH]} 
              onSelect={() => handleSelect(TaskPriority.HIGH)}
            />
            <PriorityOption 
              config={PRIORITY_CONFIGS[TaskPriority.MEDIUM]} 
              onSelect={() => handleSelect(TaskPriority.MEDIUM)}
            />
            <PriorityOption 
              config={PRIORITY_CONFIGS[TaskPriority.LOW]} 
              onSelect={() => handleSelect(TaskPriority.LOW)}
            />
          </div>
        </PopoverContent>
      </Popover>
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

// Utility component for displaying priority badges in read-only contexts
export function PriorityBadge({ 
  priority, 
  className 
}: { 
  priority: TaskPriority | null | undefined; 
  className?: string;
}) {
  if (!priority) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground',
        className
      )}>
        <Flag className="h-3 w-3" />
        No priority
      </span>
    );
  }

  const config = PRIORITY_CONFIGS[priority];
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded text-xs',
      config.bgColor,
      config.textColor,
      className
    )}>
      <Flag className={cn('h-3 w-3', config.color)} />
      {config.label}
    </span>
  );
} 