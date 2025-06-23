import React from 'react';

interface LoadingSpinnerProps {
  migrationMode: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ migrationMode }) => {
  return (
    <div className="p-4">
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span>Loading template...</span>
        <span className="text-xs text-muted-foreground">
          ({migrationMode} mode)
        </span>
      </div>
    </div>
  );
}; 