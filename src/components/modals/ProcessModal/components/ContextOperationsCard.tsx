import React from 'react';
import { Brain, CheckCircle, Database, RotateCcw, XCircle } from 'lucide-react';
import { generateConversationContext } from '../hooks/useProcessModalData';
import { RecentMessagesSection } from './RecentMessagesSection';

interface ContextOperationsCardProps {
  processingDetails: any;
  displaySummaryInfo: any;
  localRecentMessages: any[];
  isGenerating: boolean;
  generationStatus: 'idle' | 'success' | 'error';
  generationMessage: string;
  setIsGenerating: (value: boolean) => void;
  setGenerationStatus: (value: 'idle' | 'success' | 'error') => void;
  setGenerationMessage: (value: string) => void;
  onContextUpdated: (summaryInfo: any, recentMessages: any[]) => void;
}

export const ContextOperationsCard: React.FC<ContextOperationsCardProps> = ({
  processingDetails,
  displaySummaryInfo,
  localRecentMessages,
  isGenerating,
  generationStatus,
  generationMessage,
  setIsGenerating,
  setGenerationStatus,
  setGenerationMessage,
  onContextUpdated,
}) => {
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStatus('idle');
    setGenerationMessage('');
    try {
      await generateConversationContext({
        processingDetails,
        onSuccess: onContextUpdated,
      });
      setGenerationStatus('success');
      setGenerationMessage('Context generated successfully!');
    } catch (error: any) {
      setGenerationStatus('error');
      setGenerationMessage(error.message || 'Failed to generate context');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Context Operations</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`px-3 py-1.5 text-xs rounded transition-all flex items-center gap-2 ${
            isGenerating
              ? 'bg-primary/50 text-primary-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isGenerating ? (
            <>
              <RotateCcw className="h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="h-3 w-3" />
              Generate Context
            </>
          )}
        </button>
      </div>

      <div className="space-y-3 text-sm text-muted-foreground">
        {generationStatus !== 'idle' && (
          <div
            className={`px-3 py-2 rounded text-xs flex items-center gap-2 ${
              generationStatus === 'success'
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : 'bg-red-500/10 text-red-600 border border-red-500/20'
            }`}
          >
            {generationStatus === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span className="font-medium">{generationMessage}</span>
          </div>
        )}

        <div>
          {displaySummaryInfo ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-foreground">Status: Active</span>
              </div>
              <div className="text-muted-foreground leading-relaxed">
                <span className="font-medium">Summary:</span> {displaySummaryInfo.summary}
              </div>
              <div className="flex gap-4 text-muted-foreground pt-1">
                <span>{displaySummaryInfo.facts_count} facts</span>
                <span>{displaySummaryInfo.action_items_count} action items</span>
                <span>{displaySummaryInfo.message_count} messages summarized</span>
              </div>
              {displaySummaryInfo.pending_questions_count > 0 && (
                <div className="text-muted-foreground">
                  <span className="font-medium">Pending Questions:</span>{' '}
                  {displaySummaryInfo.pending_questions_count}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Summary will be created after 5 messages</div>
          )}
        </div>

        <RecentMessagesSection messages={localRecentMessages} />
      </div>
    </div>
  );
};
