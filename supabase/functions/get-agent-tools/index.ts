/**
 * Get Agent Tools Edge Function (Refactored)
 * 
 * Returns all authorized MCP tools for an agent based on:
 * - Agent permissions (agent_integration_permissions)  
 * - User credentials (user_integration_credentials)
 * - Service providers (service_providers) - CURRENT APPROACH
 * 
 * Uses direct scope-to-tool mapping instead of deprecated database-driven discovery
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Import modular components
import { ToolDefinition, AgentToolsResponse } from './types.ts';
import { mapScopeToCapability, isScopeAllowed, normalizeToolName } from './scope-mapper.ts';
import { getCredentialStatus } from './credential-utils.ts';
import { generateParametersForCapability } from './tool-generator.ts';
import { 
  getAgentPermissions, 
  getServiceProviders,
  hasAgentDocuments,
  hasTemporaryChatLinksEnabled,
  hasAdvancedReasoningEnabled,
  supabase
} from './database-service.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get parameters from request body (Edge functions receive params in body)
    const { agent_id, user_id } = await req.json();
    
    if (!agent_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: agent_id and user_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GetAgentTools] Fetching tools for agent ${agent_id}, user ${user_id}`);

    // Get agent permissions with user credentials
    let authorizedTools;
    try {
      authorizedTools = await getAgentPermissions(agent_id, user_id);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique service provider IDs and fetch their details
    const serviceProviderIds = [...new Set(authorizedTools.map(tool => 
      tool.user_integration_credentials?.oauth_provider_id
    ).filter(Boolean))];
    
    let serviceProviders;
    try {
      serviceProviders = await getServiceProviders(serviceProviderIds);
    } catch (error: any) {
      console.error('[GetAgentTools] Service providers error:', error);
      serviceProviders = [];
    }
    
    // Create a map for quick lookup
    const serviceProviderMap = new Map();
    serviceProviders?.forEach(sp => {
      serviceProviderMap.set(sp.id, sp);
    });

    const tools: ToolDefinition[] = [];
    const providersProcessed = new Set<string>();

    // Check if Advanced Reasoning is enabled once, outside the loops
    const reasoningEnabled = await hasAdvancedReasoningEnabled(agent_id, user_id);
    console.log(`[GetAgentTools] Advanced Reasoning enabled: ${reasoningEnabled}`);

    // Process each authorized tool to generate MCP tools
    for (const toolData of authorizedTools) {
      if (!toolData.user_integration_credentials) {
        console.warn(`[GetAgentTools] Missing user_integration_credentials for tool data`);
        continue;
      }

      const credential = toolData.user_integration_credentials;
      const providerId = credential.oauth_provider_id;
      const provider = serviceProviderMap.get(providerId);
      
      if (!provider) {
        console.warn(`[GetAgentTools] Service provider not found for ID: ${providerId}`);
        continue;
      }

      const providerName = provider.name;
      const allowedScopes = toolData.allowed_scopes || [];

      // Skip if already processed this provider
      if (providersProcessed.has(providerName)) {
        continue;
      }

      console.log(`[GetAgentTools] Processing ${provider.display_name} (${providerName}) with ${allowedScopes.length} scopes`);

      // Get credential status
      const credentialStatus = getCredentialStatus(credential);

      // Generate tools directly from scopes using scope mapper
      for (const scope of allowedScopes) {
        const mappedCapabilities = mapScopeToCapability(scope, providerName);
        
        for (const capability of mappedCapabilities) {
          // Create provider-prefixed tool name (e.g., gmail_send_email)
          // But don't double-prefix if capability already has provider prefix
          // Special case for outlook which uses different prefix than provider name
          const providerPrefixedName = (providerName === 'microsoft-outlook' && capability.startsWith('outlook_'))
            ? capability  // Already has outlook_ prefix, use as-is
            : (providerName === 'clicksend_sms' && capability.startsWith('clicksend_'))
              ? capability  // ClickSend capabilities already have clicksend_ prefix
            : (providerName === 'contact_management')
              ? capability  // Contact management tools don't need prefix (search_contacts, get_contact_details)
            : capability.includes('_') && capability.startsWith(providerName.split('-')[0]) 
              ? capability  // Already has provider prefix
              : `${providerName}_${capability}`;  // Add provider prefix
          
          // Normalize tool name to be OpenAI-compatible (removes dots, etc.)
          const normalizedToolName = normalizeToolName(providerPrefixedName);
          
          // Skip reasoning tools if Advanced Reasoning is disabled
          // Check for any tool that starts with internal_system_ and contains reasoning
          if (!reasoningEnabled && (
            normalizedToolName.includes('reasoning') || 
            normalizedToolName.startsWith('internal_system_')
          )) {
            console.log(`[GetAgentTools] Skipping reasoning tool ${normalizedToolName} - Advanced Reasoning is disabled`);
            continue;
          }
          
          // Generate tool parameters
          const parameters = generateParametersForCapability(normalizedToolName);
          
          tools.push({
            name: normalizedToolName,
            description: `${capability} - ${provider.display_name}`,
            parameters,
            status: credentialStatus.status,
            error_message: credentialStatus.error_message,
            provider_name: provider.display_name || providerName,
            connection_name: credential.connection_name || 'Default Connection'
          });
        }
      }

      providersProcessed.add(providerName);
    }

    // Check for internal tools (Media Library)
    console.log(`[GetAgentTools] Checking for internal tools (Media Library)...`);
    
    let hasDocuments = false;
    try {
      hasDocuments = await hasAgentDocuments(agent_id, user_id);
    } catch (error) {
      console.warn(`[GetAgentTools] Error checking for agent media assignments:`, error);
    }

    if (hasDocuments) {
      console.log(`[GetAgentTools] Agent has assigned documents, adding Media Library MCP tools`);
      
      const mediaLibraryTools = [
        'search_documents',
        'get_document_content', 
        'list_assigned_documents',
        'get_document_summary',
        'find_related_documents',
        'reprocess_document'
      ];

      console.log(`[GetAgentTools] Tools: ${mediaLibraryTools.join(', ')}`);
      console.log(`[GetAgentTools] Added ${mediaLibraryTools.length} Media Library MCP tools`);
      console.log(`[GetAgentTools] Providers: Media Library`);

      for (const toolName of mediaLibraryTools) {
        const parameters = generateParametersForCapability(toolName);
        
        tools.push({
          name: toolName,
          description: `${toolName} - Media Library`,
          parameters,
          status: 'active',
          provider_name: 'Media Library',
          connection_name: 'Internal'
        });
      }

      providersProcessed.add('Media Library');
    }

    // Check for internal tools (Temporary Chat Links)
    console.log(`[GetAgentTools] Checking for internal tools (Temporary Chat Links)...`);
    
    let hasTempChatEnabled = false;
    try {
      hasTempChatEnabled = await hasTemporaryChatLinksEnabled(agent_id, user_id);
    } catch (error) {
      console.warn(`[GetAgentTools] Error checking for temporary chat links setting:`, error);
    }

    if (hasTempChatEnabled) {
      console.log(`[GetAgentTools] Agent has temporary chat links enabled, adding Temporary Chat MCP tools`);
      
      const tempChatTools = [
        'create_temporary_chat_link',
        'list_temporary_chat_links',
        'update_temporary_chat_link',
        'delete_temporary_chat_link',
        'get_temporary_chat_analytics',
        'manage_temporary_chat_session'
      ];

      console.log(`[GetAgentTools] Tools: ${tempChatTools.join(', ')}`);
      console.log(`[GetAgentTools] Added ${tempChatTools.length} Temporary Chat MCP tools`);
      console.log(`[GetAgentTools] Providers: Temporary Chat Links`);

      for (const toolName of tempChatTools) {
        const parameters = generateParametersForCapability(toolName);
        
        tools.push({
          name: toolName,
          description: `${toolName} - Temporary Chat Links`,
          parameters,
          status: 'active',
          provider_name: 'Temporary Chat Links',
          connection_name: 'Internal'
        });
      }

      providersProcessed.add('Temporary Chat Links');
    }

    // Contact Management tools are now handled through the standard integration system
    // They will be processed automatically with other integrations above

    // Check for Zapier MCP tools
    console.log(`[GetAgentTools] Checking for Zapier MCP tools...`);
    
    try {
      const { data: mcpTools, error: mcpError } = await supabase
        .rpc('get_agent_mcp_tools', { p_agent_id: agent_id });

      if (mcpError) {
        console.warn(`[GetAgentTools] Error fetching MCP tools:`, mcpError);
      } else if (mcpTools && mcpTools.length > 0) {
        console.log(`[GetAgentTools] Found ${mcpTools.length} MCP tools for agent ${agent_id}`);
        
        for (const mcpTool of mcpTools) {
          if (mcpTool.openai_schema && mcpTool.tool_name) {
            tools.push({
              name: mcpTool.tool_name,
              description: mcpTool.openai_schema.description || `${mcpTool.tool_name} - MCP Tool`,
              parameters: mcpTool.openai_schema.parameters || {},
              status: 'active',
              provider_name: 'Zapier MCP',
              connection_name: mcpTool.connection_name || 'MCP Server'
            });
          }
        }

        console.log(`[GetAgentTools] Added ${mcpTools.length} Zapier MCP tools`);
        console.log(`[GetAgentTools] MCP Tools: ${mcpTools.map(t => t.tool_name).join(', ')}`);
        providersProcessed.add('Zapier MCP');
      } else {
        console.log(`[GetAgentTools] No MCP tools found for agent ${agent_id}`);
      }
    } catch (mcpError) {
      console.warn(`[GetAgentTools] Error checking for MCP tools:`, mcpError);
    }

    console.log(`[GetAgentTools] Retrieved ${tools.length} tools from ${providersProcessed.size} providers`);
    console.log(`[GetAgentTools] Providers: ${Array.from(providersProcessed).join(', ')}`);

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

  } catch (error: any) {
    console.error(`[GetAgentTools] Unexpected error: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
