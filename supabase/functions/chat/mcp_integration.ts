import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';
import { ChatMessage } from './context_builder.ts';

// MCP-related interfaces
interface MCPVaultResponse {
  key: string;
  version: number;
  created_at: string;
}

interface MCPConfigurationWithServer {
  id: number;
  agent_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  timeout_ms: number;
  max_retries: number;
  retry_backoff_ms: number;
  server: {
    id: number;
    endpoint_url: string;
    vault_api_key_id: string | null;
  };
}

/**
 * Fetches active MCP configurations for an agent, including server details
 * @param agentId - The ID of the agent to fetch MCP configurations for
 * @param supabaseClient - Supabase client instance
 * @returns Array of MCP server configurations
 */
export async function getMCPConfigurations(agentId: string, supabaseClient: SupabaseClient): Promise<MCPServerConfig[]> {
  try {
    const { data: configs, error } = await supabaseClient
      .from('mcp_configurations')
      .select(`
        id,
        agent_id,
        timeout_ms,
        max_retries,
        retry_backoff_ms,
        priority,
        is_active,
        server:mcp_servers (
          id,
          name,
          endpoint_url,
          vault_api_key_id
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching MCP configurations:', error);
      return [];
    }

    if (!configs || configs.length === 0) {
      console.log(`No active MCP configurations found for agent ${agentId}`);
      return [];
    }

    // Transform the data to match MCPServerConfig interface
    const mcpConfigs: MCPServerConfig[] = configs
      .filter(config => config.server) // Ensure server data exists
      .map(config => ({
        id: config.id,
        agentId: config.agent_id,
        name: config.server.name || 'Unnamed MCP Server',
        endpointUrl: config.server.endpoint_url,
        apiKeyVaultId: config.server.vault_api_key_id,
        timeout: config.timeout_ms || 30000,
        maxRetries: config.max_retries || 3,
        retryBackoffMs: config.retry_backoff_ms || 1000,
        priority: config.priority || 100,
        isActive: config.is_active
      }));

    console.log(`Found ${mcpConfigs.length} active MCP configurations for agent ${agentId}`);
    return mcpConfigs;

  } catch (error) {
    console.error(`Unexpected error fetching MCP configurations for agent ${agentId}:`, error);
    return [];
  }
}

/**
 * Retrieves an API key from Supabase Vault
 * @param vaultKeyId - The ID of the key in Supabase Vault
 * @param supabaseClient - Supabase client instance
 * @returns The decrypted API key or null if retrieval fails
 */
export async function getVaultAPIKey(vaultKeyId: string, supabaseClient: SupabaseClient): Promise<string | null> {
  try {
    console.log(`Attempting to retrieve vault key: ${vaultKeyId}`);
    
    const { data, error } = await supabaseClient.rpc('get_secret', {
      secret_name: vaultKeyId
    });

    if (error) {
      console.error(`Vault RPC error for key ${vaultKeyId}:`, error);
      return null;
    }

    if (!data) {
      console.warn(`No data returned from vault for key ${vaultKeyId}`);
      return null;
    }

    console.log(`Successfully retrieved vault key: ${vaultKeyId}`);
    return data;

  } catch (error) {
    console.error(`Unexpected error retrieving vault key ${vaultKeyId}:`, error);
    return null;
  }
}

/**
 * Prepares context data for MCP servers
 * @param messages - Chat message history
 * @param agentId - The ID of the agent
 * @param agentName - The name of the agent
 * @param agentPersonality - The personality of the agent
 * @param systemInstructions - System instructions for the agent
 * @param assistantInstructions - Assistant instructions for the agent
 * @returns Array of context data for MCP processing
 */
export async function prepareMCPContext(
  messages: ChatMessage[],
  agentId: string,
  agentName: string,
  agentPersonality: string,
  systemInstructions?: string,
  assistantInstructions?: string
): Promise<AgentopiaContextData[]> {
  const contextData: AgentopiaContextData[] = [];

  // Add agent identity context
  contextData.push({
    type: 'agent_identity',
    content: {
      id: agentId,
      name: agentName,
      personality: agentPersonality,
      systemInstructions: systemInstructions || '',
      assistantInstructions: assistantInstructions || ''
    },
    timestamp: new Date().toISOString(),
    priority: 100
  });

  // Add recent chat messages as context
  if (messages && messages.length > 0) {
    const recentMessages = messages.slice(-5); // Last 5 messages for context
    contextData.push({
      type: 'chat_history',
      content: {
        messages: recentMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          agentName: msg.agentName
        }))
      },
      timestamp: new Date().toISOString(),
      priority: 90
    });
  }

  return contextData;
}

/**
 * Processes MCP context and retrieves results from MCP servers
 * @param agentId - The ID of the agent
 * @param mcpContext - Prepared context data for MCP processing
 * @param supabaseClient - Supabase client instance
 * @returns Formatted MCP resource context string or null
 */
export async function processMCPContext(
  agentId: string,
  mcpContext: AgentopiaContextData[],
  supabaseClient: SupabaseClient
): Promise<string | null> {
  try {
    const mcpConfigs = await getMCPConfigurations(agentId, supabaseClient);
    
    if (mcpConfigs.length === 0) {
      return null;
    }

    // Create MCP manager with vault key retrieval function
    const vaultKeyRetriever = (vaultKeyId: string) => getVaultAPIKey(vaultKeyId, supabaseClient);
    const mcpManager = new MCPManager(mcpConfigs, vaultKeyRetriever);
    
    // Process context through MCP servers
    const mcpResults = await mcpManager.processContext(mcpContext);
    
    if (!mcpResults || mcpResults.resources.length === 0) {
      return null;
    }

    // Format MCP results for context
    const formattedContext = 'External Context from MCP Servers:\n\n' + 
      mcpResults.resources.map(r => `${r.type} (${r.id}):\n${JSON.stringify(r.content)}`).join('\n\n');

    // Log any errors encountered
    if (mcpResults.errors && mcpResults.errors.length > 0) {
      console.warn(`MCP processing encountered errors for agent ${agentId}:`, mcpResults.errors);
    }

    return formattedContext;

  } catch (error) {
    console.error(`Critical error during MCP processing for agent ${agentId}:`, error);
    return null;
  }
} 