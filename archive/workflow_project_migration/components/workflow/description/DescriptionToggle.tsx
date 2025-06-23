import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Info, Edit2, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DescriptionToggleProps {
  /** Current description text */
  description?: string;
  /** Placeholder text when description is empty */
  placeholder?: string;
  /** Whether the description is initially expanded */
  defaultExpanded?: boolean;
  /** Whether editing is allowed */
  allowEdit?: boolean;
  /** Callback when description is updated */
  onUpdate?: (description: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the info icon */
  showIcon?: boolean;
  /** Only show the trigger button, not the content */
  triggerOnly?: boolean;
  /** Only show the content area, not the trigger button */
  contentOnly?: boolean;
  /** External control of expanded state */
  isExpanded?: boolean;
  /** External control of editing state */
  isEditing?: boolean;
  /** Callback when expand state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Callback when editing state changes */
  onEditingChange?: (editing: boolean) => void;
}

export const DescriptionToggle: React.FC<DescriptionToggleProps> = ({
  description,
  placeholder = "Add a description...",
  defaultExpanded = false,
  allowEdit = true,
  onUpdate,
  className = '',
  size = 'md',
  showIcon = true,
  triggerOnly = false,
  contentOnly = false,
  isExpanded: externalExpanded,
  isEditing: externalEditing,
  onExpandedChange,
  onEditingChange
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded || !!description);
  const [internalEditing, setInternalEditing] = useState(false);
  const [editValue, setEditValue] = useState(description || '');

  // Use external state if provided, otherwise use internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const isEditing = externalEditing !== undefined ? externalEditing : internalEditing;

  const setIsExpanded = (value: boolean) => {
    if (externalExpanded !== undefined && onExpandedChange) {
      onExpandedChange(value);
    } else {
      setInternalExpanded(value);
    }
  };

  const setIsEditing = (value: boolean) => {
    if (externalEditing !== undefined && onEditingChange) {
      onEditingChange(value);
    } else {
      setInternalEditing(value);
    }
  };

  const hasDescription = !!description?.trim();

  const handleToggle = () => {
    // Always go directly to edit mode when clicking the button
    setEditValue(description || '');
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleEdit = () => {
    setEditValue(description || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(description || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={cn('space-y-2 w-full', className)}>
      {/* Toggle Button */}
      {!contentOnly && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className={cn(
            'h-auto px-2 py-1 text-muted-foreground hover:text-foreground transition-colors',
            sizeClasses[size]
          )}
        >
          <span>
            {hasDescription ? 'Description' : 'Add description'}
          </span>
        </Button>
      )}

      {/* Expandable Content */}
      {!triggerOnly && isExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 w-full">
          {isEditing ? (
            /* Edit Mode */
            <div className="space-y-2 w-full">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  'min-h-[80px] max-h-[200px] resize-y w-full',
                  sizeClasses[size]
                )}
                autoFocus
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <span className="text-xs text-muted-foreground">
                  Ctrl+Enter to save, Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            /* Display Mode */
            <div className="group relative w-full">
              {hasDescription ? (
                <div className={cn(
                  'p-3 bg-muted/30 rounded-md border border-muted w-full',
                  sizeClasses[size]
                )}>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {description}
                  </div>
                  {allowEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEdit}
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No description yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 