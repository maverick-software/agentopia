import type { 
  UnifiedWorkflowTemplate, 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';

// Enhanced Flow Builder types for unified hierarchy
export type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

export interface UnifiedWorkflowBuilderState {
  template: UnifiedWorkflowTemplate | null;
  stages: UnifiedWorkflowStage[];
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
  activeLevel: HierarchyLevel;
  selectedItem: string | null;
  expandedItems: Set<string>;
  isDirty: boolean;
  isLoading: boolean;
  errors: string[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export interface DraggedItem {
  id: string;
  type: HierarchyLevel | 'palette-element';
  data?: any;
}

// Template data interface for state updates
export interface TemplateData {
  template?: UnifiedWorkflowTemplate | null;
  stages?: UnifiedWorkflowStage[];
  tasks?: UnifiedWorkflowTask[];
  steps?: UnifiedWorkflowStep[];
  elements?: UnifiedWorkflowElement[];
}

// Use Handlers Props interface
export interface UseHandlersProps {
  elementManager: {
    addStage: () => Promise<void>;
    addTask: (stageId: string) => Promise<void>;
    addStep: (taskId: string) => Promise<void>;
    handleDragStart: (event: any) => void;
    handleDragEnd: (event: any) => void;
    activeId: string | null;
  };
  uiState: {
    isDirty: boolean;
    markDirty: () => void;
    selectTemplate: () => void;
    selectStage: (id: string) => void;
    selectTask: (id: string) => void;
    selectStep: (id: string) => void;
    selectElement: (id: string) => void;
    toggleStageExpansion: (id: string) => void;
    toggleTaskExpansion: (id: string) => void;
  };
  saveManager: {
    handleSave: (data: any, isNew: boolean) => void;
  };
  state: UnifiedWorkflowBuilderState;
  isNewTemplate: boolean;
  onStateUpdate: (updates: Partial<TemplateData>) => void;
} 