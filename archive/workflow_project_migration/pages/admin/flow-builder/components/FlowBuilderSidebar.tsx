import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ElementPalette } from '@/components/flow-builder/ElementPalette';
import { ElementConfigPanel } from '@/components/flow-builder/config/ElementConfigPanel';
import type { UnifiedWorkflowElement } from '@/types/unified-workflow';

type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface ElementPaletteSidebarProps {
  activeLevel: HierarchyLevel;
}

interface ConfigurationPanelSidebarProps {
  selectedItem: string | null;
  selectedLevel: HierarchyLevel;
  elements: UnifiedWorkflowElement[];
  onElementUpdate?: (updates: any) => void;
  onElementDelete?: () => void;
  onMarkDirty?: () => void;
}

export const ElementPaletteSidebar: React.FC<ElementPaletteSidebarProps> = ({
  activeLevel
}) => {
  return (
    <div className="w-80 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b bg-background/50">
        <h3 className="font-medium mb-2">Element Palette</h3>
        <div className="text-xs text-muted-foreground">
          Active Level: <Badge variant="outline">{activeLevel}</Badge>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4">
          <ElementPalette />
        </div>
      </div>
    </div>
  );
};

export const ConfigurationPanelSidebar: React.FC<ConfigurationPanelSidebarProps> = ({
  selectedItem,
  selectedLevel,
  elements,
  onElementUpdate,
  onElementDelete,
  onMarkDirty
}) => {
  // Get display name for selected item
  const getDisplayName = () => {
    if (!selectedItem) return null;
    
    if (selectedLevel === 'element') {
      const element = elements.find(el => el.id === selectedItem);
      return element?.label || element?.element_type || 'Element';
    }
    
    return selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1);
  };

  const displayName = getDisplayName();

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b bg-background/50">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Configuration</h3>
          {displayName && (
            <Badge variant="outline" className="text-xs">
              {displayName}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4">
          {selectedItem && selectedLevel === 'element' ? (
            (() => {
              const selectedElement = elements.find(el => el.id === selectedItem);
              if (!selectedElement) return <div className="text-sm text-muted-foreground">Element not found</div>;
              
              // Convert UnifiedWorkflowElement to FlowBuilderElement format
              const flowBuilderElement = {
                id: selectedElement.id,
                type: selectedElement.element_type as any, // Type assertion for compatibility
                label: selectedElement.label || '',
                config: selectedElement.config,
                validation: {
                  required: selectedElement.is_required,
                  rules: selectedElement.validation_rules
                }
              };
              
              return (
                <ElementConfigPanel
                  element={flowBuilderElement}
                  onChange={(updates) => {
                    if (onElementUpdate) {
                      onElementUpdate(updates);
                    }
                    if (onMarkDirty) {
                      onMarkDirty();
                    }
                  }}
                  onDelete={() => {
                    if (onElementDelete) {
                      onElementDelete();
                    }
                    if (onMarkDirty) {
                      onMarkDirty();
                    }
                  }}
                />
              );
            })()
          ) : (
            <div className="text-sm text-muted-foreground">
              Select an item to configure its properties
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 