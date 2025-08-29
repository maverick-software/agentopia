import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Connection,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { 
  Network, 
  Grid, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Save, 
  RotateCcw, 
  Settings,
  Loader2 
} from 'lucide-react';

// Import our custom components (to be created)
import { TeamNode } from './TeamNode';
import { TeamConnectionEdge } from './TeamConnectionEdge';
import { CanvasToolbar } from './CanvasToolbar';

// Import types
import type {
  VisualTeamCanvasProps,
  TeamNodeData,
  ConnectionEdgeData,
  ViewMode,
  ConnectionType,
  TeamPosition,
  TeamConnection,
  CanvasLayout
} from './types/canvas';

// Import hooks (to be created)
import { useCanvasState } from './hooks/useCanvasState';
import { useTeamOperations } from './hooks/useTeamOperations';
import { useConnections } from './hooks/useConnections';
import { useLayoutPersistence } from './hooks/useLayoutPersistence';

// Import utilities (to be created)
import { 
  teamsToNodes, 
  connectionsToEdges, 
  generateDefaultLayout,
  calculateCanvasBounds 
} from './utils/canvasUtils';

// Custom node and edge types
const nodeTypes: NodeTypes = {
  teamNode: TeamNode as any,
};

const edgeTypes: EdgeTypes = {
  teamConnection: TeamConnectionEdge as any,
};

// Canvas content component (requires ReactFlow context)
const CanvasContent: React.FC<VisualTeamCanvasProps> = ({
  teams,
  teamMembers,
  workspaceId,
  userId,
  initialLayout,
  onTeamCreate,
  onTeamUpdate,
  onTeamDelete,
  onLayoutSave,
  onConnectionCreate,
  onConnectionDelete,
  readonly = false,
  showToolbar = true,
  defaultViewMode = 'canvas',
  className
}) => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  // Canvas state hook
  const canvasState = useCanvasState(teams, initialLayout, {
    enableAutoSave: !readonly,
    onLayoutChange: onLayoutSave,
    onError: (error) => {
      console.error('Canvas state error:', error);
      toast.error('Canvas error: ' + error.message);
    }
  });
  
  // Team operations
  const teamOps = useTeamOperations(workspaceId || '', {
    onTeamCreated: onTeamCreate,
    onTeamUpdated: onTeamUpdate,
    onTeamDeleted: onTeamDelete,
    onError: (error, operation) => {
      console.error(`Team ${operation} error:`, error);
      toast.error(`Failed to ${operation} team: ${error.message}`);
    }
  });
  
  // Connection management - sync with canvas state
  const connections = useConnections(teams, canvasState.canvasState.connections, {
    validateConnections: true,
    preventCycles: true,
    onConnectionCreated: onConnectionCreate,
    onConnectionDeleted: onConnectionDelete,
    onValidationError: (error) => {
      toast.error(error.message);
    }
  });

  // Sync connections with canvas state when they change
  useEffect(() => {
    // Update connections hook when canvas state connections change
    if (canvasState.canvasState.connections.length !== connections.connections.length) {
      // Log for debugging if needed
    }
  }, [canvasState.canvasState.connections, connections.connections]);
  
  // Layout persistence
  const persistence = useLayoutPersistence(userId, workspaceId || '', {
    storageType: 'both',
    enableAutoSave: !readonly,
    onSaveSuccess: () => toast.success('Layout saved successfully'),
    onSaveError: (error) => toast.error('Failed to save layout: ' + error.message)
  });
  
  // Handle connection start (must be defined before nodes useMemo)
  const handleConnectionStart = useCallback((teamId: string, handle: string) => {
    if (readonly) return;
    // Connection start is handled automatically by React Flow
  }, [readonly]);
  
  // Handle connection deletion (must be defined before edges useMemo)
  const handleConnectionDelete = useCallback((connectionId: string) => {
    if (readonly) return;
    
    // Remove from both the connections hook and canvas state
    const removed = connections.removeConnection(connectionId);
    if (removed) {
      canvasState.removeConnection(connectionId);
      toast.success('Connection removed');
    }
  }, [connections, canvasState, readonly]);

  // Handle connection type editing (for selected connections)
  const handleConnectionTypeChange = useCallback((connectionId: string, newType: ConnectionType) => {
    if (readonly) return;
    
    // Find the connection and update it
    const connection = canvasState.canvasState.connections.find(c => c.id === connectionId);
    if (connection) {
      // Remove the old connection
      canvasState.removeConnection(connectionId);
      
      // Add the updated connection
      canvasState.addConnection({
        ...connection,
        type: newType
      });
      
      toast.success(`Connection updated to: ${newType.replace('_', ' ')}`);
    }
  }, [canvasState, readonly]);

  // Handle view mode change with guard to prevent unnecessary updates
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode !== viewMode) {
      setViewMode(mode);
    }
  }, [viewMode]);
  
  // Stabilize callbacks to prevent infinite re-renders
  const stableCallbacks = useMemo(() => ({
    onTeamClick: (teamId: string) => {
      const newSelection = new Set([teamId]);
      canvasState.selectTeams(Array.from(newSelection));
    },
    onTeamEdit: onTeamUpdate || (() => {}),
    onTeamDelete: onTeamDelete || (() => {}),
    onConnectionStart: handleConnectionStart
  }), [canvasState.selectTeams, onTeamUpdate, onTeamDelete, handleConnectionStart]);

  // Convert teams to React Flow nodes - stabilize to prevent flickering
  const nodes = useMemo<Node<TeamNodeData>[]>(() => {
    return teamsToNodes(
      teams, 
      teamMembers,
      canvasState.canvasState.teamPositions,
      {
        selectedTeams: canvasState.canvasState.selectedTeams,
        ...stableCallbacks
      }
    );
  }, [
    teams, 
    teamMembers,
    canvasState.canvasState.teamPositions,
    canvasState.canvasState.selectedTeams,
    stableCallbacks
  ]);
  
  // Handle edge clicks for connection type editing
  const handleEdgeClick = useCallback((event: any, edge: Edge) => {
    if (readonly) return;
    // Edge editing is now handled inline by the edge component
  }, [readonly]);

  // Convert connections to React Flow edges - stabilize to prevent flickering
  const edges = useMemo<Edge<ConnectionEdgeData>[]>(() => {
    const generatedEdges = connectionsToEdges(
      canvasState.canvasState.connections,
      teams,
      {
        selectedConnections: canvasState.canvasState.selectedConnections,
        onEdgeClick: () => {
          // Edge clicks are handled by the edge component now
        },
        onEdgeDelete: handleConnectionDelete,
        onEdgeEdit: handleConnectionTypeChange
      }
    );
    return generatedEdges;
  }, [
    canvasState.canvasState.connections,
    canvasState.canvasState.selectedConnections,
    teams,
    handleConnectionDelete,
    handleConnectionTypeChange
  ]);
  
  // React Flow state management
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  
  // Sync our nodes/edges with React Flow state
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);
  
  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // Handle node changes (including dragging) - combine React Flow updates with our state management
  const handleNodesChange = useCallback((changes: any[]) => {
    // First, let React Flow handle the changes
    onNodesChange(changes);
    
    // Then, handle our custom logic for position updates
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.dragging === false
    );
    
    positionChanges.forEach(change => {
      if (change.position) {
        canvasState.updateTeamPosition(change.id, change.position);
      }
    });
  }, [onNodesChange, canvasState]);

  // Handle edge changes 
  const handleEdgesChange = useCallback((changes: any[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);
  
  // Handle connection creation - always allow connections with default type
  const onConnect = useCallback((connection: Connection) => {
    if (readonly) return;
    
    console.log('Connection attempted:', connection);
    
    // Create a simple connection directly
    const newConnectionData = {
      id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromTeamId: connection.source!,
      toTeamId: connection.target!,
      type: 'collaborates_with' as ConnectionType,
      createdAt: new Date().toISOString(),
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle
    };
    
    // Add to canvas state for persistence
    canvasState.addConnection(newConnectionData);
    
    toast.success('Teams connected! Click the connection to change relationship type.');
    
  }, [canvasState, readonly]);
  
  // Toolbar callbacks
  const handleFitView = useCallback(() => {
    if (reactFlowInstance && reactFlowInstance.fitView) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
      canvasState.fitView();
    }
  }, [reactFlowInstance, canvasState]);
  
  const handleResetLayout = useCallback(() => {
    canvasState.resetLayout();
    toast.success('Layout reset to default');
  }, [canvasState]);
  
  const handleSaveLayout = useCallback(async () => {
    if (readonly) return;
    
    setIsSaving(true);
    try {
      const viewport = reactFlowInstance.getViewport();
      const layout: CanvasLayout = {
        userId,
        workspaceId,
        positions: Array.from(canvasState.canvasState.teamPositions.values()),
        connections: canvasState.canvasState.connections,
        viewSettings: {
          zoom: viewport.zoom,
          centerX: viewport.x,
          centerY: viewport.y
        }
      };
      
      await persistence.saveLayout(layout);
      canvasState.markSaved();
    } finally {
      setIsSaving(false);
    }
  }, [
    readonly,
    reactFlowInstance,
    canvasState,
    userId,
    workspaceId,
    persistence
  ]);
  
  // Grid view component
  const GridView = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => (
          <Card key={team.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Network className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{team.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {team.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {teamMembers.get(team.id)?.length || 0} members
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
  
  // Stabilize React Flow to prevent flickering
  const reactFlowProps = useMemo(() => ({
    nodes: flowNodes,
    edges: flowEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: onConnect,
    onEdgeClick: handleEdgeClick,
    nodeTypes: nodeTypes,
    edgeTypes: edgeTypes,
    connectionMode: ConnectionMode.Loose,
    defaultMarkerColor: "#374151",
    fitView: false,
    minZoom: 1,
    maxZoom: 1,
    zoomOnScroll: false,
    zoomOnPinch: false,
    zoomOnDoubleClick: false,
    panOnScroll: true,
    preventScrolling: false,
    defaultViewport: { x: 0, y: 0, zoom: 1 },
    proOptions: { hideAttribution: true },
    attributionPosition: 'bottom-left' as const,
    // Ensure connections are enabled
    connectOnClick: false,
    deleteKeyCode: 'Delete',
    multiSelectionKeyCode: 'Meta',
    snapToGrid: false,
    snapGrid: [15, 15],
  }), [flowNodes, flowEdges, handleNodesChange, handleEdgesChange, onConnect, handleEdgeClick, nodeTypes, edgeTypes]);
  
  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {showToolbar && (
        <CanvasToolbar
          zoom={1}
          canZoomIn={false}
          canZoomOut={false}
          viewMode={viewMode}
          connectionMode={null}
          isConnecting={false}
          hasUnsavedChanges={canvasState.hasUnsavedChanges}
          isSaving={isSaving}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onFitView={handleFitView}
          onResetLayout={handleResetLayout}
          onSaveLayout={handleSaveLayout}
          onExportLayout={() => {
            // TODO: Implement export functionality
            toast.info('Export functionality coming soon');
          }}
          onViewModeChange={handleViewModeChange}
          onConnectionModeChange={() => {}} // No longer used
          onShowSettings={() => {
            // TODO: Implement settings modal
            toast.info('Settings modal coming soon');
          }}
          showMinimap={canvasState.canvasState.showMinimap}
          onToggleMinimap={() => {
            // TODO: Add minimap toggle to canvas state
          }}
        />
      )}
      
      <div className="flex-1 h-full relative">
        {/* Keep both views but show/hide to prevent React Flow re-initialization */}
        <div style={{ display: viewMode === 'grid' ? 'block' : 'none', height: '100%' }}>
          <GridView />
        </div>
        {viewMode === 'canvas' && (
          <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}>
            <ReactFlow
              {...reactFlowProps}
              style={{ width: '100%', height: '100%' }}
              onInit={(instance) => {
                setReactFlowInstance(instance);
              }}
            >
              <Background 
                color="#e5e7eb" 
                gap={20} 
                size={1}
                variant="dots"
              />
              {canvasState.canvasState.showMinimap && (
                <MiniMap
                  nodeColor="#3b82f6"
                  nodeStrokeWidth={2}
                  pannable
                  zoomable={false}
                  position="bottom-right"
                />
              )}
            </ReactFlow>
          </div>
        )}


      </div>
    </div>
  );
};

// Main component with ReactFlow provider
export const VisualTeamCanvas: React.FC<VisualTeamCanvasProps> = ({
  isOpen,
  onClose,
  ...props
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Team Organization Canvas</span>
          </DialogTitle>
          <DialogDescription>
            Organize your teams visually and show relationships between different groups.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 px-6 pb-6 h-[calc(90vh-120px)] overflow-hidden">
          <ReactFlowProvider>
            <CanvasContent {...props} onClose={onClose} isOpen={isOpen} />
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};
