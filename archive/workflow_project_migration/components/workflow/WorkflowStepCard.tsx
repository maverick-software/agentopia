import React, { useState } from 'react';
import { CheckCircle, Circle, AlertCircle, Zap, Search, FileText, BarChart2, ClipboardList, Eye, ChevronDown } from 'lucide-react';
import { ModelSelector } from '../ai/ModelSelector';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface WorkflowStepCardProps {
  step: any;
  stepNumber: number;
  onComplete: (stepId: string, finalOutput: any) => void;
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({
  step,
  stepNumber,
  onComplete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai');
  const [prompt, setPrompt] = useState(step.ai_prompt || step.description);
  const [isGenerating, setIsGenerating] = useState(false); 
  const [aiOutput, setAiOutput] = useState(step.ai_output ? JSON.stringify(step.ai_output, null, 2) : '');
  const [editedOutput, setEditedOutput] = useState(
    step.human_edits ? JSON.stringify(step.human_edits, null, 2) : 
    step.ai_output ? JSON.stringify(step.ai_output, null, 2) : ''
  );

  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="text-success" size={20} />;
      case 'in_progress':
        return <AlertCircle className="text-warning" size={20} />;
      default:
        return <Circle className="text-muted-foreground" size={20} />;
    }
  };

  const getResearchStateIcon = () => {
    if (step.phase !== 'research') return null;
    
    switch (step.research_state) {
      case 'gathering_data':
        return <Search className="text-primary" size={16} />;
      case 'analyzing':
        return <BarChart2 className="text-accent-foreground" size={16} />;
      case 'documenting':
        return <FileText className="text-primary" size={16} />;
      case 'reviewing':
        return <Eye className="text-warning" size={16} />;
      case 'completed':
        return <CheckCircle className="text-success" size={16} />;
      default:
        return <ClipboardList className="text-muted-foreground" size={16} />;
    }
  };

  const getResearchStateLabel = () => {
    if (step.phase !== 'research') return null;
    
    const labels = {
      'not_started': 'Not Started',
      'gathering_data': 'Gathering Data',
      'analyzing': 'Analyzing',
      'documenting': 'Documenting',
      'reviewing': 'Reviewing',
      'completed': 'Completed'
    };
    
    return labels[step.research_state] || 'Not Started';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 1500));
      const simulatedOutput = {
        content: `Generated content for "${prompt}" using ${selectedModel}.`,
        metadata: {
          model: selectedModel,
          timestamp: new Date().toISOString(),
          prompt
        }
      };
      setAiOutput(JSON.stringify(simulatedOutput, null, 2));
      setEditedOutput(JSON.stringify(simulatedOutput, null, 2));
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader 
        className={`p-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-muted/50' : 'hover:bg-muted/50'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-foreground">{step.name}</span>
              {step.status === 'completed' && (
                <Badge variant="default" className="bg-success hover:bg-success/90 text-success-foreground text-xs px-2 py-0.5">
                  Completed
                </Badge>
              )}
            </div>
            {step.phase === 'research' && (
              <div className="flex items-center mt-1.5 space-x-1.5">
                {getResearchStateIcon()}
                <span className="text-xs font-medium text-muted-foreground">{getResearchStateLabel()}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-muted-foreground">Step {stepNumber}</span>
          <ChevronDown size={20} className={`text-muted-foreground transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-6 space-y-6 border-t border-border">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-foreground mb-1.5">Description</h4>
            <p className="text-muted-foreground text-sm">{step.description}</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor={`prompt-${step.id}`} className="block text-sm font-medium mb-1.5 text-foreground">
                AI Prompt
              </Label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Textarea
                  id={`prompt-${step.id}`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 min-h-[100px] font-mono text-sm resize-y"
                  placeholder="Enter your prompt..."
                />
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="self-start sm:self-center whitespace-nowrap"
                  variant="default"
                >
                  <Zap size={16} className="mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>

            <ModelSelector onModelSelect={setSelectedModel} />

            {aiOutput && (
              <>
                <div>
                  <Label htmlFor={`ai-output-${step.id}`} className="block text-sm font-medium mb-1.5 text-foreground">
                    AI Output
                  </Label>
                  <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono text-sm border border-border">
                    {aiOutput}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`edit-output-${step.id}`} className="block text-sm font-medium mb-1.5 text-foreground">
                    Edit Output
                  </Label>
                  <Textarea
                    id={`edit-output-${step.id}`}
                    value={editedOutput}
                    onChange={(e) => setEditedOutput(e.target.value)}
                    className="w-full min-h-[200px] font-mono text-sm resize-y"
                  />
                </div>

                <Button
                  onClick={() => {
                    try {
                      const parsedOutput = JSON.parse(editedOutput);
                      onComplete(step.id, parsedOutput);
                    } catch (e) {
                      console.error("Error parsing edited output:", e);
                      // Optionally, set an error state to inform the user
                      // For now, we'll just log it and not call onComplete
                    }
                  }}
                  variant="default" // Or a success variant if available e.g. className="bg-success hover:bg-success/90"
                  className="w-full"
                  disabled={!editedOutput.trim()} // Disable if no output to complete with
                >
                  <CheckCircle size={18} className="mr-2" />
                  Complete Step
                </Button>
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};