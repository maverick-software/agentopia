import React from 'react';
import { TemplateLoadingSkeleton } from './TemplateLoadingSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export interface LoadingStateManagerProps {
  /** Current loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether there's existing data */
  hasData: boolean;
  /** Number of skeleton rows to show */
  skeletonRows?: number;
  /** Children to render when not loading */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const LoadingStateManager: React.FC<LoadingStateManagerProps> = ({
  loading,
  error,
  hasData,
  skeletonRows = 5,
  children,
  className = ''
}) => {
  // Initial loading state (no data yet)
  if (loading && !hasData) {
    return (
      <div className={className}>
        <TemplateLoadingSkeleton 
          rowCount={skeletonRows}
          showHeader={true}
        />
      </div>
    );
  }

  // Error state (no data available)
  if (error && !hasData) {
    return (
      <div className={`p-4 md:p-6 ${className}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Project Templates</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading templates: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Success state with data
  return (
    <div className={className}>
      {children}
      
      {/* Show refresh indicator if loading with existing data */}
      {loading && hasData && (
        <div className="mt-4 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
            <span>Refreshing templates...</span>
          </div>
        </div>
      )}

      {/* Show error indicator if error with existing data */}
      {error && hasData && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error refreshing templates: {error}. Displaying last known data.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}; 