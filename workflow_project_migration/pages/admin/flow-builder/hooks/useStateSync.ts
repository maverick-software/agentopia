import { useEffect, useRef } from 'react';
import type { UnifiedWorkflowBuilderState } from '../types';

interface TemplateData {
  template: any;
  stages: any[];
  tasks: any[];
  steps: any[];
  elements: any[];
}

interface UseStateSyncProps {
  templateData: TemplateData;
  templateLoading: boolean;
  templateError: string | null;
  onStateUpdate: (updater: (prev: UnifiedWorkflowBuilderState) => UnifiedWorkflowBuilderState) => void;
}

export const useStateSync = ({
  templateData,
  templateLoading,
  templateError,
  onStateUpdate
}: UseStateSyncProps) => {
  // Use refs to track previous values and prevent unnecessary updates
  const prevTemplateIdRef = useRef<string | null>(null);
  const prevLoadingRef = useRef<boolean>(templateLoading);
  const prevErrorRef = useRef<string | null>(templateError);
  const prevDataHashRef = useRef<string>('');

  // Sync template data from hook to component state (fixes blank state)
  useEffect(() => {
    const currentTemplateId = templateData.template?.id || null;
    const hasTemplateChanged = prevTemplateIdRef.current !== currentTemplateId;
    const hasLoadingChanged = prevLoadingRef.current !== templateLoading;
    const hasErrorChanged = prevErrorRef.current !== templateError;
    
    // Create a simple hash of the data to detect actual content changes
    const dataHash = `${currentTemplateId}-${templateData.stages.length}-${templateData.tasks.length}-${templateData.steps.length}-${templateData.elements.length}`;
    const hasDataChanged = prevDataHashRef.current !== dataHash;

    // Only log and update if something actually changed
    if (hasTemplateChanged || hasLoadingChanged || hasErrorChanged || hasDataChanged) {
      console.log('useStateSync: State sync useEffect triggered', {
        hasTemplate: !!templateData.template,
        templateLoading,
        templateError,
        templateId: currentTemplateId,
        hasTemplateChanged,
        hasLoadingChanged,
        hasErrorChanged,
        hasDataChanged
      });

      if (templateData.template && !templateLoading) {
        console.log('useStateSync: Setting template data', {
          templateName: templateData.template.name,
          stagesCount: templateData.stages.length,
          tasksCount: templateData.tasks.length,
          stepsCount: templateData.steps.length,
          elementsCount: templateData.elements.length
        });
        
        onStateUpdate(prev => ({
          ...prev,
          ...templateData,
          isLoading: false,
          errors: templateError ? [templateError] : []
        }));
      } else if (templateLoading && !templateData.template) {
        console.log('useStateSync: Template is loading, setting loading state');
        onStateUpdate(prev => ({
          ...prev,
          isLoading: true,
          errors: templateError ? [templateError] : []
        }));
      } else if (templateError && !templateLoading) {
        console.log('useStateSync: Template error occurred', templateError);
        onStateUpdate(prev => ({
          ...prev,
          isLoading: false,
          errors: [templateError]
        }));
      }

      // Update refs
      prevTemplateIdRef.current = currentTemplateId;
      prevLoadingRef.current = templateLoading;
      prevErrorRef.current = templateError;
      prevDataHashRef.current = dataHash;
    }
  }, [
    templateData.template?.id, 
    templateLoading, 
    templateError, 
    onStateUpdate,
    templateData.stages.length,
    templateData.tasks.length,
    templateData.steps.length,
    templateData.elements.length
  ]);

  // Return an empty object since this hook only performs side effects
  return {};
}; 