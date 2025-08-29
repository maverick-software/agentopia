import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';

import type { Team } from '@/types';
import type {
  CanvasState,
  TeamPosition,
  TeamConnection,
  CanvasLayout,
  UseCanvasStateOptions,
  ConnectionType
} from '../types/canvas';
import { generateDefaultLayout, canvasStateToLayout } from '../utils/canvasUtils';

// Initialize canvas state from teams and layout
function initializeCanvasState(
  teams: Team[],
  initialLayout?: CanvasLayout,
  storageKey?: string,
  persistToLocalStorage?: boolean
): CanvasState {
  let positions = new Map<string, TeamPosition>();
  let connections: TeamConnection[] = [];
  let viewSettings = { zoom: 1, centerX: 0, centerY: 0 };
  
  if (initialLayout) {
    // Use provided layout
    initialLayout.positions.forEach(pos => {
      positions.set(pos.teamId, pos);
    });
    connections = initialLayout.connections;
    viewSettings = initialLayout.viewSettings;
  } else if (persistToLocalStorage && storageKey) {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedLayout: CanvasLayout = JSON.parse(saved);
        savedLayout.positions.forEach(pos => {
          positions.set(pos.teamId, pos);
        });
        connections = savedLayout.connections;
        viewSettings = savedLayout.viewSettings;
      }
    } catch (error) {
      console.warn('Failed to load canvas state from localStorage:', error);
    }
  }
  
  // Generate default positions for teams that don't have positions
  if (positions.size === 0 && teams.length > 0) {
    const defaultLayout = generateDefaultLayout(teams);
    positions = defaultLayout.teamPositions;
  }
  
  return {
    zoom: viewSettings.zoom,
    centerX: viewSettings.centerX,
    centerY: viewSettings.centerY,
    viewMode: 'canvas',
    teamPositions: positions,
    connections,
    selectedTeams: new Set(),
    selectedConnections: new Set(),
    isConnecting: false,
    connectionMode: null,
    draggedTeam: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    showMinimap: true,
    showGrid: true,
    snapToGrid: false
  };
}

export function useCanvasState(
  teams: Team[],
  initialLayout?: CanvasLayout,
  options: UseCanvasStateOptions = {}
) {
  const {
    autoSaveInterval = 30000, // 30 seconds
    enableAutoSave = true,
    persistToLocalStorage = true,
    storageKey = 'team-canvas-state',
    batchUpdates = true,
    debounceMs = 300,
    onLayoutChange,
    onUnsavedChanges,
    onError
  } = options;

  // Core state
  const [canvasState, setCanvasState] = useState<CanvasState>(() => 
    initializeCanvasState(teams, initialLayout, storageKey, persistToLocalStorage)
  );
  
  // Refs for stable access
  const canvasStateRef = useRef(canvasState);
  const hasUnsavedChangesRef = useRef(false);
  
  // Debounced state updates
  const debouncedSetState = useMemo(
    () => batchUpdates ? 
      debounce((updates: Partial<CanvasState>) => {
        setCanvasState(prev => ({ ...prev, ...updates }));
      }, debounceMs) : 
      (updates: Partial<CanvasState>) => setCanvasState(prev => ({ ...prev, ...updates })),
    [batchUpdates, debounceMs]
  );

  // View state management
  const updateViewport = useCallback((viewport: { zoom: number; centerX: number; centerY: number }) => {
    debouncedSetState({
      zoom: viewport.zoom,
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      hasUnsavedChanges: true
    });
  }, [debouncedSetState]);

  // Team position management
  const updateTeamPosition = useCallback((teamId: string, position: { x: number; y: number }) => {
    const newPositions = new Map(canvasState.teamPositions);
    const existingPosition = newPositions.get(teamId);
    
    newPositions.set(teamId, {
      teamId,
      x: position.x,
      y: position.y,
      width: existingPosition?.width,
      height: existingPosition?.height,
      updatedAt: new Date().toISOString()
    });
    
    debouncedSetState({
      teamPositions: newPositions,
      hasUnsavedChanges: true
    });
  }, [canvasState.teamPositions, debouncedSetState]);

  // Connection management
  const addConnection = useCallback((connection: Omit<TeamConnection, 'id'>) => {
    const newConnection: TeamConnection = {
      ...connection,
      id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    debouncedSetState({
      connections: [...canvasState.connections, newConnection],
      hasUnsavedChanges: true,
      isConnecting: false,
      connectionMode: null
    });
  }, [canvasState.connections, debouncedSetState]);

  const removeConnection = useCallback((connectionId: string) => {
    debouncedSetState({
      connections: canvasState.connections.filter(conn => conn.id !== connectionId),
      hasUnsavedChanges: true
    });
  }, [canvasState.connections, debouncedSetState]);

  // Selection management
  const selectTeams = useCallback((teamIds: string[]) => {
    debouncedSetState({
      selectedTeams: new Set(teamIds)
    });
  }, [debouncedSetState]);

  const clearSelection = useCallback(() => {
    debouncedSetState({
      selectedTeams: new Set(),
      selectedConnections: new Set()
    });
  }, [debouncedSetState]);

  // Layout operations
  const resetLayout = useCallback(() => {
    const resetState = generateDefaultLayout(teams);
    setCanvasState(prev => ({
      ...prev,
      teamPositions: resetState.teamPositions,
      connections: resetState.connections,
      zoom: 1,
      centerX: 0,
      centerY: 0,
      hasUnsavedChanges: true
    }));
  }, [teams]);

  const fitView = useCallback(() => {
    // This will be handled by React Flow's fitView function
    // We just need to track that it happened
    debouncedSetState({
      hasUnsavedChanges: true
    });
  }, [debouncedSetState]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !hasUnsavedChangesRef.current || !onLayoutChange) return;
    
    const interval = setInterval(() => {
      if (hasUnsavedChangesRef.current && onLayoutChange) {
        try {
          const layout = canvasStateToLayout(canvasStateRef.current);
          onLayoutChange(layout);
        } catch (error) {
          if (onError) onError(error as Error);
        }
      }
    }, autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [enableAutoSave, autoSaveInterval, onLayoutChange, onError]);

  // Local storage persistence
  useEffect(() => {
    if (!persistToLocalStorage) return;
    
    const saveToStorage = debounce(() => {
      try {
        const layoutData = canvasStateToLayout(canvasState);
        localStorage.setItem(storageKey, JSON.stringify(layoutData));
      } catch (error) {
        if (onError) onError(error as Error);
      }
    }, 1000);
    
    if (canvasState.hasUnsavedChanges) {
      saveToStorage();
    }
    
    return () => {
      saveToStorage.cancel();
    };
  }, [canvasState, persistToLocalStorage, storageKey, onError]);

  // Sync refs
  useEffect(() => {
    canvasStateRef.current = canvasState;
    hasUnsavedChangesRef.current = canvasState.hasUnsavedChanges;
  }, [canvasState]);

  // Notify about unsaved changes
  useEffect(() => {
    if (onUnsavedChanges) {
      onUnsavedChanges(canvasState.hasUnsavedChanges);
    }
  }, [canvasState.hasUnsavedChanges, onUnsavedChanges]);

  // Handle team list changes - add positions for new teams
  useEffect(() => {
    const currentTeamIds = new Set(Array.from(canvasState.teamPositions.keys()));
    const newTeamIds = teams.filter(team => !currentTeamIds.has(team.id));
    
    if (newTeamIds.length > 0) {
      const newPositions = new Map(canvasState.teamPositions);
      
      newTeamIds.forEach((team, index) => {
        // Position new teams in a row below existing ones
        const existingPositions = Array.from(newPositions.values());
        const maxY = existingPositions.length > 0 ? 
          Math.max(...existingPositions.map(p => p.y)) : 0;
        
        newPositions.set(team.id, {
          teamId: team.id,
          x: index * 320 + 50,
          y: maxY + 200,
          createdAt: new Date().toISOString()
        });
      });
      
      setCanvasState(prev => ({
        ...prev,
        teamPositions: newPositions,
        hasUnsavedChanges: true
      }));
    }
  }, [teams, canvasState.teamPositions]);

  return {
    // State
    canvasState,
    
    // View operations
    updateViewport,
    fitView,
    resetLayout,
    
    // Team operations
    updateTeamPosition,
    
    // Connection operations
    addConnection,
    removeConnection,
    
    // Selection operations
    selectTeams,
    clearSelection,
    
    // Utility
    hasUnsavedChanges: canvasState.hasUnsavedChanges,
    markSaved: useCallback(() => {
      debouncedSetState({ 
        hasUnsavedChanges: false, 
        lastSavedAt: new Date() 
      });
    }, [debouncedSetState])
  };
}
