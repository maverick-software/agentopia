import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MediaStats } from '../types';
import { getFileTypeIcon, getStatusBadgeVariant } from './mediaLibraryUtils';

interface AnalyticsTabProps {
  stats: MediaStats | null;
}

export function AnalyticsTab({ stats }: AnalyticsTabProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Analytics</h2>
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Files by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.files_by_status ? (
                  Object.entries(stats.files_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No status data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Files by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.files_by_type ? (
                  Object.entries(stats.files_by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getFileTypeIcon(`application/${type}`)}
                        <span className="text-sm">{type}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No type data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
