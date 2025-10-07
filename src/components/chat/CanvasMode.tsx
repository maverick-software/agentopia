/**
 * CanvasMode Component
 * Split-screen layout with chat on left and Monaco editor on right
 */

import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Save,
  Download,
  History,
  Check,
  Loader2,
  FileCode,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CanvasModeProps, ARTIFACT_LANGUAGE_MAP, ARTIFACT_TYPE_LABELS } from '@/types/artifacts';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export const CanvasMode: React.FC<CanvasModeProps> = ({
  artifact,
  onClose,
  onSave,
  onDownload
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [splitSizes, setSplitSizes] = useState<number[]>([40, 60]);

  // Load split sizes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('canvas-split-sizes');
    if (saved) {
      try {
        setSplitSizes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved split sizes:', e);
      }
    }
  }, []);

  // Save split sizes to localStorage
  const handleSplitChange = (sizes: number[]) => {
    setSplitSizes(sizes);
    localStorage.setItem('canvas-split-sizes', JSON.stringify(sizes));
  };

  // Detect content changes
  useEffect(() => {
    setHasUnsavedChanges(content !== artifact.content);
  }, [content, artifact.content]);

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

  const editorLanguage = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || 'plaintext';

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <FileCode className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm">{artifact.title}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {ARTIFACT_TYPE_LABELS[artifact.file_type]}
              </Badge>
              <span>v{artifact.version}</span>
              {hasUnsavedChanges && <span className="text-orange-500">• Unsaved changes</span>}
              {isSaving && <span className="text-blue-500">• Saving...</span>}
              {saveSuccess && <span className="text-green-500">• Saved</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Version History */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                History
                <ChevronDown className="h-3 w-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">
                  Version history coming soon
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            size="sm"
            variant={saveSuccess ? "default" : "outline"}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save'}
          </Button>

          {/* Download Button */}
          <Button
            onClick={() => onDownload(artifact)}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>

          {/* Close Button */}
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Split Layout */}
      <div className="h-[calc(100vh-3.5rem)]">
        <Split
          sizes={splitSizes}
          minSize={[300, 400]}
          gutterSize={8}
          gutterAlign="center"
          direction="horizontal"
          cursor="col-resize"
          className="flex h-full"
          onDragEnd={handleSplitChange}
        >
          {/* Left Panel: Chat (compressed) */}
          <div className="h-full overflow-hidden bg-background border-r border-border">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center p-6">
                <p className="text-sm">Chat panel will be integrated here</p>
                <p className="text-xs mt-2">Continue conversation while editing</p>
              </div>
            </div>
          </div>

          {/* Right Panel: Monaco Editor */}
          <div className="h-full overflow-hidden bg-background">
            <Editor
              height="100%"
              language={editorLanguage}
              value={content}
              onChange={(value) => setContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                rulers: [],
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                tabSize: 2,
                insertSpaces: true
              }}
            />
          </div>
        </Split>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg p-3 shadow-lg text-xs text-muted-foreground">
        <div className="font-semibold mb-1">Keyboard Shortcuts</div>
        <div className="space-y-0.5">
          <div><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+S</kbd> Save</div>
          <div><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+D</kbd> Download</div>
          <div><kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Close</div>
        </div>
      </div>
    </div>
  );
};
