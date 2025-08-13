# Model Registry

Purpose
- Central source of truth for available models, their providers, context windows, features, and UI labels.

Shape
```ts
export interface ModelCard {
  id: string;              // e.g., 'gpt-4o-mini'
  provider: string;        // 'openai'
  displayName: string;     // 'GPT‑4o Mini'
  context: number;         // max context tokens
  supportsTools: boolean;
  supportsStreaming: boolean;
  defaultParams?: { temperature?: number; maxTokens?: number; topP?: number };
  category?: 'general' | 'reasoning' | 'fast' | 'vision' | 'code';
  notes?: string;
}

export type ModelRegistry = Record<string, ModelCard>;
```

Usage
- UI reads registry to render model cards per provider
- Router validates agent selection against registry; fills defaults
- TokenBudgetManager reads `context` for budgeting

Extensibility
- Add new model by adding a `ModelCard`; no code changes elsewhere
- New provider requires adding an adapter + registry entries
