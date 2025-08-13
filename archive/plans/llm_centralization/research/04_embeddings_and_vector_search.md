# Embeddings and Vector Search

Goals
- Centralize embedding generation across providers
- Support per‑agent overrides while preserving defaults

Considerations
- OpenAI: text-embedding-3-small (1536d), large (3072d)
- Others: dims/costs vary; adapter must declare dims for downstream stores
- Batch size tuning to respect rate limits and throughput

Integration
- Router.embed(inputs, modelHint?) → number[][]
- Memory/Vector Search depend on router; no direct SDK calls
- Namespace strategy per agent/workspace; consistent upserts

Quality
- Normalize/case‑fold; deduplicate; chunking strategy aligned to downstream retrieval
- Track embedding usage and error rates centrally
