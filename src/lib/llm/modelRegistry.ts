export interface ModelCard {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'openrouter';
  displayName: string;
  context: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  category?: 'general' | 'reasoning' | 'fast' | 'vision' | 'code';
  defaultParams?: { 
    temperature?: number; 
    maxTokens?: number; 
    topP?: number; 
  };
}

export const MODEL_CARDS: ModelCard[] = [
  // OpenAI Models
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', context: 128000, supportsTools: true, supportsStreaming: true, category: 'fast' },
  { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', context: 128000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-4-turbo', provider: 'openai', displayName: 'GPT-4 Turbo', context: 128000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-4', provider: 'openai', displayName: 'GPT-4', context: 8192, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-3.5-turbo', provider: 'openai', displayName: 'GPT-3.5 Turbo', context: 16385, supportsTools: true, supportsStreaming: true, category: 'fast' },
  
  // Anthropic Models (when implemented)
  { id: 'claude-3-5-sonnet', provider: 'anthropic', displayName: 'Claude 3.5 Sonnet', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning' },
  { id: 'claude-3-opus', provider: 'anthropic', displayName: 'Claude 3 Opus', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning' },
  { id: 'claude-3-sonnet', provider: 'anthropic', displayName: 'Claude 3 Sonnet', context: 200000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'claude-3-haiku', provider: 'anthropic', displayName: 'Claude 3 Haiku', context: 200000, supportsTools: true, supportsStreaming: true, category: 'fast' },
];

export function getModelsByProvider(provider: ModelCard['provider']): ModelCard[] {
  return MODEL_CARDS.filter(m => m.provider === provider);
}

export function getAllProviders(): ModelCard['provider'][] {
  return [...new Set(MODEL_CARDS.map(m => m.provider))];
}

export function getModelCard(modelId: string): ModelCard | undefined {
  return MODEL_CARDS.find(m => m.id === modelId);
}


