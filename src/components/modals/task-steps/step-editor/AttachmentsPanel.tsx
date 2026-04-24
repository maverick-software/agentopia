import React from 'react';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AttachedFile } from './types';

interface AttachmentsPanelProps {
  attachedFiles: AttachedFile[];
  isUploading: boolean;
  isSaving: boolean;
  onUploadFiles: (files: File[]) => void;
  onOpenLibrary: () => void;
  onRemoveFile: (fileId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  isEditing: boolean;
}

export function AttachmentsPanel({
  attachedFiles,
  isUploading,
  isSaving,
  onUploadFiles,
  onOpenLibrary,
  onRemoveFile,
  onCancel,
  onSave,
  isEditing,
}: AttachmentsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">File Attachments</Label>
        <p className="text-xs text-muted-foreground">
          Upload files or attach from media library to provide additional context for this step.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp';
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) onUploadFiles(Array.from(files));
              };
              input.click();
            }}
            className="flex-1"
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenLibrary} className="flex-1">
            <Paperclip className="h-4 w-4 mr-2" />
            From Library
          </Button>
        </div>

        {attachedFiles.length > 0 && (
          <Card className="rounded-lg">
            <CardContent className="p-3">
              <h4 className="text-sm font-medium text-foreground mb-2">Attached Files ({attachedFiles.length})</h4>
              <div className="space-y-2">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(file.id)}
                      className="p-1 h-6 w-6 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 rounded-lg">
          <CardContent className="p-3">
            <h4 className="text-sm font-medium text-foreground mb-2">Supported File Types</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Documents:</strong> PDF, DOC, DOCX, TXT, MD
              </p>
              <p>
                <strong>Data:</strong> JSON, CSV, XLSX, XLS
              </p>
              <p>
                <strong>Images:</strong> PNG, JPG, JPEG, GIF, WEBP
              </p>
              <p className="mt-2 text-blue-600 dark:text-blue-400">
                Files are stored in your media library and can be reused across steps.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between space-x-3 pt-4 border-t border-border dark:border-border">
          <Button variant="outline" onClick={onCancel} disabled={isSaving} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving} className="flex-1">
            {isSaving ? 'Saving...' : isEditing ? 'Update Step' : 'Add Step'}
          </Button>
        </div>
      </div>
    </div>
  );
}
