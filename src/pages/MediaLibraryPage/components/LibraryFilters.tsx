import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MediaCategory, SortOrder } from '../types';
import { getCategoryIcon } from './mediaLibraryUtils';

interface LibraryFiltersProps {
  categories: MediaCategory[];
  searchQuery: string;
  selectedCategory: string;
  selectedStatus: string;
  sortBy: string;
  sortOrder: SortOrder;
  onSearchQueryChange: (value: string) => void;
  onSelectedCategoryChange: (value: string) => void;
  onSelectedStatusChange: (value: string) => void;
  onSortChange: (field: string, order: SortOrder) => void;
}

export function LibraryFilters({
  categories,
  searchQuery,
  selectedCategory,
  selectedStatus,
  sortBy,
  sortOrder,
  onSearchQueryChange,
  onSelectedCategoryChange,
  onSelectedStatusChange,
  onSortChange,
}: LibraryFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files, descriptions, tags..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Select value={selectedCategory} onValueChange={onSelectedCategoryChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category.icon_name)}
                  {category.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={onSelectedStatusChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={`${sortBy}_${sortOrder}`}
          onValueChange={(value) => {
            const [field, order] = value.split('_');
            onSortChange(field, order as SortOrder);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at_desc">Newest First</SelectItem>
            <SelectItem value="created_at_asc">Oldest First</SelectItem>
            <SelectItem value="file_name_asc">Name A-Z</SelectItem>
            <SelectItem value="file_name_desc">Name Z-A</SelectItem>
            <SelectItem value="file_size_desc">Largest First</SelectItem>
            <SelectItem value="file_size_asc">Smallest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
