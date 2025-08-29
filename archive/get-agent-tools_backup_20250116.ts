/**
 * Get Agent Tools Edge Function
 * 
 * Returns all authorized MCP tools for an agent based on:
 * - Agent permissions (agent_integration_permissions)  
 * - User credentials (user_integration_credentials)
 * - Integration capabilities (integration_capabilities) - DATABASE DRIVEN
 * 
 * Uses database-driven tool discovery via integration_capabilities table
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

interface AgentToolsResponse {
  success: boolean;
  tools?: ToolDefinition[];
  error?: string;
  metadata?: {
    agent_id: string;
    user_id: string;
    provider_count: number;
    total_tools: number;
    cached: boolean;
  };
}

// Database-driven tool discovery - no hardcoded mappings needed

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request
    const { agent_id, user_id } = await req.json();
    
    if (!agent_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: agent_id and user_id' 
        }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GetAgentTools] Fetching tools for agent ${agent_id}, user ${user_id}`);

    // Database-driven query: Get agent permissions with direct provider → integration mapping
    const { data: authorizedTools, error } = await supabase
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        permission_level,
        user_integration_credentials!inner(
          id,
          connection_name,
          oauth_provider_id,
          credential_type,
          connection_status,
          oauth_providers!inner(
            id,
            name,
            display_name
          )
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('is_active', true)
      .eq('user_integration_credentials.connection_status', 'active')
      .order('granted_at', { ascending: false });
    
    if (error) {
      console.error('[GetAgentTools] Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    if (!authorizedTools || authorizedTools.length === 0) {
      console.log(`[GetAgentTools] No authorized tools found for agent ${agent_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          tools: [],
          metadata: {
            agent_id,
            user_id,
            provider_count: 0,
            total_tools: 0,
            cached: false
          }
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // No longer need separate Email Relay query - using direct provider → integration mapping

    if (!authorizedTools || authorizedTools.length === 0) {
      console.log(`[GetAgentTools] No authorized tools found for agent ${agent_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          tools: [],
          metadata: {
            agent_id,
            user_id,
            provider_count: 0,
            total_tools: 0,
            cached: false
          }
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Build tools using database-driven integration capabilities
    const tools: ToolDefinition[] = [];
    const toolNamesSeen = new Set<string>();
    const providersProcessed = new Set<string>();

    for (const permission of authorizedTools) {
      const provider = permission.user_integration_credentials.oauth_providers;
      const allowedScopes = permission.allowed_scopes || [];
      const providerName = provider.name;

      console.log(`[GetAgentTools] Processing ${provider.display_name} (${providerName}) with ${allowedScopes.length} scopes`);

      // For SMTP provider, use Email Relay integration capabilities
      if (providerName === 'smtp' && emailRelayIntegration) {
        const capabilities = emailRelayIntegration.integration_capabilities || [];
        console.log(`[GetAgentTools] Found ${capabilities.length} Email Relay capabilities for SMTP provider`);

        // Map capabilities to tools based on allowed scopes
        for (const capability of capabilities) {
          // Check if this capability is allowed by the agent's scopes
          if (allowedScopes.includes(capability.capability_key)) {
            const toolName = `smtp_${capability.capability_key}`; // Enforce smtp_ prefix
            
            // Avoid duplicates
            if (toolNamesSeen.has(toolName)) {
              continue;
            }
            
            // Create tool definition from capability
            const tool: ToolDefinition = {
              name: toolName,
              description: capability.display_label || `${capability.capability_key} via SMTP`,
              parameters: {
                type: 'object',
                properties: {
                  // Enhanced parameters based on capability type
                  ...(capability.capability_key === 'send_email' && {
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string', description: 'Email subject' },
                    body: { type: 'string', description: 'Email body content' },
                    from_name: { type: 'string', description: 'Sender name (optional)' }
                  }),
                  ...(capability.capability_key === 'email_templates' && {
                    template_name: { type: 'string', description: 'Template identifier' },
                    to: { type: 'string', description: 'Recipient email' },
                    variables: { type: 'object', description: 'Template variables' }
                  }),
                  ...(capability.capability_key === 'email_stats' && {
                    date_range: { type: 'string', description: 'Date range for stats (e.g., "7d", "30d")' }
                  })
                },
                required: capability.capability_key === 'send_email' 
                  ? ['to', 'subject', 'body'] 
                  : capability.capability_key === 'email_templates'
                    ? ['template_name', 'to']
                    : []
              }
            };
            
            toolNamesSeen.add(toolName);
            tools.push(tool);
            console.log(`[GetAgentTools] Added SMTP tool: ${toolName}`);
          }
        }
      }
      // Handle other providers (Gmail, SendGrid, etc.) similarly in the future
      else {
        console.log(`[GetAgentTools] Provider ${providerName} not yet implemented for database-driven discovery`);
      }

      providersProcessed.add(provider.display_name);
    }

    console.log(`[GetAgentTools] Retrieved ${tools.length} tools from ${providersProcessed.size} providers`);
    console.log(`[GetAgentTools] Providers: ${Array.from(providersProcessed).join(', ')}`);
    console.log(`[GetAgentTools] Tools: ${tools.map(t => t.name).join(', ')}`);

    const response: AgentToolsResponse = {
      success: true,
      tools,
      metadata: {
        agent_id,
        user_id,
        provider_count: providersProcessed.size,
        total_tools: tools.length,
        cached: false
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GetAgentTools] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
