import type { Datastore } from '@/types';

export interface WhatIKnowModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export interface MemoryPreferenceItem {
  id: string;
  label: string;
  description: string;
}

export const MEMORY_PREFERENCES: MemoryPreferenceItem[] = [
  {
    id: 'remember_preferences',
    label: 'Remember your preferences',
    description: 'Your communication style, work patterns, and personal preferences',
  },
  {
    id: 'track_projects',
    label: 'Keep track of ongoing projects',
    description: 'Project status, deadlines, and collaborative work details',
  },
  {
    id: 'learn_conversations',
    label: 'Learn from our conversations',
    description: 'Patterns, insights, and context from our chat history',
  },
  {
    id: 'forget_sessions',
    label: 'Forget after each session',
    description: 'Start fresh each time without remembering previous conversations',
  },
];

export interface WhatIKnowModalState {
  availableDatastores: Datastore[];
  connectedDatastores: string[];
  memoryPreferences: string[];
  contextHistorySize: number;
  loading: boolean;
  loadingDatastores: boolean;
  saved: boolean;
  assignedMediaCount: number;
  showMediaLibrarySelector: boolean;
  showVectorSelection: boolean;
  setShowVectorSelection: (value: boolean) => void;
  setShowMediaLibrarySelector: (value: boolean) => void;
  setAssignedMediaCount: (updater: (prev: number) => number) => void;
  handleSelectVectorDatastore: () => void;
  handleToggleMemoryPreference: (preferenceId: string) => void;
  handleContextSizeChange: (value: number[]) => void;
  handleVectorDatastoreSelect: (datastoreId: string) => void;
  handleSave: () => Promise<void>;
  hasChanges: () => boolean;
  getDatastoresByType: (type: 'pinecone') => Datastore[];
}
