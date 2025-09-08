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
import { mapScopeToCapability, isScopeAllowed } from './scope-mapper.ts';
import { getCredentialStatus } from './credential-utils.ts';
import { generateParametersForCapability } from './tool-generator.ts';
import { 
  getAgentPermissions, 
  getServiceProviders, 
  hasAgentDocuments, 
  hasAgentMediaAssignments 
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
          // Generate tool parameters
          const parameters = generateParametersForCapability(capability);
          
          tools.push({
            name: capability,
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
      hasDocuments = await hasAgentDocuments(agent_id);
      if (!hasDocuments) {
        // Fallback to check agent_media_assignments table
        hasDocuments = await hasAgentMediaAssignments(agent_id);
      }
    } catch (error) {
      console.warn(`[GetAgentTools] Error checking for agent documents:`, error);
    }

    if (hasDocuments) {
      console.log(`[GetAgentTools] Agent has assigned documents, adding Media Library MCP tools`);
      
      const mediaLibraryTools = [
        'search_documents',
        'get_document_content', 
        'list_assigned_documents',
        'get_document_summary',
        'find_related_documents'
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
