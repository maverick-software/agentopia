/**
 * Unified State Management Library - Core Type Definitions
 * 
 * This file contains all TypeScript type definitions for the state management
 * library, designed based on comprehensive analysis of the CatalystHQ codebase.
 */

// ============================================================================
// CORE STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Base state interface that all stores must implement
 */
export interface BaseState {
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * Store configuration options
 */
export interface StoreConfig {
  name: string;
  persist?: boolean;
  persistKey?: string;
  devtools?: boolean;
  middleware?: StoreMiddleware[];
}

/**
 * Store middleware function signature
 */
export type StoreMiddleware<T = any> = (
  config: StateCreator<T>
) => StateCreator<T>;

/**
 * State creator function signature (Zustand compatible)
 */
export type StateCreator<T> = (
  set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void,
  get: () => T,
  api: StoreApi<T>
) => T;

/**
 * Store API interface (Zustand compatible)
 */
export interface StoreApi<T> {
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void;
  getState: () => T;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
}

// ============================================================================
// CACHE MANAGEMENT TYPES
// ============================================================================

/**
 * Cache storage types
 */
export type CacheStorageType = 'memory' | 'session' | 'local' | 'indexeddb';

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  storage?: CacheStorageType;
  serialize?: boolean; // Whether to serialize data
  compress?: boolean; // Whether to compress data
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  size?: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache key structure
 */
export interface CacheKey {
  entity: 'template' | 'instance' | 'user' | 'permissions' | 'ui';
  id: string;
  version?: string;
  context?: string; // client_id, user_id, etc.
}

/**
 * Cache strategy interface
 */
export interface CacheStrategy<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
}

/**
 * Cache manager interface
 */
export interface CacheManager {
  createCache<T>(name: string, config: CacheConfig): CacheStrategy<T>;
  getCache<T>(name: string): CacheStrategy<T> | null;
  invalidatePattern(pattern: string): Promise<void>;
  getMetrics(): CacheMetrics;
  cleanup(): Promise<void>;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  totalRequests: number;
  averageResponseTime: number;
}

// ============================================================================
// WORKFLOW DOMAIN TYPES
// ============================================================================

/**
 * Template metadata for quick access
 */
export interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  type: 'standard' | 'flow_based' | 'hybrid';
  category?: string;
  tags: string[];
  icon?: string;
  color?: string;
  stageCount: number;
  taskCount: number;
  estimatedDuration?: number;
  isActive: boolean;
  isPublished: boolean;
  clientVisible: boolean;
  lastModified: string;
  createdBy: string;
  version: number;
}

/**
 * Complete template hierarchy
 */
export interface CompleteTemplate extends TemplateMetadata {
  stages: WorkflowStage[];
  settings: TemplateSettings;
}

/**
 * Template settings
 */
export interface TemplateSettings {
  requiresProductsServices: boolean;
  autoCreateProject: boolean;
  clientDescription?: string;
}

/**
 * Workflow stage
 */
export interface WorkflowStage {
  id: string;
  templateId: string;
  name: string;
  description?: string;
  stageOrder: number;
  isRequired: boolean;
  allowSkip: boolean;
  autoAdvance: boolean;
  clientVisible: boolean;
  clientDescription?: string;
  conditionLogic: Record<string, any>;
  icon?: string;
  color?: string;
  tasks: WorkflowTask[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Workflow task
 */
export interface WorkflowTask {
  id: string;
  stageId: string;
  name: string;
  description?: string;
  taskOrder: number;
  taskType: 'standard' | 'approval' | 'review' | 'automated';
  isRequired: boolean;
  allowSkip: boolean;
  autoAdvance: boolean;
  assignedTo?: string;
  estimatedDurationMinutes?: number;
  dueDateOffsetDays?: number;
  clientVisible: boolean;
  clientDescription?: string;
  conditionLogic: Record<string, any>;
  dependsOnTaskIds: string[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  id: string;
  taskId: string;
  name: string;
  description?: string;
  stepOrder: number;
  stepType: 'form' | 'review' | 'approval' | 'automated' | 'conditional';
  isRequired: boolean;
  allowSkip: boolean;
  autoAdvance: boolean;
  clientVisible: boolean;
  clientDescription?: string;
  conditionLogic: Record<string, any>;
  elements: WorkflowElement[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Workflow element
 */
export interface WorkflowElement {
  id: string;
  stepId: string;
  elementKey: string;
  elementType: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date' | 'number';
  elementOrder: number;
  label: string;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  validationRules: Record<string, any>;
  elementConfig: Record<string, any>;
  defaultValue?: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Workflow instance (runtime)
 */
export interface WorkflowInstance {
  id: string;
  templateId: string;
  projectId?: string;
  clientId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  currentStepId?: string;
  progressPercentage: number;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Instance progress tracking
 */
export interface InstanceProgress {
  id: string;
  templateId: string;
  status: WorkflowInstance['status'];
  currentStageId?: string;
  currentTaskId?: string;
  currentStepId?: string;
  progressPercentage: number;
  completedSteps: string[];
  completedTasks: string[];
  completedStages: string[];
  nextSteps: string[];
  blockedSteps: string[];
  lastActivity: string;
}

/**
 * Step data (form submissions)
 */
export interface StepData {
  id: string;
  instanceId: string;
  stepId: string;
  elementId?: string;
  elementKey: string;
  dataValue: any;
  isValid: boolean;
  validationErrors: string[];
  submittedAt?: string;
  submittedBy?: string;
  metadata: Record<string, any>;
}

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

/**
 * User authentication state
 */
export interface AuthUser {
  id: string;
  email: string;
  globalRoleNames: string[];
  fullName?: string;
  defaultClientId?: string;
  avatarUrl?: string;
}

/**
 * User permissions
 */
export interface UserPermissions {
  global: string[];
  client: Record<string, string[]>; // clientId -> permissions
  roles: UserRole[];
}

/**
 * User role
 */
export interface UserRole {
  id: string;
  name: string;
  roleType: 'GLOBAL' | 'CLIENT_CONTEXTUAL';
  permissions: string[];
  clientId?: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  workflow: WorkflowPreferences;
  ui: UIPreferences;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  browser: boolean;
  workflowUpdates: boolean;
  taskAssignments: boolean;
  deadlineReminders: boolean;
}

/**
 * Workflow preferences
 */
export interface WorkflowPreferences {
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  showHelpText: boolean;
  compactView: boolean;
  recentTemplates: string[];
  favoriteTemplates: string[];
}

/**
 * UI preferences
 */
export interface UIPreferences {
  sidebarCollapsed: boolean;
  gridView: boolean;
  itemsPerPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * UI state for workflow builder
 */
export interface WorkflowBuilderState {
  activeLevel: 'template' | 'stage' | 'task' | 'step' | 'element';
  selectedItem: string | null;
  expandedItems: Set<string>;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  dragState: DragState | null;
  clipboard: ClipboardItem | null;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

/**
 * Drag and drop state
 */
export interface DragState {
  type: 'stage' | 'task' | 'step' | 'element';
  sourceId: string;
  sourceIndex: number;
  targetId?: string;
  targetIndex?: number;
  isValid: boolean;
}

/**
 * Clipboard item for copy/paste
 */
export interface ClipboardItem {
  type: 'stage' | 'task' | 'step' | 'element';
  data: any;
  timestamp: number;
}

/**
 * Undo/redo action
 */
export interface UndoAction {
  type: string;
  data: any;
  timestamp: number;
  description: string;
}

/**
 * Global UI state
 */
export interface GlobalUIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  loading: boolean;
  notifications: Notification[];
  modals: Modal[];
  toasts: Toast[];
}

/**
 * Notification
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: NotificationAction[];
}

/**
 * Notification action
 */
export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Modal state
 */
export interface Modal {
  id: string;
  type: string;
  title: string;
  content: any;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  onClose?: () => void;
}

/**
 * Toast notification
 */
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// LOGGING & DEBUGGING TYPES
// ============================================================================

/**
 * Log entry
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Debug state
 */
export interface DebugState {
  enabled: boolean;
  logLevel: LogEntry['level'];
  categories: string[];
  maxEntries: number;
  entries: LogEntry[];
  metrics: PerformanceMetric[];
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Application error
 */
export interface AppError {
  id: string;
  code: string;
  message: string;
  details?: string;
  timestamp: number;
  userId?: string;
  context?: Record<string, any>;
  stackTrace?: string;
  recoverable: boolean;
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: any;
  retryCount: number;
  maxRetries: number;
}

// ============================================================================
// STORE COMPOSITION TYPES
// ============================================================================

/**
 * Auth store state
 */
export interface AuthState extends BaseState {
  user: AuthUser | null;
  permissions: UserPermissions | null;
  activeClientId: string | null;
  clientPermissions: string[];
  isFetchingPermissions: boolean;
}

/**
 * Workflow store state
 */
export interface WorkflowState extends BaseState {
  templates: {
    metadata: Record<string, TemplateMetadata>;
    hierarchies: Record<string, CompleteTemplate>;
    loading: Set<string>;
  };
  instances: {
    active: Record<string, WorkflowInstance>;
    progress: Record<string, InstanceProgress>;
    stepData: Record<string, Record<string, StepData>>; // instanceId -> stepId -> data
  };
  builder: WorkflowBuilderState;
}

/**
 * UI store state
 */
export interface UIState extends BaseState {
  global: GlobalUIState;
  preferences: UserPreferences;
  builder: WorkflowBuilderState;
}

/**
 * Cache store state
 */
export interface CacheState extends BaseState {
  metrics: CacheMetrics;
  status: 'healthy' | 'degraded' | 'error';
  lastCleanup: string | null;
  config: Record<string, CacheConfig>;
}

/**
 * Debug store state
 */
export interface DebugStoreState extends BaseState {
  debug: DebugState;
  errors: AppError[];
  performance: {
    metrics: PerformanceMetric[];
    averages: Record<string, number>;
  };
}

/**
 * Root application state
 */
export interface AppState {
  auth: AuthState;
  workflow: WorkflowState;
  ui: UIState;
  cache: CacheState;
  debug: DebugStoreState;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for partial updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Store selector function
 */
export type StoreSelector<T, R> = (state: T) => R;

/**
 * Store subscription callback
 */
export type StoreSubscription<T> = (state: T, prevState: T) => void;

/**
 * Async operation result
 */
export type AsyncResult<T> = {
  data?: T;
  error?: AppError;
  loading: boolean;
};

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  // Core types are already exported above
}; 