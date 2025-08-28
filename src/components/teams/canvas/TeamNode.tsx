import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  Users, 
  MoreVertical, 
  Edit, 
  ExternalLink, 
  Trash2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { TeamNodeProps } from './types/canvas';

// Team color mapping based on type or default gradient
const teamColors = {
  'engineering': 'from-blue-500 to-blue-600',
  'marketing': 'from-purple-500 to-purple-600', 
  'sales': 'from-green-500 to-green-600',
  'hr': 'from-orange-500 to-orange-600',
  'operations': 'from-gray-500 to-gray-600',
  'default': 'from-primary to-primary/80'
};

export const TeamNode = memo<TeamNodeProps>(({
  team,
  members,
  data,
  selected,
  isConnecting,
  connectionMode,
  onTeamClick,
  onTeamEdit,
  onTeamDelete,
  onConnectionStart,
  className,
  style
}) => {
  const memberCount = members.length;
  const agentNames = members.map(member => `Agent ${member.agent_id.slice(0, 8)}`);
  const teamType = data.teamType || 'default';
  const gradientClass = teamColors[teamType as keyof typeof teamColors] || teamColors.default;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamClick(team.id);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamEdit(team.id);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamDelete(team.id);
  };
  
  const handleConnectionStart = (position: 'top' | 'right' | 'bottom' | 'left') => {
    onConnectionStart(team.id, position);
  };
  
  return (
    <div
      className={cn(
        "team-node relative group bg-card border-2 rounded-xl shadow-md transition-all duration-200",
        "min-w-[200px] max-w-[280px] p-4 cursor-pointer",
        selected && "border-primary shadow-lg scale-105 bg-primary/5",
        isConnecting && connectionMode && "ring-2 ring-primary/30",
        className
      )}
      style={style}
      onClick={handleClick}
    >
      {/* Connection Handles - only visible on hover or when connecting */}
      <Handle 
        type="source" 
        position={Position.Top} 
        className={cn(
          "react-flow__handle react-flow__handle-top",
          "!bg-primary !border-2 !border-primary-foreground",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          (isConnecting || connectionMode) ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('top')}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={cn(
          "react-flow__handle react-flow__handle-right",
          "!bg-primary !border-2 !border-primary-foreground",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          (isConnecting || connectionMode) ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('right')}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={cn(
          "react-flow__handle react-flow__handle-bottom",
          "!bg-primary !border-2 !border-primary-foreground",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          (isConnecting || connectionMode) ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('bottom')}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        className={cn(
          "react-flow__handle react-flow__handle-left",
          "!bg-primary !border-2 !border-primary-foreground",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          (isConnecting || connectionMode) ? "!opacity-100" : "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('left')}
      />
      
      {/* Target handles for receiving connections */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!opacity-0"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        className="!opacity-0"
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        className="!opacity-0"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!opacity-0"
      />
      
      {/* Node Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            `bg-gradient-to-br ${gradientClass}`
          )}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-sm truncate" 
              title={team.name}
            >
              {team.name}
            </h3>
          </div>
        </div>
        
        {/* Member Count Badge */}
        <Badge variant="secondary" className="text-xs ml-2">
          {memberCount}
        </Badge>
      </div>
      
      {/* Node Content */}
      <div className="space-y-2">
        {/* Team Description */}
        <p 
          className="text-xs text-muted-foreground line-clamp-2" 
          title={team.description || 'No description'}
        >
          {team.description || 'No description available'}
        </p>
        
        {/* Agent List */}
        {agentNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agentNames.slice(0, 3).map((name, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs px-1 py-0"
              >
                {name}
              </Badge>
            ))}
            {agentNames.length > 3 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                +{agentNames.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        {/* Last Activity */}
        {data.lastActivity && (
          <div className="text-xs text-muted-foreground">
            Last active: {new Date(data.lastActivity).toLocaleDateString()}
          </div>
        )}
      </div>
      
      {/* Context Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Team
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleClick}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Selection indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none" />
      )}
      
      {/* Connecting mode indicator */}
      {isConnecting && connectionMode && (
        <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border-2 border-dashed border-primary/50 rounded-xl pointer-events-none animate-pulse" />
      )}
    </div>
  );
});

TeamNode.displayName = 'TeamNode';
