# Plan and Execute: Centralized, Provider-Agnostic LLM Orchestration Layer

**Date:** August 13, 2025  
**Plan ID:** llm_centralization_20250813  
**Priority:** CRITICAL – Platform Reliability & Extensibility

## 🎯 Executive Summary

Objective: Consolidate all LLM usage behind a single, provider-agnostic orchestration layer that supports per‑agent model/provider selection, uniform tool-calling, streaming, embeddings, and strict token budgeting. This eliminates hard‑coded model names scattered across code, prevents context overflows automatically, and enables rapid addition of Anthropic, Google/Gemini, Mistral, Groq, and OpenRouter.

Key Outcomes:
- Single entrypoint for chat, tools, streaming, and embeddings
- Per‑agent model and parameters with UI configuration
- Automatic token budgeting, trimming, and optional summarization
- Consistent metrics/logging and error handling across providers

## 🔎 Current State Analysis
- Hard-coded models appear in multiple places (e.g., `gpt-4`, `gpt-4o-mini`, `text-embedding-3-small`).
- Direct OpenAI client usage in the chat function entry and memory subsystems.
- No centralized token budgeting → recurring 400 context_length_exceeded errors.
- Tool-calling is tied to OpenAI function format; no abstraction for other providers.

## ⚠️ Gap Analysis
- No unified abstraction for multi-provider chat/stream/embeddings.
- No reliable per‑agent model selection pipeline.
- Insufficient, centralized token management and overflow mitigation.
- Inconsistent metrics export and failure handling.

## 📐 Target Architecture
- Directory: `supabase/functions/shared/llm/`
  - Interfaces: `LLMProvider`, `LLMMessage`, `LLMTool`, `LLMToolCall`, `LLMChatResponse`, `LLMChatOptions`.
  - Providers: `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `MistralProvider`, `GroqProvider`, `OpenRouterProvider` (phased).
  - Router: `LLMRouter` → selects provider/model by `agent_llm_preferences` with fallbacks.
  - TokenBudgetManager: token counting, trimming by recency/priority, optional summarization.
  - ToolAdapter: normalizes provider-specific tool/function calling.
  - PromptBuilder: standardizes identity/system/instructions and formatting.

Data Model:
- New table `agent_llm_preferences` (agent_id, provider, model, params jsonb, optional embedding_model). Fallback to project defaults.

## 📋 Phase Plan

### Phase 1: Core Abstraction (Week 1)
1. Implement `LLMProvider` interfaces and `OpenAIProvider` (chat, stream, embed, tool adapter).
2. Build `LLMRouter` with provider selection from `agent_llm_preferences`.
3. Implement `TokenBudgetManager` with token counting, history trimming, and guardrails.
4. Implement `PromptBuilder` for consistent system/identity formatting.
5. Centralize metrics export with graceful failure handling.

### Phase 2: Chat Integration & Overflow Mitigation (Week 1)
1. Replace direct OpenAI calls in `TextMessageHandler` with `LLMRouter.chat()` and streaming variant.
2. Normalize tool calls via `ToolAdapter`; keep `FunctionCallingManager` unchanged.
3. Enforce token budgeting; optionally summarize older context blocks when needed.
4. Validate no regressions in SSE streaming and assistant message persistence.

### Phase 3: Embeddings Consolidation (Week 1)
1. Route embeddings in memory and vector search through `LLMRouter.embed()`.
2. Configure default embedding models per provider; allow per‑agent override.

### Phase 4: Additional Providers (Week 2)
1. Add Anthropic, Google/Gemini, Mistral, Groq, OpenRouter adapters.
2. Map tool-calling semantics to internal schema; basic end‑to‑end tests.

### Phase 5: Agent UI & Admin (Week 2)
1. Add per‑agent Model Provider/Model selector with parameter controls (temperature, max tokens, top_p).
2. Persist to `agent_llm_preferences`; add validation and safe defaults.

### Phase 6: Testing & Rollout (Week 3)
1. Unit tests for router, token budgeting, tool adapters, and prompts.
2. Integration tests for chat flow, tool calls, streaming, persistence, embeddings.
3. Feature flag rollout; remove legacy hard-coded model usages post‑validation.

## 🧪 Success Metrics
- Context overflow incidents: ↓ 95% within first week (automated trimming/summarization).
- Provider swap time: ≤ 1 hour to add a new provider adapter.
- Per‑agent model changes reflected instantly without code edits.
- Streaming/chat error rate unchanged or improved under load.

## 🚦 Implementation Timeline
| Week | Phase | Key Deliverables | Status |
|------|-------|------------------|--------|
| 1 | Phase 1 | Core LLM interfaces, OpenAI provider, Router, TokenBudgetManager, PromptBuilder | Ready |
| 1 | Phase 2 | Chat integration, overflow mitigation, metrics | Ready |
| 1 | Phase 3 | Embeddings routed through router | Ready |
| 2 | Phase 4 | Anthropic, Gemini, Mistral, Groq, OpenRouter adapters | Ready |
| 2 | Phase 5 | Agent UI for model selection | Ready |
| 3 | Phase 6 | Tests, rollout, remove hard‑coded models | Ready |

## ✅ Immediate Next Steps (Start Today)
1. Create migration for `agent_llm_preferences` with safe defaults.
2. Scaffold `supabase/functions/shared/llm/` with interfaces and `OpenAIProvider`.
3. Implement `LLMRouter` and wire into `TextMessageHandler` behind a feature flag.
4. Add `TokenBudgetManager` to eliminate context overflow errors immediately.

## 🛡️ Risk Assessment & Mitigation
- Provider API differences: Use `ToolAdapter` and response normalization; add contract tests.
- Token counting variance: Overestimate via conservative heuristics; integrate per‑provider counters when available.
- Rollout risk: Use feature flag; maintain legacy path for quick fallback.
- Performance: Cache compiled prompts; batch metrics export; avoid synchronous logging on hot paths.

## 📞 Communication & Support
- Daily standups: progress on Phases 1–3 until chat path is fully migrated.
- Weekly reviews: provider adapters and UI integration demos.
- Incident protocol: On failure, toggle feature flag to revert while investigating.

---

Plan Status: ✅ READY FOR EXECUTION


