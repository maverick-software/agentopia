import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import { Label } from '@/components/ui/label';

// Define component props
interface AgentFormInstructionsProps {
  systemInstructions: string | undefined;
  assistantInstructions: string | undefined;
  handleEditorChange: (fieldName: string, value: string) => void;
  // Pass theme if needed, or determine dynamically
  // editorTheme: string;
}

export const AgentFormInstructions: React.FC<AgentFormInstructionsProps> = ({
  systemInstructions,
  assistantInstructions,
  handleEditorChange,
  // editorTheme = 'vs-dark' // Default theme example
}) => {
  const editorOptions = {
    selectOnLineNumbers: true,
    minimap: { enabled: false },
    automaticLayout: true, // Adjust layout on container size changes
    wordWrap: 'on' as const // Enable word wrapping
  };

  return (
    <div className="space-y-6">
      {/* System Instructions */}
      <div>
        <Label htmlFor="systemInstructions">System Instructions</Label>
        <div className="border rounded-md overflow-hidden h-48"> {/* Fixed height container */}
          <MonacoEditor
            language="markdown" // Assuming markdown, adjust if needed
            theme="vs-dark" // Or use prop: editorTheme
            value={systemInstructions || ''}
            options={editorOptions}
            onChange={(value) => handleEditorChange('system_instructions', value)}
            // Consider adding editorDidMount for potential setup
          />
        </div>
      </div>

      {/* Assistant Instructions */}
      <div>
        <Label htmlFor="assistantInstructions">Assistant Instructions (Optional)</Label>
        <div className="border rounded-md overflow-hidden h-48"> {/* Fixed height container */}
          <MonacoEditor
            language="markdown" // Assuming markdown, adjust if needed
            theme="vs-dark" // Or use prop: editorTheme
            value={assistantInstructions || ''}
            options={editorOptions}
            onChange={(value) => handleEditorChange('assistant_instructions', value)}
          />
        </div>
      </div>
    </div>
  );
}; 