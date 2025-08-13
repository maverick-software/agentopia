# Call-Site Inventory (Backend)

Hard-coded model usages
- supabase/functions/chat/processor/handlers.ts
  - chat.completions.create({ model: 'gpt-4', ... }) x2
  - metadata includes 'gpt-4'
- supabase/functions/chat/api/v2/index.ts: API defaults include model: 'gpt-4'
- supabase/functions/chat/processor/MessageProcessor.ts: 'gpt-4o-mini'
- supabase/functions/chat/index_old.ts: 'gpt-4' (legacy)
- supabase/functions/chat/core/memory/semantic_memory.ts: 'gpt-4' (two locations)
- supabase/functions/chat/core/memory/memory_manager.ts: 'gpt-4'
- supabase/functions/chat/adapters/api_version_router.ts: 'gpt-4'
- supabase/functions/chat/vector_search.ts: 'text-embedding-3-small'
- supabase/functions/process-datastore-document/index.ts: 'text-embedding-3-small'
- supabase/functions/generate-embedding/index.ts: 'text-embedding-3-small'
- supabase/functions/generate-agent-image/index.ts: 'dall-e-3' (image generation)

OpenAI client instantiation
- supabase/functions/chat/index.ts: new OpenAI({ apiKey })
- supabase/functions/process-datastore-document/index.ts: new OpenAI
- supabase/functions/generate-embedding/index.ts: new OpenAI

Embedding model references
- Multiple references to 'text-embedding-3-small' and config.embedding_model

Implication
- Phase 2/3 must replace these with LLMRouter.chat/embed.
- Image generation can stay out of scope or have a thin adapter later.
