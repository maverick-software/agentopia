# Metrics and Observability

Goals
- Unify metrics across providers and calls; reduce log spam

Metrics
- request_id, agent_id, provider, model
- latency_ms, tokens_prompt, tokens_completion, tokens_total
- retry_count, error_code/type, overflow_events

Practices
- Batch export; swallow non‑fatal export errors
- Redact sensitive content; store only aggregates
- Correlate tool call phases and LLM steps

Dashboards
- Error rates by provider/model
- Token usage and cost estimates
- Latency heatmaps; overflow frequency
