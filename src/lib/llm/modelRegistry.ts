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
  // OpenAI Models - GPT-5 Series (Latest)
  { id: 'gpt-5-chat', provider: 'openai', displayName: 'GPT-5 Chat', context: 200000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-5', provider: 'openai', displayName: 'GPT-5', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning' },
  { id: 'gpt-5-mini', provider: 'openai', displayName: 'GPT-5 Mini', context: 200000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-5-nano', provider: 'openai', displayName: 'GPT-5 Nano', context: 128000, supportsTools: true, supportsStreaming: true, category: 'fast' },
  
  // OpenAI Models - GPT-4.1 Series
  { id: 'gpt-4.1', provider: 'openai', displayName: 'GPT-4.1', context: 128000, supportsTools: true, supportsStreaming: true, category: 'reasoning' },
  { id: 'gpt-4.1-mini', provider: 'openai', displayName: 'GPT-4.1 Mini', context: 128000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-4.1-nano', provider: 'openai', displayName: 'GPT-4.1 Nano', context: 128000, supportsTools: true, supportsStreaming: true, category: 'fast' },
  
  // OpenAI Models - GPT-4o Series
  { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', context: 128000, supportsTools: true, supportsStreaming: true, category: 'general' },
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', context: 128000, supportsTools: true, supportsStreaming: true, category: 'fast' },
  
  // Anthropic Models (Claude 4.5 Series - Latest)
  { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic', displayName: 'Claude Sonnet 4.5', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning', defaultParams: { temperature: 0.7 } },
  
  // Anthropic Models (Claude 4.1 Series)
  { id: 'claude-opus-4-1-20250805', provider: 'anthropic', displayName: 'Claude Opus 4.1', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning', defaultParams: { temperature: 0.7 } },
  
  // Anthropic Models (Claude 4 Series)
  { id: 'claude-opus-4-20250514', provider: 'anthropic', displayName: 'Claude Opus 4', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning', defaultParams: { temperature: 0.7 } },
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', displayName: 'Claude Sonnet 4', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning', defaultParams: { temperature: 0.7 } },
  
  // Anthropic Models (Claude 3.7 Series)
  { id: 'claude-3-7-sonnet-20250219', provider: 'anthropic', displayName: 'Claude Sonnet 3.7', context: 200000, supportsTools: true, supportsStreaming: true, category: 'reasoning', defaultParams: { temperature: 0.7 } },
  
  // Anthropic Models (Claude 3.5 Series)
  { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', displayName: 'Claude Haiku 3.5', context: 200000, supportsTools: true, supportsStreaming: true, category: 'fast', defaultParams: { temperature: 0.7 } },
  
  // Anthropic Models (Claude 3 Series)
  { id: 'claude-3-haiku-20240307', provider: 'anthropic', displayName: 'Claude Haiku 3', context: 200000, supportsTools: true, supportsStreaming: true, category: 'fast', defaultParams: { temperature: 0.7 } },
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


