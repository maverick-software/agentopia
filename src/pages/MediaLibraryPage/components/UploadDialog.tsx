import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UploadDialogProps {
  open: boolean;
  uploading: boolean;
  isDragOver: boolean;
  onOpenChange: (open: boolean) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onFileUpload: (files: FileList) => void;
}

export function UploadDialog({
  open,
  uploading,
  isDragOver,
  onOpenChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileUpload,
}: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Media Files</DialogTitle>
          <DialogDescription>
            Upload documents, images, audio, and video files to your media library. Supports files up to 50MB each.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-2">{uploading ? 'Uploading...' : 'Drop files here or click to browse'}</h3>
            <p className="text-sm text-muted-foreground mb-3">Supports documents, images, audio, and video (max 50MB)</p>
            <Button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '*/*';
                input.onchange = (event) => {
                  const files = (event.target as HTMLInputElement).files;
                  if (files) {
                    onFileUpload(files);
                    onOpenChange(false);
                  }
                };
                input.click();
              }}
              disabled={uploading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
