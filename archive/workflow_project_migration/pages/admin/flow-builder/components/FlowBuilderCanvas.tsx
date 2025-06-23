import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Workflow,
  Plus,
  Layers
} from 'lucide-react';
import type { 
  UnifiedWorkflowTemplate, 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';

type HierarchyLevel = 'template' | 'stage' | 'task' | 'step' | 'element';

interface FlowBuilderCanvasProps {
  // Template data
  template: UnifiedWorkflowTemplate | null;
  stages: UnifiedWorkflowStage[];
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
  
  // UI state
  activeLevel: HierarchyLevel;
  selectedItem: string | null;
  expandedItems: Set<string>;
  
  // Event handlers
  onSelectStage: (stageId: string) => void;
  onSelectTask: (taskId: string) => void;
  onSelectStep: (stepId: string) => void;
  onSelectElement: (elementId: string) => void;
  onToggleStageExpansion: (stageId: string) => void;
  onToggleTaskExpansion: (taskId: string) => void;
  onAddStage: () => void;
  onAddTask: (stageId: string) => void;
  onAddStep: (taskId: string) => void;
  
  // Update handlers
  onStageUpdate?: (stageId: string, updates: Partial<UnifiedWorkflowStage>) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<UnifiedWorkflowTask>) => void;
  onStepUpdate?: (stepId: string, updates: Partial<UnifiedWorkflowStep>) => void;
  
  // Deletion handlers
  onStageDelete?: (stageId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onStepDelete?: (stepId: string) => void;
  
  // Component dependencies
  CollapsibleStageCard: React.ComponentType<any>;
}

export const FlowBuilderCanvas: React.FC<FlowBuilderCanvasProps> = ({
  template,
  stages,
  tasks,
  steps,
  elements,
  activeLevel,
  selectedItem,
  expandedItems,
  onSelectStage,
  onSelectTask,
  onSelectStep,
  onSelectElement,
  onToggleStageExpansion,
  onToggleTaskExpansion,
  onAddStage,
  onAddTask,
  onAddStep,
  onStageUpdate,
  onTaskUpdate,
  onStepUpdate,
  onStageDelete,
  onTaskDelete,
  onStepDelete,
  CollapsibleStageCard
}) => {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="p-6">
        {/* Stages Section Header */}
        {template && stages.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium">Workflow Stages</h2>
              <Badge variant="outline">
                {stages.length} stage{stages.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddStage}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Stage
            </Button>
          </div>
        )}

        {/* Stages */}
        <div className="space-y-4">
          {stages.length > 0 ? (
            stages.map(stage => (
              <CollapsibleStageCard
                key={stage.id}
                stage={stage}
                tasks={tasks}
                steps={steps}
                elements={elements}
                isExpanded={expandedItems.has(stage.id)}
                isSelected={selectedItem === stage.id}
                onToggle={() => onToggleStageExpansion(stage.id)}
                onSelect={() => onSelectStage(stage.id)}
                onTaskSelect={onSelectTask}
                onStepSelect={onSelectStep}
                onElementSelect={onSelectElement}
                selectedItemId={selectedItem}
                activeLevel={activeLevel}
                expandedItems={expandedItems}
                onAddTask={onAddTask}
                onAddStep={onAddStep}
                onToggleTaskExpansion={onToggleTaskExpansion}
                onStageUpdate={onStageUpdate}
                onTaskUpdate={onTaskUpdate}
                onStepUpdate={onStepUpdate}
                onStageDelete={onStageDelete}
                onTaskDelete={onTaskDelete}
                onStepDelete={onStepDelete}
              />
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No stages yet</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first stage to organize your workflow.
                </p>
                <Button onClick={onAddStage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Stage
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}; 