import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Workflow
} from 'lucide-react';

interface FlowBuilderHeaderProps {
  templateName: string | null;
  templateDescription?: string | null;
  isNewTemplate: boolean;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  migrationMode: string;
  isUsingUnifiedService: boolean;
  isTemplateSelected?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onSelectTemplate?: () => void;
}

const SaveStatusIndicator: React.FC<{ saveStatus: 'idle' | 'saving' | 'saved' | 'error' }> = ({ saveStatus }) => {
  switch (saveStatus) {
    case 'saving':
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    case 'saved':
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Saved</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>Error saving</span>
        </div>
      );
    default:
      return null;
  }
};

export const FlowBuilderHeader: React.FC<FlowBuilderHeaderProps> = ({
  templateName,
  templateDescription,
  isNewTemplate,
  isDirty,
  saveStatus,
  migrationMode,
  isUsingUnifiedService,
  isTemplateSelected,
  onSave,
  onCancel,
  onSelectTemplate
}) => {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/project-flows">
              <ArrowLeft className="h-4 w-4" />
              Back to Flows
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            <div 
              className={`cursor-pointer transition-colors ${
                isTemplateSelected ? 'text-primary' : 'hover:text-primary'
              }`}
              onClick={onSelectTemplate}
            >
              <h1 className="text-lg font-semibold">
                {isNewTemplate ? 'New Workflow Template' : templateName || 'Loading...'}
              </h1>
              {templateDescription && isTemplateSelected && (
                <p className="text-xs text-muted-foreground max-w-md truncate">
                  {templateDescription}
                </p>
              )}
            </div>
            {isDirty && (
              <Badge variant="secondary">Unsaved changes</Badge>
            )}
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-4">
          {/* Simplified mode indicator */}
          <div className="text-xs text-muted-foreground">
            {isUsingUnifiedService ? 'Unified' : 'Legacy'} Mode
          </div>
          
          <SaveStatusIndicator saveStatus={saveStatus} />
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 