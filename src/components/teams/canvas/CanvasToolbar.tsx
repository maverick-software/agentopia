import React, { useCallback } from 'react';
import { 
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

  hasUnsavedChanges,
  isSaving,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetLayout,
  onSaveLayout,
  onExportLayout,
  onViewModeChange,

  onShowSettings,
  showMinimap = true,
  onToggleMinimap,
  className
}) => {
  // Ensure zoom is valid, default to 100% if NaN
  const validZoom = !isNaN(zoom) && zoom > 0 ? zoom : 1;
  const zoomPercentage = Math.round(validZoom * 100);
  

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
            
            {/* Canvas Controls - No Zoom */}
            <div className="flex items-center space-x-1">
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
      
      {/* Center Section: Connection Help Text - only show in canvas mode */}
      {viewMode === 'canvas' && (
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="text-xs">
            💡 Drag between teams to connect them
          </Badge>
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
