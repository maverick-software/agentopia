import React, { useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  RotateCcw, 
  Save, 
  Settings, 
  Grid, 
  Network,
  Loader2,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
// Temporarily using native select instead of Radix Select to fix infinite update loop
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';

import type { CanvasToolbarProps, ConnectionType } from './types/canvas';

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  canZoomIn,
  canZoomOut,
  viewMode,
  connectionMode,
  isConnecting,
  hasUnsavedChanges,
  isSaving,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetLayout,
  onSaveLayout,
  onExportLayout,
  onViewModeChange,
  onConnectionModeChange,
  onShowSettings,
  showMinimap = true,
  onToggleMinimap,
  className
}) => {
  const zoomPercentage = Math.round(zoom * 100);
  
  // Memoize the Select's onValueChange to prevent infinite updates
  const handleConnectionModeChange = useCallback((value: string) => {
    onConnectionModeChange(value === 'none' ? null : value as ConnectionType);
  }, [onConnectionModeChange]);
  
  return (
    <div className={cn(
      "flex items-center justify-between p-4 bg-card border-b border-border",
      className
    )}>
      {/* Left Section: View Controls */}
      <div className="flex items-center space-x-3">
        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            onClick={() => onViewModeChange('grid')}
            className="rounded-none border-none"
          >
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="sm"
            variant={viewMode === 'canvas' ? 'default' : 'ghost'}
            onClick={() => onViewModeChange('canvas')}
            className="rounded-none border-none"
          >
            <Network className="h-4 w-4 mr-1" />
            Canvas
          </Button>
        </div>
        
        {/* Canvas Controls - only show in canvas mode */}
        {viewMode === 'canvas' && (
          <>
            <Separator orientation="vertical" className="h-6" />
            
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onZoomOut}
                disabled={!canZoomOut}
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <div className="text-sm text-muted-foreground px-2 min-w-[60px] text-center font-mono">
                {zoomPercentage}%
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={onZoomIn}
                disabled={!canZoomIn}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onFitView}
                title="Fit View"
              >
                <Maximize className="h-4 w-4 mr-1" />
                Fit View
              </Button>
            </div>
          </>
        )}
      </div>
      
      {/* Center Section: Connection Tools - only show in canvas mode */}
      {viewMode === 'canvas' && (
        <div className="flex items-center space-x-3">
          <Label className="text-sm font-medium">Connection:</Label>
          <select 
            value={connectionMode || 'none'} 
            onChange={(e) => handleConnectionModeChange(e.target.value)}
            className="w-40 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          >
            <option value="none">None</option>
            <option value="reports_to">Reports To</option>
            <option value="collaborates_with">Collaborates With</option>
            <option value="supports">Supports</option>
            <option value="custom">Custom</option>
          </select>
          
          {/* Connection Status Indicator */}
          {isConnecting && (
            <Badge variant="secondary" className="animate-pulse">
              Connecting teams...
            </Badge>
          )}
          
          {connectionMode && !isConnecting && (
            <Badge variant="outline">
              {connectionMode === 'reports_to' && 'Reports To mode'}
              {connectionMode === 'collaborates_with' && 'Collaboration mode'}
              {connectionMode === 'supports' && 'Support mode'}
              {connectionMode === 'custom' && 'Custom mode'}
            </Badge>
          )}
        </div>
      )}
      
      {/* Right Section: Actions */}
      <div className="flex items-center space-x-2">
        {/* Canvas-specific actions */}
        {viewMode === 'canvas' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onResetLayout}
              title="Reset Layout"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onExportLayout}
              title="Export Layout"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            <Button
              size="sm"
              onClick={onSaveLayout}
              disabled={isSaving || !hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save Layout" : "No changes to save"}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {hasUnsavedChanges ? 'Save Layout' : 'Saved'}
                </>
              )}
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
        
        {/* Settings */}
        <Button
          size="sm"
          variant="outline"
          onClick={onShowSettings}
          title="Canvas Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        
        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && viewMode === 'canvas' && (
          <Badge variant="destructive" className="ml-2">
            Unsaved
          </Badge>
        )}
      </div>
    </div>
  );
};
