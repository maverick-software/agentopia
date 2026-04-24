import React, { useCallback, useEffect, useState } from 'react';
import Split from 'react-split';
import { Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CanvasModeProps, ARTIFACT_LANGUAGE_MAP } from '@/types/artifacts';
import { Sidebar } from '@/components/Sidebar';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { useCanvasSession } from '@/hooks/useCanvasSession';
import { CanvasChatPanel } from './CanvasChatPanel';
import { CanvasEditorPanel } from './CanvasEditorPanel';
import { CanvasHeader } from './CanvasHeader';
import { SelectedContext } from './types';

export const CanvasMode: React.FC<CanvasModeProps> = ({
  artifact,
  onClose,
  onSave,
  onDownload,
  messages = [],
  agent,
  user,
  onSendMessage,
  thinkingMessageIndex,
  aiState,
  currentTool,
  processSteps,
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canvasInput, setCanvasInput] = useState('');
  const [localMessages, setLocalMessages] = useState(messages);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedContexts, setSelectedContexts] = useState<SelectedContext[]>([]);
  const editorRef = React.useRef<any>(null);
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);

  const canvasSession = useCanvasSession({
    userId: user?.id || '',
    agentId: agent?.id || '',
    artifactId: artifact.id,
    conversationSessionId: null,
    autoSaveInterval: 3000,
  });

  useEffect(() => setContent(artifact.content), [artifact.content, artifact.version]);
  useEffect(() => setHasUnsavedChanges(content !== artifact.content), [content, artifact.content]);
  useEffect(() => setLocalMessages(messages), [messages]);

  useEffect(() => {
    const initSession = async () => {
      if (!user?.id || !agent?.id) return;
      try {
        const savedContent = await canvasSession.loadSession(artifact.content);
        if (savedContent && savedContent !== artifact.content) {
          setContent(savedContent);
          toast.info('Restored your previous work-in-progress');
        }
      } catch (error) {
        console.error('[Canvas] Error loading session:', error);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    if (content && user?.id && agent?.id && canvasSession.session) {
      canvasSession.autoSave(content);
    }
  }, [content, canvasSession, user?.id, agent?.id]);

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(content);
      await canvasSession.clearSession();
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      toast.success('Saved to database!');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('[Canvas] Failed to save artifact:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSend = async () => {
    if (!canvasInput.trim()) return;
    let messageContent = canvasInput.trim();
    let displayContent = canvasInput.trim();
    if (selectedContexts.length > 0) {
      const contextBlocks = selectedContexts.map((ctx, idx) => `[Selection ${idx + 1} - ${ctx.lines}]:\n\`\`\`${ctx.language}\n${ctx.text}\n\`\`\``).join('\n\n');
      messageContent = `${contextBlocks}\n\n${messageContent}`;
      displayContent = `${contextBlocks}\n\n${messageContent}`;
    }
    setLocalMessages((prev: any) => [...prev, { role: 'user', content: displayContent, timestamp: new Date() }]);
    setCanvasInput('');
    setSelectedContexts([]);
    if (!onSendMessage) return toast.info('Canvas chat integration coming soon - message added locally');
    try {
      await onSendMessage(messageContent);
    } catch (error) {
      console.error('[Canvas] Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleEditorSelection = useCallback((editor: any) => {
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) {
      setShowSelectionMenu(false);
      return;
    }
    const text = editor.getModel().getValueInRange(selection);
    const coords = editor.getScrolledVisiblePosition(selection.getStartPosition());
    const editorRect = editor.getDomNode()?.getBoundingClientRect();
    if (!coords || !editorRect) return;
    setSelectedText(text);
    setSelectionRange({ start: selection.startLineNumber, end: selection.endLineNumber });
    setSelectionMenuPosition({ x: editorRect.left + coords.left, y: editorRect.top + coords.top - 45 });
    setShowSelectionMenu(true);
  }, []);

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection(() => handleEditorSelection(editor));
  };

  const handleAddToChat = () => {
    if (selectedContexts.length >= 5) {
      toast.error('Maximum 5 selections allowed');
      setShowSelectionMenu(false);
      return;
    }
    const language = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || artifact.file_type;
    const lines = selectionRange ? `Lines ${selectionRange.start}-${selectionRange.end}` : 'Selection';
    setSelectedContexts((prev) => [...prev, { id: `sel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, text: selectedText, lines, language }]);
    setShowSelectionMenu(false);
    toast.success(`Selection ${selectedContexts.length + 1}/5 added`);
  };

  const editorLanguage = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || 'plaintext';
  const saveButtonText = !artifact.id || artifact.id === 'new' ? 'Create Artifact' : 'Save';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') handleClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDownload(artifact);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, hasUnsavedChanges, artifact.id]);

  return (
    <div className="fixed inset-0 z-40 bg-[#212121] flex">
      <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
      <div className="flex-1 flex flex-col">
        <CanvasHeader
          title={artifact.title}
          draftSaving={canvasSession.saving}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          saveButtonText={saveButtonText}
          artifact={artifact}
          onSave={handleSave}
          onDownload={onDownload}
          onClose={handleClose}
        />
        <Split className="flex h-[calc(100vh-3rem)]" sizes={[30, 70]} minSize={[300, 400]} gutterSize={12} gutterAlign="center" snapOffset={30} dragInterval={1} direction="horizontal" cursor="col-resize">
          <CanvasChatPanel
            localMessages={localMessages as any}
            userInitial={user?.email?.charAt(0)?.toUpperCase() || 'U'}
            agentName={agent?.name || 'Assistant'}
            resolvedAvatarUrl={resolvedAvatarUrl}
            canvasInput={canvasInput}
            selectedContexts={selectedContexts}
            thinkingMessageIndex={thinkingMessageIndex}
            aiState={aiState as any}
            currentTool={currentTool}
            processSteps={processSteps}
            onInputChange={setCanvasInput}
            onSend={handleSend}
            onRemoveContext={(id) => setSelectedContexts((prev) => prev.filter((ctx) => ctx.id !== id))}
            onClearContexts={() => setSelectedContexts([])}
          />
          <CanvasEditorPanel editorLanguage={editorLanguage} content={content} onContentChange={setContent} onEditorMount={handleEditorMount} />
        </Split>

        {showSelectionMenu && (
          <div className="fixed z-50 animate-in fade-in-0 slide-in-from-bottom-1 duration-100" style={{ left: `${selectionMenuPosition.x}px`, top: `${selectionMenuPosition.y}px` }}>
            <button onClick={handleAddToChat} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-md flex items-center gap-1.5 transition-all whitespace-nowrap">
              <Send className="h-3 w-3" />
              Add to Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
