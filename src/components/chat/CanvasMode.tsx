/**
 * CanvasMode Component
 * Split-screen layout with chat on left and Monaco editor on right
 */

import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';
import {
  X,
  Download,
  Send,
  Paperclip,
  Sliders
} from 'lucide-react';
import { CanvasModeProps, ARTIFACT_LANGUAGE_MAP } from '@/types/artifacts';
import { toast } from 'react-hot-toast';
import type { Message } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';

export const CanvasMode: React.FC<CanvasModeProps> = ({
  artifact,
  onClose,
  onSave,
  onDownload,
  messages = [],
  agent,
  user,
  onSendMessage
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canvasInput, setCanvasInput] = useState('');
  const [localMessages, setLocalMessages] = useState(messages);
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Detect content changes
  useEffect(() => {
    setHasUnsavedChanges(content !== artifact.content);
  }, [content, artifact.content]);

  // Auto-resize textarea when input changes
  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200;
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  // Resize on input change
  useEffect(() => {
    resizeTextarea();
  }, [canvasInput, resizeTextarea]);

  // Sync messages from parent
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timeoutId = setTimeout(() => {
      handleSave();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [content, hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        handleClose();
      }
      
      // Ctrl+D or Cmd+D to download
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDownload(artifact);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSave(content);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      
      // Reset success indicator after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to save artifact:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onClose();
  };

  const handleCanvasSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canvasInput.trim()) return;
    
    const messageContent = canvasInput.trim();
    
    // Add user message to local state immediately for UI feedback
    const userMessage: any = {
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };
    setLocalMessages(prev => [...prev, userMessage]);
    
    // Clear input and reset height
    setCanvasInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // If parent provided a send handler, use it
    if (onSendMessage) {
      try {
        await onSendMessage(messageContent);
      } catch (error) {
        console.error('[Canvas] Error sending message:', error);
        toast.error('Failed to send message');
      }
    } else {
      // Otherwise show info toast
      toast.info('Canvas chat integration coming soon - message added locally');
    }
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCanvasSend(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCanvasInput(e.target.value);
  };

  const editorLanguage = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || 'plaintext';

  return (
    <div className="fixed inset-0 z-50 bg-[#212121]">
      {/* Header - ChatGPT style */}
      <div className="h-12 border-b border-[#444] bg-[#2f2f2f] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-sm text-white">{artifact.title}</h2>
          {hasUnsavedChanges && (
            <span className="text-xs text-gray-400">• Unsaved</span>
          )}
          {isSaving && (
            <span className="text-xs text-blue-400">• Saving...</span>
          )}
          {saveSuccess && (
            <span className="text-xs text-green-400">• Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save'}
          </button>

          {/* Download Button */}
          <button
            onClick={() => onDownload(artifact)}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Adjustable Split Layout */}
      <Split
        className="flex h-[calc(100vh-3rem)]"
        sizes={[30, 70]}
        minSize={[300, 400]}
        gutterSize={12}
        gutterAlign="center"
        snapOffset={30}
        dragInterval={1}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel: Chat Interface */}
        <div className="h-full bg-background border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-4">
              {localMessages.length > 0 ? (
                localMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-4 animate-fade-in max-w-full ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse !mb-10' : '!mt-10'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      ) : (
                        <>
                          {resolvedAvatarUrl ? (
                            <img 
                              src={resolvedAvatarUrl} 
                              alt={agent?.name || 'Agent'}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                console.warn('Canvas avatar failed to load:', resolvedAvatarUrl);
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
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const timestamp = message.timestamp;
                            if (!timestamp) return '';
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
                            if (isNaN(date.getTime())) return '';
                            return date.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            });
                          })()}
                        </span>
                      </div>
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
                              p: ({children}: any) => (
                                <p className="my-3 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</p>
                              ),
                              ul: ({children}: any) => (
                                <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>
                              ),
                              ol: ({children}: any) => (
                                <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>
                              ),
                              li: ({children}: any) => (
                                <li className="my-1 leading-7 break-words overflow-wrap-anywhere">{children}</li>
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="bg-[#343541] text-white text-sm leading-relaxed px-4 py-2.5 rounded-2xl inline-block max-w-full text-left break-words overflow-wrap-anywhere">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-sm mb-2">Continue the conversation</p>
                  <p className="text-xs">Ask the agent to make changes to the document</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Input - exactly matches AgentChatPage style */}
          <div className="border-t border-border px-4 py-4">
            <form onSubmit={handleCanvasSend} className="relative">
              {/* Text input container */}
              <div className="relative bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/40 focus-within:shadow-md">
                <div className="px-4 py-3">
                  <textarea
                    ref={textareaRef}
                    value={canvasInput}
                    onChange={handleInputChange}
                    onKeyDown={handleCanvasKeyDown}
                    placeholder="Ask to edit the document..."
                    rows={1}
                    className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/60 border-0 outline-none text-[15px] leading-relaxed scrollbar-thin"
                    style={{ 
                      minHeight: '24px',
                      maxHeight: '200px',
                      overflowY: 'hidden'
                    }}
                  />
                </div>
                
                {/* Bottom toolbar - Inside container with visual separation */}
                <div className="flex items-center justify-between px-3 pb-2 pt-0 border-t border-border/20">
                  {/* Left side tools */}
                  <div className="flex items-center space-x-1">
                    {/* File attachment */}
                    <button
                      type="button"
                      onClick={() => toast.info('File attachment coming soon in Canvas mode')}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Settings/Tools button */}
                    <button
                      type="button"
                      onClick={() => toast.info('Canvas settings coming soon')}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      title="Canvas Settings"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right side - Send button */}
                  <button
                    type="submit"
                    disabled={!canvasInput.trim()}
                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel: Clean Editor - Seamless background */}
        <div className="h-full overflow-hidden bg-background">
          <div className="h-full flex justify-center">
            <div className="w-full max-w-[800px] h-full">
              <Editor
                height="100%"
                language={editorLanguage}
                value={content}
                onChange={(value) => setContent(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 16,
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  renderLineHighlight: 'none',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'hidden',
                    useShadows: false,
                    verticalScrollbarSize: 10
                  },
                  rulers: [],
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 48, bottom: 48, left: 64, right: 64 },
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  tabSize: 2,
                  insertSpaces: true,
                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontLigatures: false,
                  cursorStyle: 'line',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  contextmenu: false,
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  lineHeight: 24
                }}
              />
            </div>
          </div>
        </div>
      </Split>
    </div>
  );
};
