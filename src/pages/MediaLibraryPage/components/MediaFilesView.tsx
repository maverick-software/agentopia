import { Download, Eye, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { MediaFile, ViewMode } from '../types';
import { formatFileSize, getFileTypeIcon, getStatusBadgeVariant } from './mediaLibraryUtils';

interface MediaFilesViewProps {
  loading: boolean;
  filteredFiles: MediaFile[];
  viewMode: ViewMode;
  hasActiveFilters: boolean;
  onView: (file: MediaFile) => void;
  onDownload: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
}

function FileActions({
  file,
  onView,
  onDownload,
  onDelete,
}: {
  file: MediaFile;
  onView: (file: MediaFile) => void;
  onDownload: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(file)}>
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(file)}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div className="text-center p-12 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2">No files found</p>
      <p className="text-sm">{hasActiveFilters ? 'Try adjusting your search or filters' : 'Upload your first file to get started'}</p>
    </div>
  );
}

export function MediaFilesView({
  loading,
  filteredFiles,
  viewMode,
  hasActiveFilters,
  onView,
  onDownload,
  onDelete,
}: MediaFilesViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading media library...</p>
        </div>
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return <EmptyState hasActiveFilters={hasActiveFilters} />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredFiles.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                {getFileTypeIcon(file.file_type)}
                <Badge variant={getStatusBadgeVariant(file.processing_status)}>{file.processing_status}</Badge>
              </div>
              <h4 className="font-medium text-sm mb-1 truncate" title={file.display_name}>
                {file.display_name}
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                {formatFileSize(file.file_size)} • {file.category}
              </p>
              {file.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {file.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {file.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{file.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{file.assigned_agents_count} agents</span>
                <span>{new Date(file.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-end mt-3">
                <FileActions file={file} onView={onView} onDownload={onDownload} onDelete={onDelete} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredFiles.map((file) => (
        <Card key={file.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileTypeIcon(file.file_type)}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{file.display_name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                    <span>{file.category}</span>
                    <span>•</span>
                    <span>{file.assigned_agents_count} agents</span>
                    <span>•</span>
                    <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(file.processing_status)}>{file.processing_status}</Badge>
                <FileActions file={file} onView={onView} onDownload={onDownload} onDelete={onDelete} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
