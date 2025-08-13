# Rollout and Feature Flags

Strategy
- Introduce new router behind a feature flag (e.g., USE_LLM_ROUTER=true)
- Maintain legacy path for quick fallback

Stages
1) Dark launch: route 5% of requests via router; compare metrics
2) Expand to 50%; monitor errors/latency
3) 100%; remove legacy hard-coded model calls

Flags
- USE_LLM_ROUTER (global)
- ALLOW_MODEL_ESCALATION (per-agent optional)
- ENABLE_TOOL_ADAPTER (global/per-agent)

Observability
- Compare token usage, latency, error rates pre/post
- Record router decisions (provider/model) per request
