import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateTableSkeleton } from './TemplateTableSkeleton';

export interface TemplateLoadingSkeletonProps {
  /** Number of skeleton rows to display */
  rowCount?: number;
  /** Whether to show the header skeleton */
  showHeader?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const TemplateLoadingSkeleton: React.FC<TemplateLoadingSkeletonProps> = ({
  rowCount = 5,
  showHeader = true,
  className = ''
}) => {
  return (
    <div 
      className={`p-4 md:p-6 ${className}`}
      role="status"
      aria-label="Loading project templates"
      aria-live="polite"
    >
      {/* Header Skeleton */}
      {showHeader && (
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-2">
            {/* Title skeleton */}
            <Skeleton className="h-8 w-48" />
            {/* Subtitle skeleton */}
            <Skeleton className="h-4 w-64" />
          </div>
          {/* Create button skeleton */}
          <Skeleton className="h-10 w-40" />
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <TemplateTableSkeleton rowCount={rowCount} />
      </div>

      {/* Screen reader announcement */}
      <span className="sr-only">
        Loading project templates, please wait...
      </span>
    </div>
  );
}; 