import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart3, Paperclip } from 'lucide-react';
import { ArtifactCard } from '../ArtifactCard';
import { ToolUserInputCard } from '../ToolUserInputCard';
import { MessageAudioButton } from '@/components/voice/MessageAudioButton';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';
import type { Artifact } from '@/types/artifacts';
import type { Agent } from './types';

const formatMessageTimestamp = (timestamp: unknown): string => {
  if (!timestamp) return '';
  let date: Date;
  if (timestamp instanceof Date) date = timestamp;
  else if (typeof timestamp === 'string' || typeof timestamp === 'number') date = new Date(timestamp);
  else return '';
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const messageKey = (message: Message, index: number): string => {
  try {
    if (message.timestamp instanceof Date) return `${message.role}-${index}-${message.timestamp.toISOString()}`;
    if (typeof message.timestamp === 'string' || typeof message.timestamp === 'number') {
      return `${message.role}-${index}-${String(message.timestamp)}`;
    }
  } catch {
    // keep fallback key behavior
  }
  return `${message.role}-${index}-${index}`;
};

type PlanStep = { step?: string; title?: string; status?: 'pending' | 'in_progress' | 'completed' };

const extractPlanBlock = (content: string): { text: string; plan: { explanation?: string; plan: PlanStep[] } | null } => {
  const match = content.match(/\n?:::plan\n([\s\S]*?)\n:::\n?/);
  if (!match) return { text: content, plan: null };

  try {
    const parsed = JSON.parse(match[1]);
    const plan = Array.isArray(parsed.plan) ? parsed.plan : Array.isArray(parsed.steps) ? parsed.steps : [];
    return {
      text: content.replace(match[0], '').trim(),
      plan: { explanation: parsed.explanation || parsed.goal, plan },
    };
  } catch {
    return { text: content, plan: null };
  }
};

const PlanCard: React.FC<{ plan: { explanation?: string; plan: PlanStep[] } }> = ({ plan }) => {
  const completed = plan.plan.filter((step) => step.status === 'completed').length;
  const total = plan.plan.length;
  return (
    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">Agent Plan</div>
        <div className="text-xs text-muted-foreground">{completed}/{total} complete</div>
      </div>
      {plan.explanation && <div className="mb-3 text-xs text-muted-foreground">{plan.explanation}</div>}
      <div className="space-y-2">
        {plan.plan.map((step, idx) => {
          const status = step.status || 'pending';
          const marker = status === 'completed' ? '✓' : status === 'in_progress' ? '•' : '○';
          return (
            <div key={`${step.step || step.title || idx}-${idx}`} className="flex items-start gap-2 text-sm">
              <span className={status === 'completed' ? 'text-green-600' : status === 'in_progress' ? 'text-primary' : 'text-muted-foreground'}>
                {marker}
              </span>
              <span className={status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}>
                {step.step || step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AssistantMarkdown: React.FC<{ content: string; formatMarkdown: (content: string) => string }> = ({
  content,
  formatMarkdown,
}) => (
  <div
    className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere
      prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
      prose-p:my-3 prose-p:leading-7 prose-p:break-words prose-p:overflow-wrap-anywhere
      prose-ul:my-3 prose-ul:pl-6 prose-ul:list-disc prose-ul:space-y-2
      prose-ol:my-3 prose-ol:pl-6 prose-ol:list-decimal prose-ol:space-y-2
      prose-li:my-1 prose-li:leading-7 prose-li:break-words prose-li:overflow-wrap-anywhere
      prose-pre:my-4 prose-pre:p-4 prose-pre:bg-muted prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:break-all prose-pre:whitespace-pre-wrap
      prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:break-words
      prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-4
      prose-strong:font-semibold prose-strong:text-foreground
      prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:break-words
      prose-hr:my-6 prose-hr:border-muted-foreground/30
      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }: any) => (
          <p className="my-3 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</p>
        ),
        ul: ({ children }: any) => <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>,
        ol: ({ children }: any) => <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>,
        li: ({ children }: any) => (
          <li className="my-1 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</li>
        ),
        h1: ({ children }: any) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
        h2: ({ children }: any) => <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>,
        h3: ({ children }: any) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
        code: ({ inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <pre className="my-4 p-4 bg-muted rounded-lg overflow-x-auto max-w-full">
              <code className={`text-sm font-mono break-all whitespace-pre-wrap ${className}`} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono break-all" {...props}>
              {children}
            </code>
          );
        },
        a: ({ href, children }: any) => (
          <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="my-6 border-muted-foreground/30" />,
      }}
    >
      {formatMarkdown(content)}
    </ReactMarkdown>
  </div>
);

interface MessageItemProps {
  message: Message;
  index: number;
  user: any;
  agent: Agent | null;
  resolvedAvatarUrl: string | null;
  formatMarkdown: (content: string) => string;
  getArtifactsFromMessage: (message: Message) => Artifact[];
  handleOpenCanvas: (artifact: Artifact) => Promise<void>;
  downloadArtifact: (artifact: Artifact) => Promise<void>;
  onShowProcessModal?: (messageDetails?: any) => void;
  onShowDebugModal?: (processingDetails: any) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  index,
  user,
  agent,
  resolvedAvatarUrl,
  formatMarkdown,
  getArtifactsFromMessage,
  handleOpenCanvas,
  downloadArtifact,
  onShowProcessModal,
  onShowDebugModal,
}) => {
  const artifacts = getArtifactsFromMessage(message);
  const assistantPlan = message.role === 'assistant' ? extractPlanBlock(message.content) : null;
  const runtime = message.metadata?.agent_runtime || message.metadata?.processingDetails?.agent_runtime;

  return (
    <div
      key={messageKey(message, index)}
      className={`flex items-start space-x-4 animate-fade-in max-w-full ${
        message.role === 'user' ? 'flex-row-reverse space-x-reverse !mb-10' : '!mt-10'
      }`}
    >
      <div className="flex-shrink-0">
        {message.role === 'user' ? (
          <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">{user?.email?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
        ) : (
          <>
            {resolvedAvatarUrl ? (
              <img
                src={resolvedAvatarUrl}
                alt={agent?.name || 'Agent'}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  console.warn('Message avatar failed to load:', resolvedAvatarUrl);
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
              style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
            >
              <span className="text-white text-sm font-medium">{agent?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          </>
        )}
      </div>

      <div className={`flex-1 min-w-0 max-w-[70%] overflow-hidden ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
        <div className={`mb-1 flex items-center space-x-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <span className="text-sm font-medium text-foreground">{message.role === 'user' ? 'You' : agent?.name || 'Assistant'}</span>

          {message.role === 'assistant' && onShowProcessModal && (
            <button
              onClick={() => onShowProcessModal(message.metadata || {})}
              className="flex items-center space-x-1 px-2 py-1 bg-muted/50 hover:bg-muted rounded-md transition-colors"
              title="View processing details"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Process</span>
            </button>
          )}

          {message.role === 'assistant' && message.metadata?.processingDetails && onShowDebugModal && (
            <button
              onClick={() => onShowDebugModal(message.metadata?.processingDetails)}
              className="flex items-center space-x-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
              title="View LLM requests and responses"
            >
              <svg className="h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-xs font-medium text-purple-500">Debug</span>
            </button>
          )}

          {message.role === 'assistant' && runtime?.liveness && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {runtime.liveness}
            </span>
          )}

          <span className="text-xs text-muted-foreground">{formatMessageTimestamp(message.timestamp)}</span>
        </div>

        <div
          className={`text-left break-words overflow-wrap-anywhere ${
            message.role === 'user' ? 'bg-[#343541] text-white px-4 py-2.5 rounded-2xl inline-block max-w-full' : 'text-foreground w-full'
          }`}
        >
          {message.role === 'assistant' ? (
            <>
              {assistantPlan?.plan && <PlanCard plan={assistantPlan.plan} />}
              <AssistantMarkdown content={assistantPlan?.text ?? message.content} formatMarkdown={formatMarkdown} />

              {artifacts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {artifacts.map((artifact) => (
                    <ArtifactCard
                      key={artifact.id}
                      artifact={artifact}
                      onOpenCanvas={handleOpenCanvas}
                      onDownload={downloadArtifact}
                    />
                  ))}
                </div>
              )}

              {message.metadata?.requires_user_input && message.metadata?.user_input_request && (
                <div className="mt-4">
                  {message.metadata.user_input_request.approval_id ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="text-sm font-medium">Tool approval required</div>
                      <div className="mt-1 text-xs text-muted-foreground">{message.metadata.user_input_request.reason}</div>
                      <div className="mt-3 flex gap-2">
                        {(['approved', 'denied'] as const).map((decision) => (
                          <button
                            key={decision}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                            onClick={async () => {
                              await supabase.functions.invoke('agent-runtime-approval', {
                                body: {
                                  approval_id: message.metadata.user_input_request.approval_id,
                                  decision,
                                },
                              });
                              window.dispatchEvent(new CustomEvent('agent-runtime-approval-resolved', {
                                detail: { approvalId: message.metadata.user_input_request.approval_id, decision },
                              }));
                            }}
                          >
                            {decision === 'approved' ? 'Approve' : 'Deny'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ToolUserInputCard
                      request={{
                        id: message.id || '',
                        tool_name: message.metadata.user_input_request.tool_name,
                        tool_call_id: message.metadata.tool_call_id || `tool_${Date.now()}`,
                        reason: message.metadata.user_input_request.reason,
                        required_fields: message.metadata.user_input_request.required_fields,
                        status: 'pending',
                      }}
                      onSubmit={async (toolCallId: string, inputs: Record<string, any>) => {
                        await supabase.functions.invoke('tool-user-input', {
                          body: { action: 'submit_response', tool_call_id: toolCallId, user_inputs: inputs },
                        });
                        window.dispatchEvent(new CustomEvent('user-input-submitted', { detail: { toolCallId, inputs } }));
                      }}
                      onCancel={(toolCallId: string) => {
                        console.log('[ToolUserInput] User cancelled input request:', toolCallId);
                      }}
                    />
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-start gap-2">
                <button
                  onClick={(e) => {
                    navigator.clipboard.writeText(message.content);
                    const button = e.currentTarget;
                    const icon = button.querySelector('svg');
                    if (!icon) return;
                    icon.innerHTML = '<path d="M20 6L9 17l-5-5"></path>';
                    button.classList.add('text-green-500');
                    setTimeout(() => {
                      icon.innerHTML =
                        '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
                      button.classList.remove('text-green-500');
                    }, 2000);
                  }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                  title="Copy message"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <MessageAudioButton text={message.content} className="!opacity-100 hover:bg-muted/50 p-1.5 rounded-md" />
              </div>
            </>
          ) : (
            <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
              {message.role === 'user' && message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {message.metadata.attachments.map((attachment: any, idx: number) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-md text-xs"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span className="font-medium truncate max-w-[120px]" title={attachment.name}>
                        {attachment.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="w-full">
                <span className="break-words overflow-wrap-anywhere">{message.content}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
