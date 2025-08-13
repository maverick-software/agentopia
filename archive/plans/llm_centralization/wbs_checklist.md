# WBS Checklist — LLM Centralization

## Phase 1: Core Abstraction
- [ ] Define interfaces: `LLMProvider`, `LLMMessage`, `LLMTool`, `LLMToolCall`, `LLMChatResponse`, `LLMChatOptions`
- [ ] Implement `OpenAIProvider` (chat, stream, embed, tools)
- [ ] Implement `LLMRouter` (load per‑agent prefs, fallbacks)
- [ ] Implement `TokenBudgetManager` (count, trim, summarize)
- [ ] Implement `PromptBuilder` (identity/system/instructions)
- [ ] Centralize metrics export with graceful errors

## Phase 2: Chat Integration & Overflow
- [ ] Integrate router in `TextMessageHandler`
- [ ] Normalize tool calls via `ToolAdapter`
- [ ] Enforce token budgeting; add summarization path
- [ ] Validate SSE streaming and persistence

## Phase 3: Embeddings
- [ ] Route all embeddings through router
- [ ] Configure default embedding model and per‑agent override

## Phase 4: Providers
- [ ] Anthropic provider
- [ ] Google/Gemini provider
- [ ] Mistral provider
- [ ] Groq provider
- [ ] OpenRouter provider

## Phase 5: Agent UI & Admin
- [ ] Per‑agent provider/model selector UI
- [ ] Persist to `agent_llm_preferences`
- [ ] Validate with basic form tests

## Phase 6: Testing & Rollout
- [ ] Unit tests for router, budgeting, tool adapters, prompts
- [ ] Integration tests for chat, tools, streaming, embeddings
- [ ] Feature-flag rollout; remove hard‑coded models after burn‑in


