import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
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
  const reactFlowInstance = useReactFlow();
  
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [connectionMode, setConnectionMode] = useState<ConnectionType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
  
  // Connection management
  const connections = useConnections(teams, canvasState.canvasState.connections, {
    validateConnections: true,
    preventCycles: true,
    onConnectionCreated: onConnectionCreate,
    onConnectionDeleted: onConnectionDelete,
    onValidationError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Layout persistence
  const persistence = useLayoutPersistence(userId, workspaceId || '', {
    storageType: 'both',
    enableAutoSave: !readonly,
    onSaveSuccess: () => toast.success('Layout saved successfully'),
    onSaveError: (error) => toast.error('Failed to save layout: ' + error.message)
  });
  
  // Handle connection start (must be defined before nodes useMemo)
  const handleConnectionStart = useCallback((teamId: string, handle: string) => {
    if (!connectionMode || readonly) return;
    setIsConnecting(true);
  }, [connectionMode, readonly]);
  
  // Handle connection deletion (must be defined before edges useMemo)
  const handleConnectionDelete = useCallback((connectionId: string) => {
    if (readonly) return;
    connections.removeConnection(connectionId);
    toast.success('Connection removed');
  }, [connections, readonly]);
  
  // Convert teams to React Flow nodes
  const nodes = useMemo<Node<TeamNodeData>[]>(() => {
    if (viewMode === 'grid') return [];
    
    return teamsToNodes(
      teams, 
      teamMembers,
      canvasState.canvasState.teamPositions,
      {
        isConnecting,
        connectionMode,
        selectedTeams: canvasState.canvasState.selectedTeams,
        onTeamClick: (teamId) => {
          // Handle team selection
          const newSelection = new Set([teamId]);
          canvasState.selectTeams(Array.from(newSelection));
        },
        onTeamEdit: onTeamUpdate || (() => {}),
        onTeamDelete: onTeamDelete || (() => {}),
        onConnectionStart: handleConnectionStart
      }
    );
  }, [
    teams, 
    teamMembers, 
    viewMode,
    canvasState.canvasState.teamPositions,
    canvasState.canvasState.selectedTeams,
    isConnecting,
    connectionMode,
    onTeamUpdate,
    onTeamDelete
  ]);
  
  // Convert connections to React Flow edges
  const edges = useMemo<Edge<ConnectionEdgeData>[]>(() => {
    if (viewMode === 'grid') return [];
    
    return connectionsToEdges(
      canvasState.canvasState.connections,
      teams,
      {
        selectedConnections: canvasState.canvasState.selectedConnections,
        onEdgeClick: (edgeId) => {
          // Handle edge selection
          const newSelection = new Set([edgeId]);
          // Note: would need to add selectConnections to canvas state
        },
        onEdgeDelete: handleConnectionDelete,
        onEdgeEdit: (edgeId) => {
          // Handle edge editing
          console.log('Edit edge:', edgeId);
        }
      }
    );
  }, [
    canvasState.canvasState.connections,
    canvasState.canvasState.selectedConnections,
    teams,
    viewMode
  ]);
  
  // React Flow state
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  
  // Sync nodes and edges when data changes
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);
  
  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);
  
  // Handle node drag end to update positions
  const handleNodesChange = useCallback((changes: any[]) => {
    onNodesChange(changes);
    
    // Update positions for dragged nodes
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.dragging === false
    );
    
    positionChanges.forEach(change => {
      if (change.position) {
        canvasState.updateTeamPosition(change.id, change.position);
      }
    });
  }, [onNodesChange, canvasState]);
  
  // Handle connection creation
  const onConnect = useCallback((connection: Connection) => {
    if (!connectionMode || readonly) return;
    
    const newConnection = connections.addConnection(
      connection.source!,
      connection.target!,
      connectionMode
    );
    
    if (newConnection) {
      setIsConnecting(false);
      setConnectionMode(null);
      toast.success('Teams connected successfully');
    }
  }, [connectionMode, connections, readonly]);
  
  // Toolbar callbacks
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
  }, [reactFlowInstance]);
  
  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
  }, [reactFlowInstance]);
  
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView();
    canvasState.fitView();
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
  
  // Canvas view component  
  const CanvasView = () => (
    <div className="h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultMarkerColor="#374151"
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background 
          color="#e5e7eb" 
          gap={20} 
          size={1}
          variant="dots"
        />
        <Controls 
          showZoom={false}
          showFitView={false}
          showInteractive={false}
        />
        {canvasState.canvasState.showMinimap && (
          <MiniMap
            nodeColor="#3b82f6"
            nodeStrokeWidth={2}
            pannable
            zoomable
            position="bottom-right"
          />
        )}
      </ReactFlow>
    </div>
  );
  
  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {showToolbar && (
        <CanvasToolbar
          zoom={reactFlowInstance.getZoom()}
          canZoomIn={reactFlowInstance.getZoom() < 2}
          canZoomOut={reactFlowInstance.getZoom() > 0.1}
          viewMode={viewMode}
          connectionMode={connectionMode}
          isConnecting={isConnecting}
          hasUnsavedChanges={canvasState.hasUnsavedChanges}
          isSaving={isSaving}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onResetLayout={handleResetLayout}
          onSaveLayout={handleSaveLayout}
          onExportLayout={() => {
            // TODO: Implement export functionality
            toast.info('Export functionality coming soon');
          }}
          onViewModeChange={setViewMode}
          onConnectionModeChange={setConnectionMode}
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
      
      <div className="flex-1 min-h-0">
        {viewMode === 'grid' ? <GridView /> : <CanvasView />}
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Team Organization Canvas</span>
          </DialogTitle>
          <DialogDescription>
            Organize your teams visually and show relationships between different groups.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 px-6 pb-6">
          <ReactFlowProvider>
            <CanvasContent {...props} onClose={onClose} isOpen={isOpen} />
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};
