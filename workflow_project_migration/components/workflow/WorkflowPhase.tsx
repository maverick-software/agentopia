import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WorkflowStepCard } from './WorkflowStepCard';
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface WorkflowPhaseProps {
  phase: string;
  steps: any[];
  isExpanded: boolean;
  onToggle: () => void;
  onStepComplete: (stepId: string, finalOutput: any) => void;
}

export const WorkflowPhase: React.FC<WorkflowPhaseProps> = ({
  phase,
  steps,
  isExpanded,
  onToggle,
  onStepComplete,
}) => {
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className="p-0 hover:bg-muted cursor-pointer" 
        onClick={onToggle}
      >
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-base capitalize">
              {phase}
            </Badge>
            <div className="flex items-center space-x-2">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-primary transition-all duration-300`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-muted-foreground text-sm">
                {completedSteps} of {steps.length}
              </span>
            </div>
          </div>
          {isExpanded ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-6 border-t border-border space-y-4">
          {steps.map((step, index) => (
            <WorkflowStepCard
              key={step.id}
              step={step}
              stepNumber={index + 1}
              onComplete={onStepComplete}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
};