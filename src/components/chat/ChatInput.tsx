import React, { useRef, useCallback } from 'react';
import { Send, Paperclip, Sliders } from 'lucide-react';
import type { Database } from '../../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  agent: Agent | null;
  sending: boolean;
  uploading: boolean;
  uploadProgress: {[key: string]: number};
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileUpload: (files: FileList, type: 'document' | 'image') => void;
  adjustTextareaHeight: () => void;
  onShowAgentSettings?: () => void;
}

export function ChatInput({ 
  input, 
  setInput, 
  agent, 
  sending, 
  uploading, 
  uploadProgress, 
  onSubmit, 
  onKeyDown, 
  onFileUpload,
  adjustTextareaHeight,
  onShowAgentSettings
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  }, [setInput, adjustTextareaHeight]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files, 'document'); // Default to document type
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, [onFileUpload]);

  return (
    <div className="flex-shrink-0 bg-background">
      <div className="max-w-3xl mx-auto px-4 py-2">
        <form onSubmit={onSubmit} className="relative">
          {/* Text input container - Clean text area only */}
          <div className="relative bg-card border border-border/40 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/50 focus-within:shadow-md">
            <div className="px-4 py-2 flex items-center">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                placeholder={`Message ${agent?.name || 'Agent'}...`}
                className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/70 border-0 outline-0 text-[15px] leading-normal disabled:opacity-50 disabled:cursor-not-allowed placeholder-center"
                disabled={!agent}
                rows={1}
                style={{ minHeight: '22px', maxHeight: '120px' }}
              />
              {/* Voice input button inside text area - disappears when typing */}
              {!input.trim() && (
                <button
                  type="button"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors ml-2"
                  disabled={!agent}
                  title="Voice input"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 23h8" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Tools row - Outside text area for cleaner look */}
          <div className="flex items-center justify-between mt-2 px-1">
            {/* Left side tools */}
            <div className="flex items-center space-x-1">
              {/* File attachment */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.html,.rtf,.odt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                disabled={!agent || uploading}
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Settings/Tools button */}
              {onShowAgentSettings && (
                <button
                  type="button"
                  onClick={onShowAgentSettings}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  disabled={!agent}
                  title="Agent Settings"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              )}

              {/* Upload progress indicator */}
              {uploading && Object.keys(uploadProgress).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Uploading... {Math.round(Object.values(uploadProgress)[0] || 0)}%
                </div>
              )}
            </div>

            {/* Right side - Send button */}
            <button
              type="submit"
              disabled={!input.trim() || !agent || sending}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
