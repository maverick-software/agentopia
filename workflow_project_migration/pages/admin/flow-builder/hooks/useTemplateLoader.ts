import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useUnifiedWorkflow } from '@/hooks/useUnifiedWorkflow';
import type { 
  UnifiedWorkflowTemplate, 
  UnifiedWorkflowStage, 
  UnifiedWorkflowTask, 
  UnifiedWorkflowStep, 
  UnifiedWorkflowElement 
} from '@/types/unified-workflow';

// Session storage key for tracking loaded templates
const LOADED_TEMPLATES_KEY = 'adminFlowBuilder_loadedTemplates';

interface TemplateData {
  template: UnifiedWorkflowTemplate | null;
  stages: UnifiedWorkflowStage[];
  tasks: UnifiedWorkflowTask[];
  steps: UnifiedWorkflowStep[];
  elements: UnifiedWorkflowElement[];
}

interface UseTemplateLoaderReturn {
  templateData: TemplateData;
  isLoading: boolean;
  error: string | null;
  migrationMode: 'unified' | 'compatibility';
  isUsingUnifiedService: boolean;
  loadTemplate: (templateId: string, skipLoadingState?: boolean) => Promise<void>;
  initializeNewTemplate: () => void;
  clearTemplateCache: () => void;
}

export const useTemplateLoader = (templateId?: string): UseTemplateLoaderReturn => {
  const location = useLocation();
  
  // Determine mode based on URL structure
  const isEditMode = location.pathname.includes('/edit') && templateId !== 'new';
  const isNewTemplate = templateId === 'new' || location.pathname.includes('/new');

  // Use unified workflow hook
  const {
    getTemplate,
    error: hookError,
    isUsingUnifiedService,
    migrationMode
  } = useUnifiedWorkflow({ autoFetch: false });

  // Template data state
  const [templateData, setTemplateData] = useState<TemplateData>({
    template: null,
    stages: [],
    tasks: [],
    steps: [],
    elements: []
  });

  // Loading and error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Utility function to clear template cache
  const clearTemplateCache = useCallback(() => {
    console.log('useTemplateLoader: Clearing template cache');
    sessionStorage.removeItem(LOADED_TEMPLATES_KEY);
    setError(null);
  }, []);

  // Load template data for editing - stabilized with useCallback
  const loadTemplate = useCallback(async (id: string, skipLoadingState = false) => {
    console.log('useTemplateLoader: loadTemplate called', { id, skipLoadingState });
    
    if (!skipLoadingState) {
      setIsLoading(true);
      setError(null);
    }
    
    try {
      console.log('useTemplateLoader: Calling getTemplate with ID:', id);
      const template = await getTemplate(id);
      console.log('useTemplateLoader: getTemplate result:', {
        hasTemplate: !!template,
        templateName: template?.name,
        stagesCount: template?.unified_workflow_stages?.length || 0
      });
      
      if (template) {
        const flattenedData = {
          template,
          stages: template.unified_workflow_stages || [],
          tasks: template.unified_workflow_stages?.flatMap(stage => 
            stage.unified_workflow_tasks || []
          ) || [],
          steps: template.unified_workflow_stages?.flatMap(stage => 
            stage.unified_workflow_tasks?.flatMap(task => 
              task.unified_workflow_steps || []
            ) || []
          ) || [],
          elements: template.unified_workflow_stages?.flatMap(stage => 
            stage.unified_workflow_tasks?.flatMap(task => 
              task.unified_workflow_steps?.flatMap(step => 
                step.unified_workflow_elements || []
              ) || []
            ) || []
          ) || []
        };
        
        console.log('useTemplateLoader: Setting flattened template data', {
          templateName: flattenedData.template.name,
          stagesCount: flattenedData.stages.length,
          tasksCount: flattenedData.tasks.length,
          stepsCount: flattenedData.steps.length,
          elementsCount: flattenedData.elements.length
        });
        
        setTemplateData(flattenedData);
        setError(null); // Clear any previous errors
        
        // Only mark as loaded in cache after successful load
        const loadedTemplates = JSON.parse(sessionStorage.getItem(LOADED_TEMPLATES_KEY) || '{}');
        loadedTemplates[id] = true;
        sessionStorage.setItem(LOADED_TEMPLATES_KEY, JSON.stringify(loadedTemplates));
      } else {
        console.log('useTemplateLoader: Template not found');
        const errorMsg = `Template with ID ${id} not found.`;
        setError(errorMsg);
        
        // Remove from cache if it was marked as loaded
        const loadedTemplates = JSON.parse(sessionStorage.getItem(LOADED_TEMPLATES_KEY) || '{}');
        delete loadedTemplates[id];
        sessionStorage.setItem(LOADED_TEMPLATES_KEY, JSON.stringify(loadedTemplates));
      }
    } catch (err: any) {
      console.error('useTemplateLoader: Error loading template:', err);
      const errorMsg = err.message || 'Failed to load template';
      setError(errorMsg);
      
      // Remove from cache if it was marked as loaded
      const loadedTemplates = JSON.parse(sessionStorage.getItem(LOADED_TEMPLATES_KEY) || '{}');
      delete loadedTemplates[id];
      sessionStorage.setItem(LOADED_TEMPLATES_KEY, JSON.stringify(loadedTemplates));
    } finally {
      console.log('useTemplateLoader: Setting loading to false');
      setIsLoading(false);
    }
  }, [getTemplate]);

  // Initialize new template
  const initializeNewTemplate = useCallback(() => {
    setTemplateData({
      template: {
        id: 'new',
        name: 'New Workflow Template',
        description: '',
        template_type: 'flow_based',
        category: undefined,
        icon: undefined,
        color: undefined,
        client_visible: true,
        requires_products_services: false,
        auto_create_project: true,
        estimated_duration_minutes: undefined,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: '',
        is_active: true,
        is_published: false,
        version: 1
      } as UnifiedWorkflowTemplate,
      stages: [],
      tasks: [],
      steps: [],
      elements: []
    });
    setIsLoading(false);
    setError(null);
    
    // Mark new template as loaded in cache
    const loadedTemplates = JSON.parse(sessionStorage.getItem(LOADED_TEMPLATES_KEY) || '{}');
    loadedTemplates['new'] = true;
    sessionStorage.setItem(LOADED_TEMPLATES_KEY, JSON.stringify(loadedTemplates));
  }, []);

  // Load template data when route parameters change
  useEffect(() => {
    if (!templateId) return;

    const cacheKey = templateId || 'new';
    
    // Check if template is already loaded using sessionStorage
    const loadedTemplates = JSON.parse(sessionStorage.getItem(LOADED_TEMPLATES_KEY) || '{}');
    const isAlreadyLoaded = loadedTemplates[cacheKey] === true;
    
    // Check if we already have the template data loaded
    const hasTemplateData = templateData.template && templateData.template.id === templateId;
    
    console.log('useTemplateLoader: useEffect triggered', {
      templateId,
      isEditMode,
      isNewTemplate,
      cacheKey,
      isAlreadyLoaded,
      hasTemplateData,
      pathname: location.pathname,
      currentError: error
    });

    // Skip if we already have the data loaded and no errors
    if (hasTemplateData && !isLoading && !error) {
      console.log('Template data already loaded successfully, skipping reload');
      return;
    }

    // Skip if already loaded in cache and we have valid data
    if (isAlreadyLoaded && hasTemplateData && !error) {
      console.log('Template already loaded (from sessionStorage), skipping reload');
      return;
    }

    if (templateId && isEditMode && templateId !== 'new') {
      console.log('Loading existing template for edit mode');
      loadTemplate(templateId, false);
    } else if (isNewTemplate || templateId === 'new') {
      if (isAlreadyLoaded && templateData.template?.id === 'new' && !error) {
        console.log('New template already initialized, skipping reload');
        return;
      } else {
        console.log('Initializing new template');
        initializeNewTemplate();
      }
    }
  }, [templateId, isEditMode, isNewTemplate, loadTemplate, initializeNewTemplate]); // Added stable dependencies

  return {
    templateData,
    isLoading,
    error: error || hookError || null,
    migrationMode,
    isUsingUnifiedService,
    loadTemplate,
    initializeNewTemplate,
    clearTemplateCache
  };
}; 