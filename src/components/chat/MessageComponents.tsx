import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart3, Brain, ChevronRight, FileText, Paperclip } from 'lucide-react';
import { InlineThinkingIndicator } from '../InlineThinkingIndicator';
import type { Message } from '../../types';
import type { Database } from '../../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

interface MessageListProps {
  messages: Message[];
  agent: Agent | null;
  user: any;
  thinkingMessageIndex: number | null;
  formatMarkdown: (content: string) => string;
  currentProcessingDetails?: any;
  onShowProcessModal?: () => void;
  aiState?: any;
  currentTool?: any;
  processSteps?: any[];
}

export function MessageList({ messages, agent, user, thinkingMessageIndex, formatMarkdown, currentProcessingDetails, onShowProcessModal, aiState, currentTool, processSteps }: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((message, index) => {
        // Handle thinking messages with inline indicator
        if (message.role === 'thinking') {
          const isCurrentThinking = index === thinkingMessageIndex && !message.metadata?.isCompleted;
          if (!isCurrentThinking) {
            return null; // Hide completed thinking messages
          }
          return (
            <InlineThinkingIndicator
              key={`thinking-${index}`}
              isVisible={true}
              currentState={aiState}
              currentTool={currentTool}
              processSteps={processSteps?.map(step => ({
                state: step.state,
                label: step.label,
                duration: step.duration,
                details: step.details,
                completed: step.completed,
                toolInfo: step.toolInfo
              })) || []}
              agentName={agent?.name || 'Agent'}
              agentAvatarUrl={agent?.avatar_url}
              isCompleted={false}
              className="mb-4"
            />
          );
        }

        // Handle regular messages
        return (
          <div
            key={`${message.role}-${index}-${(() => {
              try {
                if (message.timestamp instanceof Date) {
                  return message.timestamp.toISOString();
                } else if (typeof message.timestamp === 'string' || typeof message.timestamp === 'number') {
                  return String(message.timestamp);
                }
                return index;
              } catch {
                return index;
              }
            })()}`}
            className={`flex items-start space-x-4 animate-fade-in max-w-full ${
              message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {message.role === 'user' ? (
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              ) : (
                <>
                  {agent?.avatar_url ? (
                    <img 
                      src={agent.avatar_url} 
                      alt={agent.name || 'Agent'}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        console.warn('Message avatar failed to load:', agent.avatar_url);
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                    style={{ display: agent?.avatar_url ? 'none' : 'flex' }}
                  >
                    <span className="text-white text-sm font-medium">
                      {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Message Content */}
            <div className={`flex-1 min-w-0 max-w-[70%] overflow-hidden ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}>
              <div className={`mb-1 flex items-center space-x-2 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                <span className="text-sm font-medium text-foreground">
                  {message.role === 'user' ? 'You' : (agent?.name || 'Assistant')}
                </span>
                
                {/* Thoughts and Process buttons for assistant messages */}
                {message.role === 'assistant' && (
                  <div className="flex items-center space-x-2">
                    {/* Thoughts Dropdown */}
                    <details className="group">
                      <summary className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors">
                        <Brain className="h-3 w-3 text-muted-foreground group-open:text-purple-500" />
                        <span className="text-xs text-muted-foreground group-open:text-foreground">
                          Thoughts
                        </span>
                        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="absolute z-50 mt-1 p-3 bg-popover border border-border rounded-lg shadow-lg min-w-80 max-w-96">
                        <div className="text-xs text-muted-foreground">
                          Thinking process details would appear here...
                        </div>
                      </div>
                    </details>
                    
                    {/* Process Button */}
                    {currentProcessingDetails && onShowProcessModal && (
                      <button
                        onClick={onShowProcessModal}
                        className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors"
                        title="View detailed processing information"
                      >
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Process</span>
                      </button>
                    )}
                  </div>
                )}
                
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    const timestamp = message.timestamp;
                    if (!timestamp) return '';
                    
                    // Handle different timestamp formats
                    let date: Date;
                    if (timestamp instanceof Date) {
                      date = timestamp;
                    } else if (typeof timestamp === 'string') {
                      date = new Date(timestamp);
                    } else if (typeof timestamp === 'number') {
                      date = new Date(timestamp);
                    } else {
                      return '';
                    }
                    
                    // Check if date is valid
                    if (isNaN(date.getTime())) {
                      return '';
                    }
                    
                    return date.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  })()}
                </span>
              </div>
            <div className={`block w-full p-3 rounded-2xl shadow-sm text-left break-words overflow-wrap-anywhere ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-card text-card-foreground'
              }`}>
                {message.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere
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
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom paragraph renderer to ensure spacing and proper word breaking
                        p: ({children}: any) => (
                          <p className="my-3 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</p>
                        ),
                        // Custom list renderers
                        ul: ({children}: any) => (
                          <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>
                        ),
                        ol: ({children}: any) => (
                          <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>
                        ),
                        li: ({children}: any) => (
                          <li className="my-1 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</li>
                        ),
                        // Headers with spacing
                        h1: ({children}: any) => (
                          <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>
                        ),
                        h2: ({children}: any) => (
                          <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
                        ),
                        h3: ({children}: any) => (
                          <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
                        ),
                        // Ensure code blocks render properly with proper overflow handling
                        code: ({node, inline, className, children, ...props}: any) => {
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
                        // Links
                        a: ({href, children}: any) => (
                          <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                        // Horizontal rule
                        hr: () => (
                          <hr className="my-6 border-muted-foreground/30" />
                        ),
                      }}
                    >
                      {formatMarkdown(message.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                    {/* Display attachment indicators for user messages */}
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
      })}
    </div>
  );
}

interface ChatStarterScreenProps {
  agent: Agent | null;
}

export function ChatStarterScreen({ agent }: ChatStarterScreenProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto px-6 animate-fade-in">
        {agent?.avatar_url ? (
          <img 
            src={agent.avatar_url} 
            alt={agent.name || 'Agent'}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-6 shadow-lg"
            onError={(e) => {
              console.warn('Avatar image failed to load:', agent.avatar_url);
              // Hide the broken image and show fallback
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ display: agent?.avatar_url ? 'none' : 'flex' }}
        >
          <span className="text-white text-xl font-medium">
            {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
          </span>
        </div>
        <h3 className="text-2xl font-semibold text-foreground mb-3">
          Chat with {agent?.name || 'Agent'}
        </h3>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Start a conversation with your AI assistant. Ask questions, get help, or just chat!
        </p>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="p-3 bg-card rounded-lg text-left border border-border shadow-sm">
            <div className="font-medium text-foreground">💡 Try asking:</div>
            <div className="text-muted-foreground mt-1">"What can you help me with?"</div>
          </div>
          <div className="p-3 bg-card rounded-lg text-left border border-border shadow-sm">
            <div className="font-medium text-foreground">🔍 Or request:</div>
            <div className="text-muted-foreground mt-1">"Help me analyze this data"</div>
          </div>
        </div>
      </div>
    </div>
  );
}
