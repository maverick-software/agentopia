import { Archive, FileText, HardDrive, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { MediaStats } from '../types';
import { formatFileSize } from './mediaLibraryUtils';

interface MediaStatsCardsProps {
  stats: MediaStats | null;
}

export function MediaStatsCards({ stats }: MediaStatsCardsProps) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Files</p>
              <p className="text-2xl font-bold">{stats.total_files}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Storage Used</p>
              <p className="text-2xl font-bold">{formatFileSize(stats.total_size_bytes)}</p>
            </div>
            <HardDrive className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{stats.categories_count}</p>
            </div>
            <Archive className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Assigned to Agents</p>
              <p className="text-2xl font-bold">{stats.assigned_files_count}</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
