import Editor from '@monaco-editor/react';

interface CanvasEditorPanelProps {
  editorLanguage: string;
  content: string;
  onContentChange: (value: string) => void;
  onEditorMount: (editor: any) => void;
}

export function CanvasEditorPanel({ editorLanguage, content, onContentChange, onEditorMount }: CanvasEditorPanelProps) {
  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="h-full flex justify-center">
        <div className="w-full max-w-[800px] h-full">
          <Editor
            height="100%"
            language={editorLanguage}
            value={content}
            onChange={(value) => onContentChange(value || '')}
            onMount={onEditorMount}
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
              scrollbar: { vertical: 'auto', horizontal: 'hidden', useShadows: false, verticalScrollbarSize: 10 },
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
              lineHeight: 24,
            }}
          />
        </div>
      </div>
    </div>
  );
}
