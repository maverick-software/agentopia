# Provider Capabilities (2025) — Chat, Tools, Streaming, Tokens

Objective: capture API features to inform a clean, provider‑agnostic interface.

OpenAI (Chat/Responses API)
- Tools: Function calling (JSON schema), parallel calls
- Streaming: SSE deltas; tool_call streaming
- Tokens: Usage returned; 8k/128k models; counters available
- Embeddings: text-embedding-3-small/large

Anthropic (Claude Messages)
- Tools: Tool use (JSON schema); requires tool result messages
- Streaming: SSE deltas with tool_use parts
- Tokens: Large context (≥200k); input/output usage returned

Google Gemini 1.5
- Tools: Function calling/tools; result messages
- Streaming: Server streaming; tool call/result parts
- Tokens: Very large contexts (up to 1M)

Mistral
- Tools: Function calling on select routes
- Streaming: Yes; OpenAI‑like
- Tokens: 8k–32k

Groq
- Tools: OpenAI‑compatible chat; function calling supported
- Streaming: Yes; OpenAI‑like
- Tokens: Model‑dependent; very low latency

OpenRouter (Broker)
- Tools: Often OpenAI‑compatible; varies by upstream model
- Streaming: Yes; OpenAI‑like
- Tokens: Usage via headers where supported

Implications
- Normalize messages, tools, tool_calls, streaming into internal types
- Require per‑provider adapters to map to/from internal schema
- Centralize token usage capture with conservative fallbacks
