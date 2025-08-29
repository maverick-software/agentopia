// Canvas Types for Visual Team Hierarchy System
// Generated from comprehensive design research and specifications

import type { Node, Edge, Viewport } from 'reactflow';
import type { Team, TeamMember } from '@/types'; // Import existing types

// Canvas Layout Data Structures
export interface TeamPosition {
  teamId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  updatedAt?: string;
  createdAt?: string;
}

export interface TeamConnection {
  id?: string;
  fromTeamId: string;
  toTeamId: string;
  type: ConnectionType;
  label?: string;
  color?: string;
  style?: ConnectionStyle;
  createdAt?: string;
  updatedAt?: string;
}

// Connection Types
export type ConnectionType = 'reports_to' | 'collaborates_with' | 'supports' | 'custom';
export type ConnectionStyle = 'solid' | 'dashed' | 'dotted';

// Canvas Layout Interface
export interface CanvasLayout {
  id?: string;
  userId: string;
  workspaceId?: string | null;
  positions: TeamPosition[];
  connections: TeamConnection[];
  viewSettings: ViewSettings;
  createdAt?: string;
  updatedAt?: string;
}

// View Settings
export interface ViewSettings {
  zoom: number;
  centerX: number;
  centerY: number;
}

// React Flow Node Data
export interface TeamNodeData {
  team: Team;
  memberCount: number;
  agentNames: string[];
  teamType?: string;
  color?: string;
  lastActivity?: string;
  isSelected?: boolean;
}

// React Flow Edge Data
export interface ConnectionEdgeData {
  connection: TeamConnection;
  fromTeam: Team;
  toTeam: Team;
  isSelected?: boolean;
}

// Canvas State Management
export interface CanvasState {
  // View state
  zoom: number;
  centerX: number;
  centerY: number;
  viewMode: ViewMode;
  
  // Team positions
  teamPositions: Map<string, TeamPosition>;
  
  // Connections
  connections: TeamConnection[];
  
  // Selection state
  selectedTeams: Set<string>;
  selectedConnections: Set<string>;
  
  // Interaction state
  isConnecting: boolean;
  connectionMode: ConnectionType | null;
  draggedTeam: string | null;
  
  // Layout state
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  
  // UI state
  showMinimap: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
}

// View Mode
export type ViewMode = 'grid' | 'canvas';

// Component Props Types
export interface VisualTeamCanvasProps {
  // Core functionality
  isOpen: boolean;
  onClose: () => void;
  
  // Team data
  teams: Team[];
  teamMembers: Map<string, TeamMember[]>;
  
  // Workspace/user context
  workspaceId?: string;
  userId: string;
  
  // Canvas state
  initialLayout?: CanvasLayout;
  
  // Callbacks
  onTeamCreate?: () => void;
  onTeamUpdate?: (teamId: string, updates: Partial<Team>) => void;
  onTeamDelete?: (teamId: string) => void;
  onLayoutSave?: (layout: CanvasLayout) => Promise<void>;
  onConnectionCreate?: (connection: Omit<TeamConnection, 'id'>) => void;
  onConnectionDelete?: (connectionId: string) => void;
  
  // Configuration
  readonly?: boolean;
  showToolbar?: boolean;
  defaultViewMode?: ViewMode;
  
  // Styling
  className?: string;
}

export interface TeamNodeProps {
  // Team data
  team: Team;
  members: TeamMember[];
  
  // React Flow node props
  data: TeamNodeData;
  selected: boolean;
  
  // Canvas state
  isConnecting: boolean;
  connectionMode: ConnectionType | null;
  
  // Callbacks
  onTeamClick: (teamId: string) => void;
  onTeamEdit: (teamId: string) => void;
  onTeamDelete: (teamId: string) => void;
  onConnectionStart: (teamId: string, handle: 'top' | 'right' | 'bottom' | 'left') => void;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
}

export interface TeamConnectionEdgeProps {
  // React Flow edge props
  id: string;
  source: string;
  target: string;
  selected: boolean;
  
  // Connection data
  data: ConnectionEdgeData;
  
  // Callbacks
  onEdgeClick: (edgeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  onEdgeEdit: (edgeId: string) => void;
  
  // React Flow positioning props
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: 'top' | 'right' | 'bottom' | 'left';
  targetPosition: 'top' | 'right' | 'bottom' | 'left';
}

export interface CanvasToolbarProps {
  // Canvas state
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  
  // View mode
  viewMode: ViewMode;
  
  // Connection state
  connectionMode: ConnectionType | null;
  isConnecting: boolean;
  
  // Layout state
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  
  // Callbacks
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetLayout: () => void;
  onSaveLayout: () => void;
  onExportLayout: () => void;
  
  onViewModeChange: (mode: ViewMode) => void;
  onConnectionModeChange: (mode: ConnectionType | null) => void;
  
  onShowSettings: () => void;
  
  // Options
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  
  className?: string;
}

// Hook Options and Return Types
export interface UseCanvasStateOptions {
  // Auto-save configuration
  autoSaveInterval?: number;
  enableAutoSave?: boolean;
  
  // Persistence
  persistToLocalStorage?: boolean;
  storageKey?: string;
  
  // Performance
  batchUpdates?: boolean;
  debounceMs?: number;
  
  // Callbacks
  onLayoutChange?: (layout: CanvasLayout) => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  onError?: (error: Error) => void;
}

export interface UseTeamOperationsOptions {
  // Data fetching
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  
  // Optimistic updates
  enableOptimisticUpdates?: boolean;
  rollbackOnError?: boolean;
  
  // Callbacks
  onTeamCreated?: (team: Team) => void;
  onTeamUpdated?: (team: Team) => void;  
  onTeamDeleted?: (teamId: string) => void;
  onError?: (error: Error, operation: string) => void;
}

export interface UseConnectionsOptions {
  // Auto-validation
  validateConnections?: boolean;
  preventCycles?: boolean;
  maxConnectionsPerTeam?: number;
  
  // Performance
  batchUpdates?: boolean;
  debounceMs?: number;
  
  // Callbacks
  onConnectionCreated?: (connection: TeamConnection) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  onValidationError?: (error: ConnectionValidationError) => void;
}

// Error Types
export interface ConnectionValidationError {
  type: 'cycle' | 'duplicate' | 'max_connections' | 'self_reference';
  message: string;
  connection: Partial<TeamConnection>;
}

// API Response Types
export interface SaveLayoutResponse {
  success: boolean;
  layout_id?: string;
  position_count?: number;
  connection_count?: number;
  saved_at?: string;
  error?: string;
  validation_errors?: string[];
  error_code?: string;
}

export interface GetLayoutResponse {
  success: boolean;
  layout?: CanvasLayout;
  teams?: Team[];
  error?: string;
}

export interface ConnectionResponse {
  success: boolean;
  connection_id?: string;
  from_team_id?: string;
  to_team_id?: string;
  connection_type?: ConnectionType;
  created_at?: string;
  deleted_connection_id?: string;
  deleted_at?: string;
  error?: string;
  error_code?: string;
}

// Utility Types
export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Canvas Configuration
export interface CanvasConfig {
  // Node settings
  nodeWidth: number;
  nodeHeight: number;
  nodeSpacing: number;
  
  // Connection settings
  connectionStrokeWidth: number;
  connectionColors: Record<ConnectionType, string>;
  
  // Grid settings
  gridSize: number;
  snapToGrid: boolean;
  
  // Performance
  maxNodes: number;
  maxConnections: number;
  virtualRenderingThreshold: number;
  
  // Animation
  animationDuration: number;
  easeFunction: string;
}

// Default configurations
export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  zoom: 1,
  centerX: 0,
  centerY: 0
};

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  nodeWidth: 280,
  nodeHeight: 120,
  nodeSpacing: 50,
  connectionStrokeWidth: 2,
  connectionColors: {
    reports_to: 'hsl(var(--foreground))',
    collaborates_with: 'hsl(var(--muted-foreground))', 
    supports: 'hsl(var(--success))',
    custom: 'hsl(var(--primary))'
  },
  gridSize: 20,
  snapToGrid: true,
  maxNodes: 200,
  maxConnections: 500,
  virtualRenderingThreshold: 100,
  animationDuration: 200,
  easeFunction: 'ease-in-out'
};
