export interface ModelCard {
  id: string;
  provider: 'openai';
  displayName: string;
  context: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

export const MODEL_CARDS: ModelCard[] = [
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', context: 128000, supportsTools: true, supportsStreaming: true },
  { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', context: 128000, supportsTools: true, supportsStreaming: true },
  { id: 'gpt-4-turbo', provider: 'openai', displayName: 'GPT-4 Turbo', context: 128000, supportsTools: true, supportsStreaming: true },
  { id: 'gpt-4', provider: 'openai', displayName: 'GPT-4 (8k)', context: 8192, supportsTools: true, supportsStreaming: true },
];

export function getModelsByProvider(provider: 'openai'): ModelCard[] {
  return MODEL_CARDS.filter(m => m.provider === provider);
}


