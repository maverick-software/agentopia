export interface MediaFile {
  id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  category: string;
  tags: string[];
  description?: string;
  processing_status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'archived';
  assigned_agents_count: number;
  created_at: string;
  updated_at: string;
  file_url?: string;
  chunk_count: number;
  storage_path: string;
}

export interface MediaCategory {
  id: string;
  name: string;
  description?: string;
  color_hex?: string;
  icon_name?: string;
  media_count: number;
}

export interface MediaStats {
  total_files: number;
  total_size_bytes: number;
  files_by_status: Record<string, number>;
  files_by_type: Record<string, number>;
  categories_count: number;
  assigned_files_count: number;
}

export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
