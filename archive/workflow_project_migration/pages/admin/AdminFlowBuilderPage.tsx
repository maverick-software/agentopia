import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useAuth } from '@/contexts/AuthContext';
import { useTemplateLoader } from './flow-builder/hooks/useTemplateLoader';
import { useFlowBuilderState } from './flow-builder/hooks/useFlowBuilderState';
import { useElementManager } from './flow-builder/hooks/useElementManager';
import { useSaveManager } from './flow-builder/hooks/useSaveManager';
import { useStateSync } from './flow-builder/hooks/useStateSync';
import { useHandlers } from './flow-builder/hooks/useHandlers';
import { FlowBuilderHeader } from './flow-builder/components/FlowBuilderHeader';
import { ElementPaletteSidebar, ConfigurationPanelSidebar } from './flow-builder/components/FlowBuilderSidebar';
import { FlowBuilderCanvas } from './flow-builder/components/FlowBuilderCanvas';
import { StageCard } from './flow-builder/components/hierarchy/StageCard';
import { TaskCard } from './flow-builder/components/hierarchy/TaskCard';
import { StepCard } from './flow-builder/components/hierarchy/StepCard';
import { LoadingSpinner } from './flow-builder/components/LoadingSpinner';
import type { UnifiedWorkflowBuilderState } from './flow-builder/types';

// Performance monitoring for development
const useRenderCounter = (componentName: string) => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  // Disable performance monitoring to reduce re-renders
  // useEffect(() => {
  //   if (import.meta.env.DEV) {
  //     console.log(`${componentName} rendered ${renderCount.current} times`);
  //   }
  // });
  
  return renderCount.current;
};

// Create a wrapper component that includes both TaskCard and StepCard
const StageCardWithDependencies: React.FC<any> = (props) => (
  <StageCard {...props} TaskCard={TaskCard} StepCard={StepCard} />
);

const AdminFlowBuilderPage: React.FC = () => {
  // Performance monitoring
  const renderCount = useRenderCounter('AdminFlowBuilderPage');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { flowId } = useParams<{ flowId: string }>();
  const templateId = flowId; // For backward compatibility with existing logic

  // Use template loader hook (fixes blank state issue)
  const {
    templateData,
    isLoading: templateLoading,
    error: templateError,
    migrationMode,
    isUsingUnifiedService
  } = useTemplateLoader(templateId);

  // Only log when important state changes occur
  const prevTemplateIdRef = useRef<string | null>(null);
  const prevLoadingRef = useRef<boolean>(templateLoading);
  const prevPathnameRef = useRef<string>(location.pathname);
  
  useEffect(() => {
    const hasTemplateChanged = prevTemplateIdRef.current !== templateId;
    const hasLoadingChanged = prevLoadingRef.current !== templateLoading;
    const hasPathnameChanged = prevPathnameRef.current !== location.pathname;
    
    // Only log and update refs when significant changes occur
    if (hasTemplateChanged || hasLoadingChanged || hasPathnameChanged) {
      console.log('AdminFlowBuilderPage render:', {
        flowId,
        templateId,
        pathname: location.pathname,
        migrationMode,
        isUsingUnifiedService,
        templateLoading,
        hasTemplate: !!templateData.template,
        envVar: import.meta.env.VITE_USE_UNIFIED_WORKFLOW
      });
      
      prevTemplateIdRef.current = templateId;
      prevLoadingRef.current = templateLoading;
      prevPathnameRef.current = location.pathname;
    }
  }, [templateId, templateLoading, location.pathname]); // Removed volatile dependencies

  // Main component state (includes template data)
  const [state, setState] = useState<UnifiedWorkflowBuilderState>({
    template: null,
    stages: [],
    tasks: [],
    steps: [],
    elements: [],
    activeLevel: 'template',
    selectedItem: null,
    expandedItems: new Set(),
    isDirty: false,
    isLoading: true,
    errors: [],
    saveStatus: 'idle'
  });

  // Use state sync hook to manage template data synchronization
  useStateSync({
    templateData,
    templateLoading,
    templateError,
    onStateUpdate: setState
  });

  // Derived state
  const isNewTemplate = !templateId || templateId === 'new';
  const hookError = templateError;

  // UI state management hook (Phase 1.2 - gradual integration)
  const uiState = useFlowBuilderState();

  // Selection change handler
  const handleSelectionChange = useCallback((activeLevel: string, selectedItem: string | null) => {
    const selectionMap = {
      stage: () => uiState.selectStage(selectedItem || ''),
      task: () => uiState.selectTask(selectedItem || ''),
      step: () => uiState.selectStep(selectedItem || ''),
      element: () => uiState.selectElement(selectedItem || ''),
    };
    
    const handler = selectionMap[activeLevel as keyof typeof selectionMap];
    if (handler) {
      handler();
    } else {
      uiState.selectTemplate();
    }
  }, [uiState]);

  // Element management hook (Phase 1.3 - CRUD operations and drag/drop)
  const templateDataMemo = useMemo(() => ({
    template: state.template,
    stages: state.stages,
    tasks: state.tasks,
    steps: state.steps,
    elements: state.elements
  }), [state.template, state.stages, state.tasks, state.steps, state.elements]);

  const elementManager = useElementManager({
    templateData: templateDataMemo,
    isUsingUnifiedService,
    user,
    onStateUpdate: (updates) => {
      setState(prev => ({ ...prev, ...updates }));
    },
    onSelectionChange: handleSelectionChange,
    onMarkDirty: uiState.markDirty,
    onExpandStage: uiState.expandStage
  });

  // Save management hook (Phase 2.5 - save logic extraction)
  const saveManager = useSaveManager({
    user,
    isUsingUnifiedService,
    onSaveStatusChange: uiState.setSaveStatus,
    onStateUpdate: (updates) => {
      setState(prev => ({ ...prev, ...updates }));
    }
  });

  // All handlers consolidated into useHandlers hook
  const handlers = useHandlers({
    elementManager,
    uiState,
    saveManager,
    state,
    isNewTemplate,
    onStateUpdate: (updates) => {
      setState(prev => ({ ...prev, ...updates }));
    }
  });

  if (state.isLoading) {
    return <LoadingSpinner migrationMode={migrationMode} />;
  }

  return (
    <DndContext onDragStart={handlers.handleDragStart} onDragEnd={handlers.handleDragEnd}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <FlowBuilderHeader
          templateName={state.template?.name || null}
          templateDescription={state.template?.description || null}
          isNewTemplate={isNewTemplate}
          isDirty={uiState.isDirty}
          saveStatus={uiState.saveStatus}
          migrationMode={migrationMode}
          isUsingUnifiedService={isUsingUnifiedService}
          isTemplateSelected={uiState.activeLevel === 'template'}
          onSave={handlers.handleSave}
          onCancel={handlers.handleCancel}
          onSelectTemplate={handlers.selectTemplate}
        />

        {/* Error display */}
        {(state.errors.length > 0 || hookError) && (
          <div className="p-4 bg-destructive/10 border-b border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {state.errors.length > 0 ? state.errors[0] : hookError}
              </span>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex h-[calc(100vh-3.5rem)]">
          <ElementPaletteSidebar
            activeLevel={uiState.activeLevel}
          />

          <FlowBuilderCanvas
            template={state.template}
            stages={state.stages}
            tasks={state.tasks}
            steps={state.steps}
            elements={state.elements}
            activeLevel={uiState.activeLevel}
            selectedItem={uiState.selectedItem}
            expandedItems={uiState.expandedItems}
            onSelectStage={handlers.selectStage}
            onSelectTask={handlers.selectTask}
            onSelectStep={handlers.selectStep}
            onSelectElement={handlers.selectElement}
            onToggleStageExpansion={handlers.toggleStageExpansion}
            onToggleTaskExpansion={handlers.toggleTaskExpansion}
            onAddStage={handlers.addStage}
            onAddTask={handlers.addTask}
            onAddStep={handlers.addStep}
            onStageUpdate={handlers.onStageUpdate}
            onTaskUpdate={handlers.onTaskUpdate}
            onStepUpdate={handlers.onStepUpdate}
            onStageDelete={handlers.onStageDelete}
            onTaskDelete={handlers.onTaskDelete}
            onStepDelete={handlers.onStepDelete}
            CollapsibleStageCard={StageCardWithDependencies}
          />

          <ConfigurationPanelSidebar
            selectedItem={uiState.selectedItem}
            selectedLevel={uiState.activeLevel}
            elements={state.elements}
            onElementUpdate={(updates) => {
              // TODO: Implement element update
              setState(prev => ({ ...prev, isDirty: true }));
            }}
            onElementDelete={() => {
              if (uiState.selectedItem && uiState.activeLevel === 'element') {
                handlers.onElementDelete(uiState.selectedItem);
              }
            }}
            onMarkDirty={uiState.markDirty}
          />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {elementManager.activeId ? (
            <div className="bg-background border rounded-lg p-2 shadow-lg">
              Dragging: {elementManager.activeId}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default AdminFlowBuilderPage; 