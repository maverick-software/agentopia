import type { Message } from '@/types';

export interface SelectedContext {
  id: string;
  text: string;
  lines: string;
  language: string;
}

export interface CanvasChatPanelProps {
  localMessages: Message[];
  userInitial: string;
  agentName: string;
  resolvedAvatarUrl: string | null;
  canvasInput: string;
  selectedContexts: SelectedContext[];
  thinkingMessageIndex?: number;
  aiState?: string;
  currentTool?: string;
  processSteps?: any[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRemoveContext: (id: string) => void;
  onClearContexts: () => void;
}
