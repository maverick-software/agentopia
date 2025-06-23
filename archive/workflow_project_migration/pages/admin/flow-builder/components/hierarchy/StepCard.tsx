import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Play, Edit2, FileText, Check, X, Trash2, 
  Type, Hash, Mail, List, CheckSquare, Circle, Upload,
  BookOpen, AlignLeft, Link, Minus, Package, FileType, User, Plug,
  Shield, GitBranch, Wrench, Eye, CheckCircle, Calendar, Clock,
  Star, PenTool, MousePointer, TrendingUp, Bell, Table, MapPin, Phone,
  Image, Images, BarChart, Heading
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { ElementManager } from '@/lib/flow-elements/ElementManager';
import type { 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';
import { DescriptionToggle } from '@/components/workflow/description';

interface StepCardProps {
  step: UnifiedWorkflowStep;
  elements: UnifiedWorkflowElement[];
  isSelected: boolean;
  onSelect: () => void;
  onElementSelect: (elementId: string) => void;
  selectedElementId: string | null;
  onStepUpdate?: (stepId: string, updates: Partial<UnifiedWorkflowStep>) => void;
  onStepDelete?: (stepId: string) => void;
}

// Icon mapping function to convert icon strings to React components
const getIconComponent = (iconName: string | React.ComponentType) => {
  // If it's already a component, return it
  if (typeof iconName === 'function') {
    return iconName;
  }
  
  // Map icon strings to components
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'Type': Type,
    'Hash': Hash,
    'Mail': Mail,
    'List': List,
    'CheckSquare': CheckSquare,
    'Circle': Circle,
    'Upload': Upload,
    'BookOpen': BookOpen,
    'AlignLeft': AlignLeft,
    'Link': Link,
    'Minus': Minus,
    'Package': Package,
    'FileType': FileType,
    'User': User,
    'Plug': Plug,
    'Shield': Shield,
    'GitBranch': GitBranch,
    'Wrench': Wrench,
    'Eye': Eye,
    'CheckCircle': CheckCircle,
    'Calendar': Calendar,
    'Clock': Clock,
    'Star': Star,
    'PenTool': PenTool,
    'MousePointer': MousePointer,
    'TrendingUp': TrendingUp,
    'Bell': Bell,
    'Table': Table,
    'MapPin': MapPin,
    'Phone': Phone,
    'Image': Image,
    'Images': Images,
    'BarChart': BarChart,
    'Heading': Heading,
    'FileText': FileText
  };
  
  return iconMap[iconName] || FileText; // Default to FileText if icon not found
};

export const StepCard: React.FC<StepCardProps> = ({
  step, 
  elements,
  isSelected, 
  onSelect, 
  onElementSelect, 
  selectedElementId,
  onStepUpdate,
  onStepDelete
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(step.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(step.description || '');

  const { setNodeRef, isOver } = useDroppable({
    id: `step-${step.id}`,
  });

  const handleNameEdit = () => {
    setEditName(step.name);
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (editName.trim() && editName !== step.name && onStepUpdate) {
      onStepUpdate(step.id, { name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditName(step.name);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleDescriptionUpdate = (description: string) => {
    if (onStepUpdate) {
      onStepUpdate(step.id, { description });
    }
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(step.description || '');
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = () => {
    if (onStepUpdate) {
      onStepUpdate(step.id, { description: editedDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(step.description || '');
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      handleDescriptionCancel();
    }
  };

  return (
    <Card 
      ref={setNodeRef}
      className={`ml-6 transition-all group ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${isOver ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`}
    >
      <CardHeader 
        className="py-2 cursor-pointer"
        onClick={onSelect}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 flex-1">
            <Play className="h-3 w-3 text-muted-foreground" />
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleNameSave}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNameCancel}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <h5 
                    className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNameEdit();
                    }}
                  >
                    {step.name}
                  </h5>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onStepDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(
                    `Delete step "${step.name}"?\n\nThis will permanently delete:\n• The step\n• All ${elements.length} elements in this step\n\nThis action cannot be undone.`
                  )) {
                    onStepDelete(step.id);
                  }
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Delete Step"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
        
        {/* Description area - separate from title */}
        {!isEditingDescription && (
          <div className="px-4 pb-2 -mt-4">
            {step.description ? (
              <div 
                className="text-xs text-muted-foreground/80 cursor-pointer hover:text-foreground transition-colors ml-4"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescriptionEdit();
                }}
              >
                {step.description}
              </div>
            ) : (
              <div 
                className="text-xs text-muted-foreground/50 italic cursor-pointer hover:text-muted-foreground transition-colors ml-4"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDescriptionEdit();
                }}
              >
                Add a description here
              </div>
            )}
          </div>
        )}
        
        {isEditingDescription && (
          <div className="px-4 pb-2 space-y-2">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onKeyDown={handleDescriptionKeyDown}
              placeholder="Add a step description..."
              className="min-h-[80px] max-h-[150px] resize-y w-full text-xs"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleDescriptionSave}
                className="h-6 text-xs"
              >
                <Check className="h-2.5 w-2.5 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDescriptionCancel}
                className="h-6 text-xs"
              >
                <X className="h-2.5 w-2.5 mr-1" />
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter to save, Esc to cancel
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="py-2">
        <div className={`min-h-[40px] p-2 border-2 border-dashed rounded-lg transition-colors ${
          isOver 
            ? 'border-green-500 bg-green-50/50' 
            : 'border-muted-foreground/20 bg-muted/10'
        }`}>
          {elements.length > 0 ? (
            <div className="space-y-1">
              {elements.map((element) => {
                const implementation = ElementManager.get(element.element_type);
                const isElementSelected = selectedElementId === element.id;
                
                return (
                  <div 
                    key={element.id}
                    className={`p-1 bg-background rounded border shadow-sm cursor-pointer transition-colors text-xs ${
                      isElementSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onElementSelect(element.id);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {implementation?.icon && (() => {
                        const IconComponent = getIconComponent(implementation.icon);
                        return <IconComponent className="h-3 w-3 text-muted-foreground" />;
                      })()}
                      <span className="font-medium">
                        {element.label || implementation?.name || element.element_type}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {element.element_type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Drop elements here
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 