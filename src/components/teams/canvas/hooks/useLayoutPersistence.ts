import { useState, useRef, useCallback, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import type {
  CanvasLayout,
  TeamPosition,
  TeamConnection,
  SaveLayoutResponse,
  GetLayoutResponse,
  ConnectionResponse
} from '../types/canvas';

interface UseLayoutPersistenceOptions {
  // Storage configuration
  storageType?: 'local' | 'database' | 'both';
  storageKey?: string;
  
  // Auto-save configuration  
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  debounceMs?: number;
  
  // Conflict resolution
  enableConflictResolution?: boolean;
  conflictStrategy?: 'local_wins' | 'remote_wins' | 'merge' | 'ask_user';
  
  // Callbacks
  onSaveSuccess?: (layout: CanvasLayout) => void;
  onSaveError?: (error: Error) => void;
  onLoadSuccess?: (layout: CanvasLayout) => void;
  onLoadError?: (error: Error) => void;
  onConflictDetected?: (localLayout: CanvasLayout, remoteLayout: CanvasLayout) => Promise<CanvasLayout>;
}

export function useLayoutPersistence(
  userId: string,
  workspaceId: string,
  options: UseLayoutPersistenceOptions = {}
) {
  const {
    storageType = 'both',
    storageKey = `team-canvas-${workspaceId}`,
    enableAutoSave = true,
    autoSaveInterval = 30000,
    debounceMs = 1000,
    enableConflictResolution = true,
    conflictStrategy = 'merge',
    onSaveSuccess,
    onSaveError,
    onLoadSuccess,
    onLoadError,
    onConflictDetected
  } = options;

  const supabase = useSupabaseClient();
  const [lastSavedLayout, setLastSavedLayout] = useState<CanvasLayout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveTimeRef = useRef<Date>();

  // Load layout from storage
  const loadLayout = useCallback(async (): Promise<CanvasLayout | null> => {
    setIsLoading(true);
    
    try {
      let localLayout: CanvasLayout | null = null;
      let remoteLayout: CanvasLayout | null = null;
      
      // Load from localStorage
      if (storageType === 'local' || storageType === 'both') {
        try {
          const localData = localStorage.getItem(storageKey);
          if (localData) {
            localLayout = JSON.parse(localData);
          }
        } catch (error) {
          console.warn('Failed to load from localStorage:', error);
        }
      }
      
      // Load from database
      if (storageType === 'database' || storageType === 'both') {
        try {
          const { data, error } = await supabase.rpc(
            'get_team_canvas_layout',
            { 
              p_workspace_id: workspaceId || null,
              p_user_id: null // Use current user
            }
          );
          
          if (error) throw error;
          
          const response = data as GetLayoutResponse;
          if (response.success && response.layout) {
            remoteLayout = response.layout;
          }
        } catch (error) {
          console.warn('Failed to load from database:', error);
          if (storageType === 'database') {
            throw error; // Re-throw if database is the only storage option
          }
        }
      }
      
      // Resolve conflicts
      let finalLayout: CanvasLayout | null = null;
      
      if (localLayout && remoteLayout) {
        if (enableConflictResolution) {
          finalLayout = await resolveLayoutConflict(
            localLayout,
            remoteLayout,
            conflictStrategy,
            onConflictDetected
          );
        } else {
          finalLayout = conflictStrategy === 'local_wins' ? localLayout : remoteLayout;
        }
      } else {
        finalLayout = localLayout || remoteLayout;
      }
      
      if (finalLayout) {
        setLastSavedLayout(finalLayout);
        if (onLoadSuccess) onLoadSuccess(finalLayout);
      }
      
      return finalLayout;
      
    } catch (error) {
      const errorObj = error as Error;
      console.error('Failed to load layout:', errorObj);
      if (onLoadError) onLoadError(errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    storageType,
    storageKey,
    userId,
    workspaceId,
    enableConflictResolution,
    conflictStrategy,
    onLoadSuccess,
    onLoadError,
    onConflictDetected,
    supabase
  ]);

  // Save layout to storage
  const saveLayout = useCallback(async (layout: CanvasLayout): Promise<boolean> => {
    setIsSaving(true);
    
    try {
      const layoutToSave = {
        ...layout,
        userId,
        workspaceId: workspaceId || null,
        updatedAt: new Date().toISOString()
      };
      
      // Save to localStorage
      if (storageType === 'local' || storageType === 'both') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(layoutToSave));
        } catch (error) {
          console.warn('Failed to save to localStorage:', error);
        }
      }
      
      // Save to database
      if (storageType === 'database' || storageType === 'both') {
        const { data, error } = await supabase.rpc(
          'save_team_canvas_layout',
          {
            p_workspace_id: workspaceId || null,
            p_positions: JSON.stringify(layout.positions),
            p_connections: JSON.stringify(layout.connections),
            p_view_settings: JSON.stringify(layout.viewSettings)
          }
        );
        
        if (error) throw error;
        
        const response = data as SaveLayoutResponse;
        if (!response.success) {
          throw new Error(response.error || 'Failed to save layout');
        }
      }
      
      setLastSavedLayout(layoutToSave);
      lastSaveTimeRef.current = new Date();
      
      if (onSaveSuccess) onSaveSuccess(layoutToSave);
      
      return true;
      
    } catch (error) {
      const errorObj = error as Error;
      console.error('Failed to save layout:', errorObj);
      if (onSaveError) onSaveError(errorObj);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    storageType,
    storageKey,
    userId,
    workspaceId,
    onSaveSuccess,
    onSaveError,
    supabase
  ]);

  // Debounced save
  const debouncedSave = useCallback((layout: CanvasLayout) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveLayout(layout);
    }, debounceMs);
  }, [saveLayout, debounceMs]);

  // Auto-save effect
  useEffect(() => {
    if (!enableAutoSave) return;
    
    const interval = setInterval(() => {
      // Auto-save logic would be triggered by parent component
      // This hook provides the mechanism, parent triggers the save
    }, autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [enableAutoSave, autoSaveInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    lastSavedLayout,
    isSaving,
    isLoading,
    lastSaveTime: lastSaveTimeRef.current,
    
    // Operations
    loadLayout,
    saveLayout,
    debouncedSave,
    
    // Utilities
    hasUnsavedChanges: useCallback((currentLayout: CanvasLayout) => 
      !lastSavedLayout || 
      JSON.stringify(normalizeLayoutForComparison(currentLayout)) !== 
      JSON.stringify(normalizeLayoutForComparison(lastSavedLayout))
    , [lastSavedLayout]),
    clearStorage: useCallback(() => {
      try {
        localStorage.removeItem(storageKey);
        return true;
      } catch (error) {
        console.warn('Failed to clear storage:', error);
        return false;
      }
    }, [storageKey])
  };
}

// Conflict resolution helper
async function resolveLayoutConflict(
  localLayout: CanvasLayout,
  remoteLayout: CanvasLayout,
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'ask_user',
  onConflictDetected?: (local: CanvasLayout, remote: CanvasLayout) => Promise<CanvasLayout>
): Promise<CanvasLayout> {
  switch (strategy) {
    case 'local_wins':
      return localLayout;
    case 'remote_wins':
      return remoteLayout;
    case 'merge':
      return mergeLayouts(localLayout, remoteLayout);
    case 'ask_user':
      if (onConflictDetected) {
        return await onConflictDetected(localLayout, remoteLayout);
      }
      return remoteLayout; // Fallback
    default:
      return remoteLayout;
  }
}

// Merge two layouts intelligently
function mergeLayouts(local: CanvasLayout, remote: CanvasLayout): CanvasLayout {
  // Merge strategy: 
  // - Use most recent view settings
  // - Merge positions (local wins for conflicts unless remote is newer)
  // - Merge connections (combine unique ones)
  
  const localTime = new Date(local.updatedAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();
  
  // Merge positions
  const positionsMap = new Map<string, TeamPosition>();
  
  // Add remote positions first
  remote.positions.forEach(pos => {
    positionsMap.set(pos.teamId, pos);
  });
  
  // Override with local positions (giving preference to local changes)
  local.positions.forEach(pos => {
    const existing = positionsMap.get(pos.teamId);
    if (!existing || new Date(pos.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
      positionsMap.set(pos.teamId, pos);
    }
  });
  
  // Merge connections (combine unique ones)
  const connectionsMap = new Map<string, TeamConnection>();
  
  remote.connections.forEach(conn => {
    const key = `${conn.fromTeamId}->${conn.toTeamId}-${conn.type}`;
    connectionsMap.set(key, conn);
  });
  
  local.connections.forEach(conn => {
    const key = `${conn.fromTeamId}->${conn.toTeamId}-${conn.type}`;
    if (!connectionsMap.has(key)) {
      connectionsMap.set(key, conn);
    }
  });
  
  return {
    ...remote,
    positions: Array.from(positionsMap.values()),
    connections: Array.from(connectionsMap.values()),
    viewSettings: remoteTime > localTime ? remote.viewSettings : local.viewSettings,
    updatedAt: new Date().toISOString()
  };
}

// Normalize layout for comparison (remove timestamps and non-essential data)
function normalizeLayoutForComparison(layout: CanvasLayout): any {
  return {
    positions: layout.positions.map(pos => ({
      teamId: pos.teamId,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: pos.width,
      height: pos.height
    })),
    connections: layout.connections.map(conn => ({
      fromTeamId: conn.fromTeamId,
      toTeamId: conn.toTeamId,
      type: conn.type,
      label: conn.label,
      color: conn.color,
      style: conn.style
    })),
    viewSettings: {
      zoom: Math.round(layout.viewSettings.zoom * 100) / 100,
      centerX: Math.round(layout.viewSettings.centerX),
      centerY: Math.round(layout.viewSettings.centerY)
    }
  };
}
