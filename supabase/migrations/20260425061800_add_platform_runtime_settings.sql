-- Store non-secret runtime configuration in platform_settings instead of
-- Supabase Edge Function secrets.

INSERT INTO public.platform_settings (key, value, description, category)
VALUES
  (
    'chat_feature_flags',
    '{
      "use_advanced_messages": false,
      "enable_memory_system": true,
      "enable_state_management": false,
      "use_new_tool_framework": false,
      "enable_streaming_responses": false,
      "maintain_dual_write": true,
      "auto_migrate_messages": true,
      "enable_compatibility_mode": true,
      "rollout_percentage": 100,
      "enabled_agent_ids": [],
      "enabled_user_ids": [],
      "enable_caching": false,
      "enable_parallel_tools": false,
      "enable_context_compression": false,
      "verbose_logging": true,
      "capture_metrics": true
    }',
    'Chat feature flags formerly controlled by Edge Function environment variables.',
    'chat'
  ),
  (
    'dtma_endpoint',
    'http://localhost:30000',
    'DTMA service endpoint used by MCP deployment functions.',
    'mcp'
  ),
  (
    'dtma_auth_token',
    '',
    'Optional DTMA bearer token. Prefer a private internal network when empty.',
    'mcp'
  ),
  (
    'node_backend_url',
    '',
    'Optional internal Node backend URL for legacy agent tool environment management.',
    'tools'
  )
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
