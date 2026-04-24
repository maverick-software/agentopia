import { Grid, List, Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ViewMode } from '../types';

interface MediaLibraryHeaderProps {
  uploading: boolean;
  viewMode: ViewMode;
  onUploadClick: () => void;
  onToggleViewMode: () => void;
}

export function MediaLibraryHeader({
  uploading,
  viewMode,
  onUploadClick,
  onToggleViewMode,
}: MediaLibraryHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Media Library</h1>
        <p className="text-muted-foreground">
          Manage your documents, images, and media files for agent training. Supports PDF, Word, PowerPoint, text,
          images, audio, and video files up to 50MB each.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onUploadClick} disabled={uploading}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Files'}
        </Button>
        <Button variant="outline" size="sm" onClick={onToggleViewMode}>
          {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}
