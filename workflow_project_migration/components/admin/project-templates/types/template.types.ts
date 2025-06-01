// Enhanced type definitions for Project Template System
// Extends the base Supabase types with additional fields and UI-specific types

import { Database } from '@/types/supabase';

// Base types from Supabase
export type ProjectTemplate = Database['public']['Tables']['project_templates']['Row'];
export type ProjectTemplateStage = Database['public']['Tables']['project_template_stages']['Row'];
export type ProjectTemplateTask = Database['public']['Tables']['project_template_tasks']['Row'];

// Enhanced types with new fields
export interface EnhancedProjectTemplateTask extends ProjectTemplateTask {
  // New fields that will be added to the database
  assignee_member_id?: string | null;
  priority?: TaskPriority | null;
  due_date?: string | null; // ISO date string
  
  // UI-specific fields
  isEditing?: boolean;
  tempValues?: Partial<EnhancedProjectTemplateTask>;
}

export interface EnhancedProjectTemplateStage extends ProjectTemplateStage {
  // Include enhanced tasks
  project_template_tasks?: EnhancedProjectTemplateTask[];
  
  // UI-specific fields
  isExpanded?: boolean;
  isEditing?: boolean;
  tempName?: string;
}

export interface EnhancedProjectTemplate extends ProjectTemplate {
  // Include enhanced stages
  project_template_stages?: EnhancedProjectTemplateStage[];
  
  // UI-specific fields
  isNameEditing?: boolean;
  tempName?: string;
}

// Enums for new fields
export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

// Form data types for React Hook Form
export interface TemplateFormData {
  name: string;
  description?: string;
  stages: StageFormData[];
}

export interface StageFormData {
  id?: string;
  name: string;
  description?: string;
  order: number;
  tasks: TaskFormData[];
}

export interface TaskFormData {
  id?: string;
  name: string;
  description?: string;
  default_assignee_role?: string;
  assignee_member_id?: string;
  priority?: TaskPriority;
  due_date?: string; // ISO date string
  estimated_duration_hours?: number;
  order: number;
}

// UI Component Props
export interface TaskRowProps {
  task: EnhancedProjectTemplateTask;
  stageId: string;
  onUpdate: (taskId: string, updates: Partial<EnhancedProjectTemplateTask>) => void;
  onDelete: (taskId: string) => void;
  onStartEdit: (taskId: string) => void;
  onCancelEdit: (taskId: string) => void;
  onSaveEdit: (taskId: string) => void;
}

export interface StageRowProps {
  stage: EnhancedProjectTemplateStage;
  onUpdate: (stageId: string, updates: Partial<EnhancedProjectTemplateStage>) => void;
  onDelete: (stageId: string) => void;
  onAddTask: (stageId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<EnhancedProjectTemplateTask>) => void;
  onTaskDelete: (taskId: string) => void;
  onToggleExpanded: (stageId: string) => void;
}

// Priority display configuration
export interface PriorityConfig {
  value: TaskPriority;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const PRIORITY_CONFIGS: Record<TaskPriority, PriorityConfig> = {
  [TaskPriority.HIGH]: {
    value: TaskPriority.HIGH,
    label: 'High',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800'
  },
  [TaskPriority.MEDIUM]: {
    value: TaskPriority.MEDIUM,
    label: 'Medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800'
  },
  [TaskPriority.LOW]: {
    value: TaskPriority.LOW,
    label: 'Low',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800'
  }
};

// Validation schemas for forms
export interface TaskValidationErrors {
  name?: string;
  estimated_duration_hours?: string;
  due_date?: string;
}

export interface StageValidationErrors {
  name?: string;
  tasks?: TaskValidationErrors[];
}

export interface TemplateValidationErrors {
  name?: string;
  stages?: StageValidationErrors[];
}

// Member selection types (for future implementation)
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role?: string;
}

// Table column definitions
export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
}

export const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Task Name', width: 'flex-1', sortable: true },
  { key: 'assignee', label: 'Assignee', width: 'w-32', filterable: true },
  { key: 'priority', label: 'Priority', width: 'w-24', filterable: true, sortable: true },
  { key: 'due_date', label: 'Due Date', width: 'w-28', sortable: true },
  { key: 'estimated_hours', label: 'Est. Hours', width: 'w-20', sortable: true },
  { key: 'actions', label: 'Actions', width: 'w-20' }
];

// Filtering and sorting types
export interface FilterState {
  priority?: TaskPriority[];
  assignee?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

// Form field validation rules
export const VALIDATION_RULES = {
  taskName: {
    required: 'Task name is required',
    minLength: { value: 2, message: 'Task name must be at least 2 characters' },
    maxLength: { value: 100, message: 'Task name must be less than 100 characters' }
  },
  stageName: {
    required: 'Stage name is required',
    minLength: { value: 2, message: 'Stage name must be at least 2 characters' },
    maxLength: { value: 50, message: 'Stage name must be less than 50 characters' }
  },
  templateName: {
    required: 'Template name is required',
    minLength: { value: 3, message: 'Template name must be at least 3 characters' },
    maxLength: { value: 100, message: 'Template name must be less than 100 characters' }
  },
  estimatedHours: {
    min: { value: 0.25, message: 'Minimum duration is 15 minutes (0.25 hours)' },
    max: { value: 1000, message: 'Maximum duration is 1000 hours' }
  }
} as const; 