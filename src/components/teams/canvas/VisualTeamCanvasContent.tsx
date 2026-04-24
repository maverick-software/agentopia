import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Connection,
} from 'reactflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Network } from 'lucide-react';

import { TeamNode } from './TeamNode';
import { TeamConnectionEdge } from './TeamConnectionEdge';
import { CanvasToolbar } from './CanvasToolbar';
import type {
  VisualTeamCanvasProps,
  TeamNodeData,
  ConnectionEdgeData,
  ViewMode,
  ConnectionType,
  CanvasLayout,
} from './types/canvas';
import { useCanvasState } from './hooks/useCanvasState';
import { useTeamOperations } from './hooks/useTeamOperations';
import { useConnections } from './hooks/useConnections';
import { useLayoutPersistence } from './hooks/useLayoutPersistence';
import { teamsToNodes, connectionsToEdges } from './utils/canvasUtils';

const nodeTypes: NodeTypes = {
  teamNode: TeamNode as any,
};

const edgeTypes: EdgeTypes = {
  teamConnection: TeamConnectionEdge as any,
};

const GridView: React.FC<{
  teams: VisualTeamCanvasProps['teams'];
  teamMembers: VisualTeamCanvasProps['teamMembers'];
}> = ({ teams, teamMembers }) => (
  <div className="p-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => (
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

export const VisualTeamCanvasContent: React.FC<VisualTeamCanvasProps> = ({
  isOpen,
  onClose,
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
  className,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [zoom, setZoom] = useState(0.6);

  const canvasState = useCanvasState(teams, undefined, {
    enableAutoSave: false,
    autoSaveInterval: 5000,
    debounceMs: 1000,
    onError: (error) => {
      console.error('Canvas state error:', error);
      toast.error('Canvas error: ' + error.message);
    },
  });

  useTeamOperations(workspaceId || '', {
    onTeamCreated: onTeamCreate,
    onTeamUpdated: onTeamUpdate,
    onTeamDeleted: onTeamDelete,
    onError: (error, operation) => {
      console.error(`Team ${operation} error:`, error);
      toast.error(`Failed to ${operation} team: ${error.message}`);
    },
  });

  const connections = useConnections(teams, canvasState.canvasState.connections, {
    validateConnections: true,
    preventCycles: true,
    onConnectionCreated: onConnectionCreate,
    onConnectionDeleted: onConnectionDelete,
    onValidationError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (canvasState.canvasState.connections.length !== connections.connections.length) {
      // Kept for parity with existing behavior and debugging points.
    }
  }, [canvasState.canvasState.connections, connections.connections]);

  const persistence = useLayoutPersistence(userId, workspaceId || '', {
    storageType: 'both',
    enableAutoSave: !readonly,
    onSaveSuccess: () => toast.success('Layout saved successfully'),
    onSaveError: (error) => toast.error('Failed to save layout: ' + error.message),
    onLoadSuccess: (layout) => {
      console.log('Loaded canvas layout:', layout);
    },
  });

  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  useEffect(() => {
    if (!isOpen) setHasLoadedInitialData(false);
  }, [isOpen]);

  useEffect(() => {
    if (readonly || !userId || hasLoadedInitialData) return;
    const loadData = async () => {
      try {
        const savedLayout = await persistence.loadLayout();
        if (savedLayout) {
          if (savedLayout.positions && savedLayout.positions.length > 0) {
            savedLayout.positions.forEach((pos) => {
              canvasState.updateTeamPosition(pos.teamId, { x: pos.x, y: pos.y });
            });
          }
          if (savedLayout.connections?.length > 0) {
            const currentConnections = [...canvasState.canvasState.connections];
            currentConnections.forEach((conn) => canvasState.removeConnection(conn.id));
            const validConnections = savedLayout.connections.filter(
              (conn) => !conn.sourceHandle?.endsWith('-target'),
            );
            validConnections.forEach((conn) => {
              canvasState.addConnection({
                fromTeamId: conn.fromTeamId,
                toTeamId: conn.toTeamId,
                type: conn.type,
                createdAt: conn.createdAt,
                sourceHandle: conn.sourceHandle || 'right',
                targetHandle: conn.targetHandle || 'left-target',
              });
            });
          }
          if (savedLayout.viewSettings) {
            setZoom(savedLayout.viewSettings.zoom || 0.6);
          }
          canvasState.markSaved();
        } else {
          canvasState.addMissingTeamPositions(teams);
        }
        setHasLoadedInitialData(true);
      } catch (error) {
        console.error('Failed to load canvas data:', error);
        toast.error('Failed to load canvas layout');
        setHasLoadedInitialData(true);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readonly, userId, hasLoadedInitialData, persistence]);

  const handleConnectionStart = useCallback(
    (_teamId: string, _handle: string) => {
      if (readonly) return;
    },
    [readonly],
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode !== viewMode) setViewMode(mode);
    },
    [viewMode],
  );

  const stableCallbacks = useMemo(
    () => ({
      onTeamClick: (teamId: string) => {
        canvasState.selectTeams([teamId]);
      },
      onTeamEdit: onTeamUpdate || (() => {}),
      onTeamDelete: onTeamDelete || (() => {}),
      onConnectionStart: handleConnectionStart,
    }),
    [canvasState.selectTeams, onTeamUpdate, onTeamDelete, handleConnectionStart],
  );

  const nodes = useMemo<Node<TeamNodeData>[]>(
    () =>
      teamsToNodes(teams, teamMembers, canvasState.canvasState.teamPositions, {
        selectedTeams: canvasState.canvasState.selectedTeams,
        ...stableCallbacks,
      }),
    [
      teams,
      teamMembers,
      canvasState.canvasState.teamPositions,
      canvasState.canvasState.selectedTeams,
      stableCallbacks,
    ],
  );

  const edges = useMemo<Edge<ConnectionEdgeData>[]>(
    () =>
      connectionsToEdges(canvasState.canvasState.connections, teams, {
        selectedConnections: canvasState.canvasState.selectedConnections,
        onEdgeClick: () => {},
        onEdgeDelete: (connectionId: string) => {
          if (readonly) return;
          const removed = connections.removeConnection(connectionId);
          if (removed) {
            canvasState.removeConnection(connectionId);
            toast.success('Connection removed');
          }
        },
        onEdgeEdit: (connectionId: string, newType: ConnectionType) => {
          if (readonly) return;
          canvasState.updateConnection(connectionId, { type: newType });
          toast.success(`Connection updated to: ${newType.replace('_', ' ')}`);
        },
      }),
    [
      canvasState.canvasState.connections,
      canvasState.canvasState.selectedConnections,
      teams,
      readonly,
      connections,
      canvasState,
    ],
  );

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  useEffect(() => setNodes(nodes), [nodes, setNodes]);
  useEffect(() => setEdges(edges), [edges, setEdges]);

  const handleNodesChange = useCallback(
    async (changes: any[]) => {
      onNodesChange(changes);
      const positionChanges = changes.filter(
        (change) => change.type === 'position' && change.dragging === false,
      );
      if (positionChanges.length > 0) {
        positionChanges.forEach((change) => {
          const node = flowNodes.find((n) => n.id === change.id);
          if (node && node.position) canvasState.updateTeamPosition(change.id, node.position);
        });
        if (!readonly && reactFlowInstance) {
          setTimeout(async () => {
            try {
              setIsSaving(true);
              const viewport = reactFlowInstance.getViewport();
              const positions = Array.from(canvasState.canvasState.teamPositions.values());
              const layout = {
                userId,
                workspaceId,
                positions,
                connections: canvasState.canvasState.connections,
                viewSettings: { zoom: viewport.zoom, centerX: viewport.x, centerY: viewport.y },
              };
              await persistence.saveLayout(layout);
              canvasState.markSaved();
            } catch (error) {
              console.error('Failed to auto-save position changes:', error);
            } finally {
              setIsSaving(false);
            }
          }, 1500);
        }
      }
    },
    [onNodesChange, canvasState, readonly, reactFlowInstance, userId, workspaceId, persistence, flowNodes],
  );

  const handleEdgesChange = useCallback((changes: any[]) => onEdgesChange(changes), [onEdgesChange]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (readonly) return;
      let cleanSourceHandle = connection.sourceHandle || 'right';
      if (
        cleanSourceHandle.endsWith('-target') &&
        cleanSourceHandle !== 'left-target' &&
        cleanSourceHandle !== 'right-target'
      ) {
        cleanSourceHandle = cleanSourceHandle.replace('-target', '');
      }
      canvasState.addConnection({
        fromTeamId: connection.source!,
        toTeamId: connection.target!,
        type: 'collaborates_with' as ConnectionType,
        sourceHandle: cleanSourceHandle,
        targetHandle: connection.targetHandle,
      });
      setTimeout(async () => {
        if (!readonly && reactFlowInstance) {
          try {
            setIsSaving(true);
            const viewport = reactFlowInstance.getViewport();
            const layout = {
              userId,
              workspaceId,
              positions: Array.from(canvasState.canvasState.teamPositions.values()),
              connections: canvasState.canvasState.connections,
              viewSettings: { zoom: viewport.zoom, centerX: viewport.x, centerY: viewport.y },
            };
            await persistence.saveLayout(layout);
            canvasState.markSaved();
          } catch (error) {
            console.error('Failed to auto-save connection changes:', error);
          } finally {
            setIsSaving(false);
          }
        }
      }, 1000);
      toast.success('Teams connected! Click the connection to change relationship type.');
    },
    [canvasState, readonly, reactFlowInstance, userId, workspaceId, persistence],
  );

  const handleZoomIn = useCallback(() => {
    if (!reactFlowInstance) return;
    reactFlowInstance.zoomIn();
    setZoom(reactFlowInstance.getZoom());
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (!reactFlowInstance) return;
    reactFlowInstance.zoomOut();
    setZoom(reactFlowInstance.getZoom());
  }, [reactFlowInstance]);

  const handleMove = useCallback((_event: any, viewport: any) => {
    setZoom(viewport.zoom);
  }, []);

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
        viewSettings: { zoom: viewport.zoom, centerX: viewport.x, centerY: viewport.y },
      };
      await persistence.saveLayout(layout);
      canvasState.markSaved();
    } finally {
      setIsSaving(false);
    }
  }, [readonly, reactFlowInstance, canvasState, userId, workspaceId, persistence]);

  const reactFlowProps = useMemo(
    () => ({
      nodes: flowNodes,
      edges: flowEdges,
      onNodesChange: handleNodesChange,
      onEdgesChange: handleEdgesChange,
      onConnect,
      onMove: handleMove,
      nodeTypes,
      edgeTypes,
      connectionMode: ConnectionMode.Loose,
      defaultMarkerColor: '#374151',
      fitView: false,
      minZoom: 0.1,
      maxZoom: 4,
      zoomOnScroll: true,
      zoomOnPinch: true,
      zoomOnDoubleClick: true,
      panOnScroll: true,
      preventScrolling: false,
      defaultViewport: { x: 0, y: 0, zoom: 0.6 },
      proOptions: { hideAttribution: true },
      attributionPosition: 'bottom-left' as const,
      connectOnClick: false,
      deleteKeyCode: 'Delete',
      multiSelectionKeyCode: 'Meta',
      snapToGrid: false,
      snapGrid: [15, 15] as [number, number],
    }),
    [flowNodes, flowEdges, handleNodesChange, handleEdgesChange, onConnect, handleMove],
  );

  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {showToolbar && (
        <CanvasToolbar
          zoom={zoom}
          canZoomIn={zoom < 4}
          canZoomOut={zoom > 0.1}
          viewMode={viewMode}
          connectionMode={null}
          isConnecting={false}
          hasUnsavedChanges={canvasState.hasUnsavedChanges}
          isSaving={isSaving || persistence.isSaving}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={() => {}}
          onResetLayout={() => {}}
          onSaveLayout={handleSaveLayout}
          onExportLayout={() => toast.info('Export functionality coming soon')}
          onViewModeChange={handleViewModeChange}
          onConnectionModeChange={() => {}}
          onShowSettings={() => toast.info('Settings modal coming soon')}
          onCreateTeam={onTeamCreate}
          showMinimap={canvasState.canvasState.showMinimap}
          onToggleMinimap={() => {}}
        />
      )}
      <div className="flex-1 h-full relative">
        <div style={{ display: viewMode === 'grid' ? 'block' : 'none', height: '100%' }}>
          <GridView teams={teams} teamMembers={teamMembers} />
        </div>
        {viewMode === 'canvas' && (
          <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}>
            <ReactFlow
              {...reactFlowProps}
              style={{ width: '100%', height: '100%' }}
              onInit={(instance) => setReactFlowInstance(instance)}
            >
              <Background color="#e5e7eb" gap={20} size={1} variant="dots" />
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
