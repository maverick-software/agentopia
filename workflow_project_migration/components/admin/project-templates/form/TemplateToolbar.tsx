import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Filter, ArrowUpDown, Group } from 'lucide-react';

export interface TemplateToolbarProps {
  onAddStage: () => void;
  stageCount: number;
}

export const TemplateToolbar: React.FC<TemplateToolbarProps> = ({
  onAddStage,
  stageCount
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddStage}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Add stage
        </Button>
        <div className="h-4 w-px bg-border"></div>
        <Button variant="ghost" size="sm" type="button">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
        <Button variant="ghost" size="sm" type="button">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Sort
        </Button>
        <Button variant="ghost" size="sm" type="button">
          <Group className="h-4 w-4 mr-2" />
          Group
        </Button>
      </div>
    </div>
  );
}; 
 