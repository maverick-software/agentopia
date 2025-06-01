import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

export interface TemplateRowSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

export const TemplateRowSkeleton: React.FC<TemplateRowSkeletonProps> = ({
  className = ''
}) => {
  // Generate random widths for more natural appearance
  const nameWidth = Math.random() > 0.5 ? 'w-32' : 'w-40';
  const descriptionWidth = Math.random() > 0.5 ? 'w-48' : 'w-56';
  const typeWidth = 'w-20';
  const dateWidth = 'w-24';

  return (
    <TableRow className={className}>
      {/* Name Column */}
      <TableCell>
        <Skeleton className={`h-4 ${nameWidth}`} />
      </TableCell>

      {/* Description Column */}
      <TableCell>
        <Skeleton className={`h-4 ${descriptionWidth}`} />
      </TableCell>

      {/* Type Column */}
      <TableCell>
        <Skeleton className={`h-4 ${typeWidth}`} />
      </TableCell>

      {/* Created At Column */}
      <TableCell>
        <Skeleton className={`h-4 ${dateWidth}`} />
      </TableCell>

      {/* Actions Column */}
      <TableCell className="text-right">
        <div className="flex justify-end space-x-2">
          {/* Edit button skeleton */}
          <Skeleton className="h-8 w-8" />
          {/* Delete button skeleton */}
          <Skeleton className="h-8 w-8" />
        </div>
      </TableCell>
    </TableRow>
  );
}; 