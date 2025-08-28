/**
 * Get Agent Tools Edge Function
 * 
 * Returns all authorized MCP tools for an agent based on:
 * - Agent permissions (agent_integration_permissions)  
 * - User credentials (user_integration_credentials)
 * - Provider definitions (oauth_providers)
 * 
 * Uses hardcoded provider->tool mappings since tool_definitions 
 * are not stored in database
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

// Provider -> Tool mappings (since tools are not stored in database)
const PROVIDER_TOOL_MAPPINGS: Record<string, Record<string, ToolDefinition[]>> = {
  gmail: {
    'https://www.googleapis.com/auth/gmail.readonly': [
      {
        name: 'gmail_read_emails',
        description: 'Read emails from Gmail inbox',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for emails' },
            max_results: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'gmail_search_emails',
        description: 'Search emails in Gmail',
        parameters: {
          type: 'object', 
          properties: {
            query: { type: 'string', description: 'Gmail search query' },
            max_results: { type: 'number', description: 'Maximum results', default: 10 }
          },
          required: ['query']
        }
      }
    ],
    'https://www.googleapis.com/auth/gmail.send': [
      {
        name: 'gmail_send_email',
        description: 'Send email via Gmail',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            cc: { type: 'string', description: 'CC recipients (optional)' },
            bcc: { type: 'string', description: 'BCC recipients (optional)' }
          },
          required: ['to', 'subject', 'body']
        }
      }
    ],
    'https://www.googleapis.com/auth/gmail.modify': [
      {
        name: 'gmail_email_actions',
        description: 'Perform actions on Gmail emails (mark read, archive, etc.)',
        parameters: {
          type: 'object',
          properties: {
            message_id: { type: 'string', description: 'Gmail message ID' },
            action: { type: 'string', enum: ['mark_read', 'mark_unread', 'archive', 'delete'], description: 'Action to perform' }
          },
          required: ['message_id', 'action']
        }
      }
    ]
  },
  
  serper_api: {
    'web_search': [
      {
        name: 'web_search',
        description: 'Search the web using Serper API',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            num_results: { type: 'number', description: 'Number of results', default: 10 },
            country: { type: 'string', description: 'Country code for localized results', default: 'us' }
          },
          required: ['query']
        }
      }
    ],
    'news_search': [
      {
        name: 'news_search',
        description: 'Search news articles using Serper API', 
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'News search query' },
            num_results: { type: 'number', description: 'Number of results', default: 10 }
          },
          required: ['query']
        }
      }
    ],
    'image_search': [
      {
        name: 'image_search',
        description: 'Search images using Serper API',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Image search query' },
            num_results: { type: 'number', description: 'Number of results', default: 10 }
          },
          required: ['query']
        }
      }
    ],
    'local_search': [
      {
        name: 'local_search',
        description: 'Search local businesses using Serper API',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Local search query' },
            location: { type: 'string', description: 'Location for local search' }
          },
          required: ['query', 'location']
        }
      }
    ]
  },
  
  smtp: {
    'send_email': [
      {
        name: 'smtp_send_email',
        description: 'Send email via SMTP server',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            from_name: { type: 'string', description: 'Sender name (optional)' }
          },
          required: ['to', 'subject', 'body']
        }
      }
    ],
    'email_templates': [
      {
        name: 'smtp_email_templates',
        description: 'Send templated emails via SMTP',
        parameters: {
          type: 'object',
          properties: {
            template_name: { type: 'string', description: 'Template identifier' },
            to: { type: 'string', description: 'Recipient email' },
            variables: { type: 'object', description: 'Template variables' }
          },
          required: ['template_name', 'to']
        }
      }
    ],
    'email_stats': [
      {
        name: 'smtp_email_stats',
        description: 'Get SMTP email sending statistics',
        parameters: {
          type: 'object',
          properties: {
            date_range: { type: 'string', description: 'Date range for stats (e.g., "7d", "30d")' }
          }
        }
      }
    ]
  }
};

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

    // Single unified query for all authorized tools
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

    // Build tools using provider mappings
    const tools: ToolDefinition[] = [];
    const toolNamesSeen = new Set<string>();
    const providersProcessed = new Set<string>();

    for (const permission of authorizedTools) {
      const provider = permission.user_integration_credentials.oauth_providers;
      const allowedScopes = permission.allowed_scopes || [];
      const providerName = provider.name;

      console.log(`[GetAgentTools] Processing ${provider.display_name} (${providerName}) with ${allowedScopes.length} scopes`);

      const providerMappings = PROVIDER_TOOL_MAPPINGS[providerName.toLowerCase()];
      if (!providerMappings) {
        console.warn(`[GetAgentTools] No tool mappings found for provider: ${providerName}`);
        continue;
      }

      // Map each allowed scope to its tools
      for (const scope of allowedScopes) {
        const scopeTools = providerMappings[scope] || [];
        
        for (const tool of scopeTools) {
          // Avoid duplicates
          if (toolNamesSeen.has(tool.name)) {
            continue;
          }
          
          toolNamesSeen.add(tool.name);
          tools.push(tool);
        }
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
