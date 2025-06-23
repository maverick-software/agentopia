import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TemplateRowSkeleton } from './TemplateRowSkeleton';

export interface TemplateTableSkeletonProps {
  /** Number of skeleton rows to display */
  rowCount?: number;
  /** Additional CSS classes */
  className?: string;
}

export const TemplateTableSkeleton: React.FC<TemplateTableSkeletonProps> = ({
  rowCount = 5,
  className = ''
}) => {
  return (
    <Table className={className}>
      {/* Table Header Skeleton */}
      <TableHeader>
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-24" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-12" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20" />
          </TableHead>
          <TableHead className="text-right">
            <Skeleton className="h-4 w-16 ml-auto" />
          </TableHead>
        </TableRow>
      </TableHeader>

      {/* Table Body Skeleton */}
      <TableBody>
        {Array.from({ length: rowCount }, (_, index) => (
          <TemplateRowSkeleton key={index} />
        ))}
      </TableBody>
    </Table>
  );
}; 