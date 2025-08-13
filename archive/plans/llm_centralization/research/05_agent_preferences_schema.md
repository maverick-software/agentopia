# Agent Preferences Schema

Purpose
- Store per‑agent LLM provider/model selections and parameters

Proposed Table: agent_llm_preferences
- agent_id uuid (PK, FK agents.id)
- provider text (e.g., openai, anthropic, google, mistral, groq, openrouter)
- model text (e.g., gpt-4o-mini, claude-3-5-sonnet)
- params jsonb (temperature, maxTokens, top_p, penalties)
- embedding_model text (optional override)
- created_at, updated_at

RLS
- Agents belong to users/teams; enforce owner/admin visibility

Accessors
- RPC: get_agent_llm_prefs(agent_id)
- RPC: set_agent_llm_prefs(agent_id, provider, model, params, embedding_model)

Fallbacks
- If no prefs: use project defaults from environment/config
- Allow per‑workspace override later if needed
