export interface MediaFile {
  id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: number;
  category: string;
  tags: string[];
  description?: string;
  processing_status: string;
  created_at: string;
  file_url?: string;
  chunk_count: number;
  name?: string;
  size?: number;
  type?: string;
  url?: string;
}

export interface MediaCategory {
  id: string;
  name: string;
  description?: string;
  icon_name?: string;
  media_count: number;
}

export interface MediaLibrarySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  agentName?: string;
  onMediaAssigned?: (assignedMedia: MediaFile[]) => void;
  multiSelect?: boolean;
  assignmentType?: 'training_data' | 'reference' | 'sop' | 'knowledge_base';
  // Backward-compatible aliases used by legacy callsites.
  onSelect?: (selected: MediaFile[]) => void;
  multiple?: boolean;
  title?: string;
  description?: string;
}
