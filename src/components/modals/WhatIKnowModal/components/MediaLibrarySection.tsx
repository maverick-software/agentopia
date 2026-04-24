import React from 'react';
import { FileText, Library, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MediaLibrarySectionProps {
  assignedMediaCount: number;
  onOpenSelector: () => void;
  onManageLibrary: () => void;
}

export const MediaLibrarySection: React.FC<MediaLibrarySectionProps> = ({
  assignedMediaCount,
  onOpenSelector,
  onManageLibrary,
}) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Media Library Documents</Label>
      <Card className="border-2 border-dashed border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
        <CardContent className="p-4 text-center">
          <Library className="h-8 w-8 mx-auto mb-2 text-purple-500" />
          <p className="text-sm font-medium mb-1">
            {assignedMediaCount > 0
              ? `${assignedMediaCount} document${assignedMediaCount !== 1 ? 's' : ''} assigned`
              : 'No documents assigned from Media Library'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Assign documents from your centralized media library for training data
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={onOpenSelector}>
              <Plus className="h-3 w-3 mr-1" />
              Assign from Library
            </Button>
            <Button variant="outline" size="sm" onClick={onManageLibrary}>
              <FileText className="h-3 w-3 mr-1" />
              Manage Library
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
