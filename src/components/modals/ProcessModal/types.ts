export interface ProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingDetails: any;
}

export interface ProcessModalDerivedDetails {
  memory_operations?: any;
  context_operations?: any;
  tool_operations?: any[];
  reasoning_chain?: any[];
  chat_history?: any;
  performance?: any;
  reasoning?: any;
  discovered_tools?: any[];
  reasoning_graph?: { states?: string[] };
}

export interface ProcessModalDataState {
  localSummaryInfo: any;
  localRecentMessages: any[];
  setLocalSummaryInfo: (value: any) => void;
  setLocalRecentMessages: (value: any[]) => void;
  isGenerating: boolean;
  generationStatus: 'idle' | 'success' | 'error';
  generationMessage: string;
  setIsGenerating: (value: boolean) => void;
  setGenerationStatus: (value: 'idle' | 'success' | 'error') => void;
  setGenerationMessage: (value: string) => void;
}
