import type { SupabaseClient } from '@supabase/supabase-js';
import type { MCPServer } from '../mcp/ui-types';
import { EnhancedMCPServer } from './mcpService.types';
import { MCP_SERVER_SELECT, transformToEnhancedMCPServer } from './mcpService.helpers';

export async function getServersOperation(supabase: SupabaseClient): Promise<EnhancedMCPServer[]> {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('account_tool_instances')
      .select(MCP_SERVER_SELECT)
      .eq('account_tool_environment.user_id', user.id)
      .not('mcp_server_type', 'is', null)
      .order('instance_name_on_toolbox');

    if (error) {
      console.error('Error fetching MCP servers:', error);
      throw new Error(`Failed to fetch MCP servers: ${error.message}`);
    }

    return (data || []).map(transformToEnhancedMCPServer);
  } catch (error) {
    console.error('Error in getServers:', error);
    throw error instanceof Error ? error : new Error('Unknown error in getServers');
  }
}

export async function getServerByIdOperation(
  supabase: SupabaseClient,
  serverId: string
): Promise<EnhancedMCPServer | null> {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('account_tool_instances')
      .select(MCP_SERVER_SELECT)
      .eq('id', serverId)
      .eq('account_tool_environment.user_id', user.id)
      .not('mcp_server_type', 'is', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch MCP server: ${error.message}`);
    }

    return transformToEnhancedMCPServer(data);
  } catch (error) {
    console.error(`Error fetching server ${serverId}:`, error);
    throw error instanceof Error ? error : new Error(`Unknown error fetching server ${serverId}`);
  }
}

export function stripEnhancedServerToMCPServer(enhancedServer: EnhancedMCPServer): MCPServer {
  const {
    environment,
    endpoint,
    lastHeartbeat,
    serverType,
    transport,
    discoveryMetadata,
    ...originalServer
  } = enhancedServer;
  return originalServer;
}
