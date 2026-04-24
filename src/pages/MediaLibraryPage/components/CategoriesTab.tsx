import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { MediaCategory } from '../types';
import { getCategoryIcon } from './mediaLibraryUtils';

interface CategoriesTabProps {
  categories: MediaCategory[];
}

export function CategoriesTab({ categories }: CategoriesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Categories</h2>
        <Button>
          <FolderPlus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                {getCategoryIcon(category.icon_name)}
                <h4 className="font-medium">{category.name}</h4>
              </div>
              {category.description && <p className="text-sm text-muted-foreground mb-2">{category.description}</p>}
              <p className="text-xs text-muted-foreground">
                {category.media_count} file{category.media_count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
