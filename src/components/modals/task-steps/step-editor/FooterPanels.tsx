import React from 'react';
import { Eye, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface FooterPanelsProps {
  canShowContextPreview: boolean;
  previousStepResult: unknown;
  showContextPreview: boolean;
  onToggleContextPreview: () => void;
  showValidationErrors: boolean;
  validationErrors: string[];
}

export function FooterPanels({
  canShowContextPreview,
  previousStepResult,
  showContextPreview,
  onToggleContextPreview,
  showValidationErrors,
  validationErrors,
}: FooterPanelsProps) {
  return (
    <div className="space-y-4">
      {canShowContextPreview && (
        <Card className="bg-muted/50 dark:bg-muted/50 border-border dark:border-border rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-foreground">Previous Step Result Preview</Label>
              <Button variant="ghost" size="sm" onClick={onToggleContextPreview} className="h-6 px-2 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                {showContextPreview ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showContextPreview && (
              <div className="bg-background dark:bg-background border border-border dark:border-border rounded p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-foreground whitespace-pre-wrap">{JSON.stringify(previousStepResult, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showValidationErrors && validationErrors.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-start space-x-2">
              <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Please complete the following:</p>
                <ul className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-xs text-blue-700 dark:text-blue-300 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
