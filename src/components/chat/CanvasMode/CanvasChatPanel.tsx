import { useEffect, useRef } from 'react';
import { Code, Paperclip, Send, Sliders, X as CloseIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { InlineThinkingIndicator } from '../../InlineThinkingIndicator';
import { CanvasChatPanelProps } from './types';

function formatMessageTime(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CanvasChatPanel({
  localMessages,
  userInitial,
  agentName,
  resolvedAvatarUrl,
  canvasInput,
  selectedContexts,
  thinkingMessageIndex,
  aiState,
  currentTool,
  processSteps,
  onInputChange,
  onSend,
  onRemoveContext,
  onClearContexts,
}: CanvasChatPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const scrollHeight = textareaRef.current.scrollHeight;
    const maxHeight = 200;
    textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [canvasInput]);

  return (
    <div className="h-full bg-background border-r border-border flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-4">
          {localMessages.length > 0 ? localMessages.map((message: any, index: number) => {
            if (message.role === 'thinking') {
              const isCurrentThinking = index === thinkingMessageIndex && !message.metadata?.isCompleted;
              if (!isCurrentThinking) return null;
              return (
                <InlineThinkingIndicator
                  key={`thinking-${index}`}
                  isVisible
                  currentState={aiState}
                  currentTool={currentTool}
                  processSteps={processSteps?.map((step: any) => ({ ...step }))}
                />
              );
            }

            return (
              <div key={index} className={`flex items-start space-x-4 animate-fade-in max-w-full ${message.role === 'user' ? 'flex-row-reverse space-x-reverse !mb-10' : '!mt-10'}`}>
                <div className="flex-shrink-0">
                  {message.role === 'user' ? (
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">{userInitial}</span>
                    </div>
                  ) : (
                    <>
                      {resolvedAvatarUrl ? (
                        <img
                          src={resolvedAvatarUrl}
                          alt={agentName}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center" style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}>
                        <span className="text-white text-sm font-medium">{agentName.charAt(0).toUpperCase()}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className={`flex-1 min-w-0 max-w-[70%] overflow-hidden ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`mb-1 flex items-center space-x-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-sm font-medium text-foreground">{message.role === 'user' ? 'You' : agentName}</span>
                    <span className="text-xs text-muted-foreground">{formatMessageTime(message.timestamp)}</span>
                  </div>
                  <div className={message.role === 'assistant' ? 'text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words' : 'bg-[#343541] text-white rounded-2xl inline-block max-w-full text-left overflow-hidden px-4 py-2.5'}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-sm mb-2">Continue the conversation</p>
              <p className="text-xs">Ask the agent to make changes to the document</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-4">
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="relative">
          {selectedContexts.length > 0 && (
            <div className="mb-2 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground font-medium">{selectedContexts.length} selection{selectedContexts.length > 1 ? 's' : ''} ({selectedContexts.length}/5)</span>
                <button type="button" onClick={onClearContexts} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear all</button>
              </div>
              {selectedContexts.map((context, idx) => (
                <div key={context.id} className="bg-muted/40 border border-border/50 rounded-md px-2.5 py-1.5 flex items-center gap-2">
                  <Code className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">{idx + 1}. {context.lines}</span>
                    <span className="text-xs text-muted-foreground/70 truncate">{context.text.split('\n')[0]}{context.text.split('\n').length > 1 && '...'}</span>
                  </div>
                  <button type="button" onClick={() => onRemoveContext(context.id)} className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors">
                    <CloseIcon className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/40 focus-within:shadow-md">
            <div className="px-4 py-3">
              <textarea
                ref={textareaRef}
                value={canvasInput}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Ask to edit the document..."
                rows={1}
                className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/60 border-0 outline-none text-[15px] leading-relaxed scrollbar-thin"
                style={{ minHeight: '24px', maxHeight: '200px', overflowY: 'hidden' }}
              />
            </div>
            <div className="flex items-center justify-between px-3 pb-2 pt-0 border-t border-border/20">
              <div className="flex items-center space-x-1">
                <button type="button" onClick={() => toast.info('File attachment coming soon in Canvas mode')} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => toast.info('Canvas settings coming soon')} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors" title="Canvas Settings">
                  <Sliders className="w-4 h-4" />
                </button>
              </div>
              <button type="submit" disabled={!canvasInput.trim()} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1" title="Send message">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
