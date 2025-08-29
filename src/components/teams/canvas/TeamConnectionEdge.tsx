import React, { memo } from 'react';
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  getBezierPath,
  getSimpleBezierPath,
  getStraightPath,
  MarkerType,
  EdgeProps
} from 'reactflow';
import { X, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { ConnectionEdgeData } from './types/canvas';

// Connection styling based on type
const connectionStyles = {
  reports_to: {
    stroke: 'hsl(var(--foreground))',
    strokeWidth: 2,
    strokeDasharray: 'none',
    markerEnd: MarkerType.ArrowClosed,
  },
  collaborates_with: {
    stroke: 'hsl(var(--muted-foreground))',
    strokeWidth: 2,
    strokeDasharray: '10 5',
    markerEnd: undefined,
  },
  supports: {
    stroke: 'hsl(var(--success))',
    strokeWidth: 2,
    strokeDasharray: '2 3',
    markerEnd: MarkerType.Arrow,
  },
  custom: {
    stroke: 'hsl(var(--primary))',
    strokeWidth: 2,
    strokeDasharray: 'none',
    markerEnd: MarkerType.Arrow,
  }
};

// Connection labels for display
const connectionLabels = {
  reports_to: 'Reports To',
  collaborates_with: 'Collaborates With',
  supports: 'Supports',
  custom: 'Custom'
};

export const TeamConnectionEdge = memo<EdgeProps<ConnectionEdgeData>>(({
  id,
  source,
  target,
  selected,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition
}) => {
  const connection = data.connection;
  const connectionType = connection.type;
  const style = connectionStyles[connectionType];
  const label = connection.label || connectionLabels[connectionType];
  
  // Extract callbacks from data
  const {
    onEdgeClick = () => {},
    onEdgeDelete = () => {},
    onEdgeEdit = () => {}
  } = data;
  
  // Use custom color if provided
  const strokeColor = connection.color || style.stroke;
  
  // Calculate path based on connection style preference
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeClick(id);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeDelete(id);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeEdit(id);
  };
  
  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? style.strokeWidth + 1 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: selected ? 1 : 0.8,
        }}
        markerEnd={style.markerEnd ? `url(#${style.markerEnd})` : undefined}
        onClick={handleClick}
        className={cn(
          "cursor-pointer transition-all duration-200",
          selected && "drop-shadow-lg"
        )}
      />
      
      {/* Edge label and controls */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          className="pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center space-x-2">
            {/* Connection label */}
            <Badge 
              variant={selected ? "default" : "secondary"}
              className={cn(
                "text-xs px-2 py-1 cursor-pointer transition-all duration-200",
                "bg-background/90 backdrop-blur-sm border shadow-sm",
                selected && "shadow-md scale-105"
              )}
              onClick={handleClick}
            >
              {label}
            </Badge>
            
            {/* Controls - only show on hover or when selected */}
            <div className={cn(
              "flex items-center space-x-1 opacity-0 transition-opacity duration-200",
              selected && "opacity-100"
            )}>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 bg-background/90 backdrop-blur-sm"
                onClick={handleEdit}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 bg-background/90 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDelete}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
      
      {/* Selection indicator */}
      {selected && (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{
            stroke: 'hsl(var(--primary))',
            strokeWidth: style.strokeWidth + 3,
            strokeDasharray: 'none',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
});

TeamConnectionEdge.displayName = 'TeamConnectionEdge';
