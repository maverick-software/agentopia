import React, { useRef, useCallback } from 'react';
import { Send, Paperclip, Sliders, X, FileText } from 'lucide-react';
import type { Database } from '../../types/database.types';

type Agent = Database['public']['Tables']['agents']['Row'];

interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadStatus: 'uploading' | 'completed' | 'error';
  tempId?: string; // Temporary ID used during upload
}

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  agent: Agent | null;
  sending: boolean;
  uploading: boolean;
  uploadProgress: {[key: string]: number};
  attachedDocuments?: AttachedDocument[];
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileUpload: (files: FileList, type: 'document' | 'image') => void;
  onRemoveAttachment?: (documentId: string) => void;
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
  attachedDocuments = [],
  onSubmit, 
  onKeyDown, 
  onFileUpload,
  onRemoveAttachment,
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-shrink-0 bg-background">
      <div className="max-w-3xl mx-auto px-4 py-2">
        {/* ChatGPT-style document attachments display */}
        {attachedDocuments.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {attachedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    doc.uploadStatus === 'completed' 
                      ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' 
                      : doc.uploadStatus === 'uploading'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200'
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
                  }`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate max-w-[200px]" title={doc.name}>
                      {doc.name}
                    </span>
                    <span className="text-xs opacity-75">
                      {doc.uploadStatus === 'uploading' ? 'Uploading...' : formatFileSize(doc.size)}
                    </span>
                  </div>
                  {doc.uploadStatus === 'completed' && onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(doc.id)}
                      className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {doc.uploadStatus === 'uploading' && (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
