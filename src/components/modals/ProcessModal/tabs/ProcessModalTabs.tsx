import React from 'react';
import { X } from 'lucide-react';
import type { ProcessModalProps } from '../types';
import { useProcessModalData } from '../hooks/useProcessModalData';
import { ReasoningThresholdControls } from '../components/ReasoningThresholdControls';
import { MemoryOperationsCard } from '../components/MemoryOperationsCard';
import { ContextOperationsCard } from '../components/ContextOperationsCard';
import { ToolOperationsCard } from '../components/ToolOperationsCard';
import { ReasoningChainCard } from '../components/ReasoningChainCard';
import { ChatHistoryCard } from '../components/ChatHistoryCard';
import { PerformanceMetricsCard } from '../components/PerformanceMetricsCard';
import { StepDetailsModal } from '../components/StepDetailsModal';

export function ProcessModalTabs({ isOpen, onClose, processingDetails }: ProcessModalProps) {
  const state = useProcessModalData(isOpen, processingDetails);
  const [showStepModal, setShowStepModal] = React.useState(false);
  const [selectedStep, setSelectedStep] = React.useState<any | null>(null);

  if (!isOpen || !processingDetails) return null;

  const actualDetails = processingDetails.processingDetails || processingDetails;
  const {
    memory_operations,
    tool_operations,
    reasoning_chain,
    chat_history,
    performance,
    reasoning,
    discovered_tools,
  } = actualDetails;
  const reasoningGraph = actualDetails?.reasoning_graph as { states?: string[] } | undefined;
  const displaySummaryInfo = state.localSummaryInfo || processingDetails?.summary_info;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <h2 className="text-xl font-semibold text-foreground">Processing Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] bg-background">
          {reasoning && (
            <div className="mb-4 bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-foreground">
                  <span className="font-medium">Reasoning:</span> {reasoning.type || 'none'}
                  <span className="ml-3 font-medium">Score:</span> {((reasoning.score || 0) * 100).toFixed(1)}%
                </div>
                {reasoning.reason && <div className="text-xs text-muted-foreground">{reasoning.reason}</div>}
              </div>
              <ReasoningThresholdControls
                currentScore={reasoning.score || 0}
                isEnabled={Boolean(reasoning?.enabled || reasoning_chain?.length)}
                agentId={processingDetails?.agent_id}
                onThresholdChange={() => {}}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MemoryOperationsCard memoryOperations={memory_operations} />
            <ContextOperationsCard
              processingDetails={processingDetails}
              displaySummaryInfo={displaySummaryInfo}
              localRecentMessages={state.localRecentMessages}
              isGenerating={state.isGenerating}
              generationStatus={state.generationStatus}
              generationMessage={state.generationMessage}
              setIsGenerating={state.setIsGenerating}
              setGenerationStatus={state.setGenerationStatus}
              setGenerationMessage={state.setGenerationMessage}
              onContextUpdated={(summaryInfo, recentMessages) => {
                state.setLocalSummaryInfo(summaryInfo);
                state.setLocalRecentMessages(recentMessages);
              }}
            />
            <ToolOperationsCard discoveredTools={discovered_tools || []} toolOperations={tool_operations || []} />
            <ReasoningChainCard
              reasoningChain={reasoning_chain || []}
              reasoningGraph={reasoningGraph}
              onSelectStep={(step) => {
                setSelectedStep(step);
                setShowStepModal(true);
              }}
            />
            <ChatHistoryCard chatHistory={chat_history} />
            <PerformanceMetricsCard performance={performance} />
          </div>
        </div>
      </div>
      <StepDetailsModal isOpen={showStepModal} selectedStep={selectedStep} onClose={() => setShowStepModal(false)} />
    </div>
  );
}
