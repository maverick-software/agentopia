import { SupabaseClient } from '@supabase/supabase-js';
import { EnhancedMCPServer } from '../../mcpService';
import { StatusUpdate } from '../types';

export async function fetchServersForSync(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('account_tool_instances')
    .select(`
      id,
      instance_name_on_toolbox,
      status_on_toolbox,
      last_heartbeat_from_dtma,
      mcp_server_type,
      account_tool_environment:account_tool_environments(
        id,
        name,
        public_ip_address,
        region_slug,
        size_slug
      )
    `)
    .not('mcp_server_type', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch MCP servers: ${error.message}`);
  }

  return data || [];
}

export async function fetchServerForSync(supabase: SupabaseClient, serverId: string) {
  const { data, error } = await supabase
    .from('account_tool_instances')
    .select(`
      id,
      instance_name_on_toolbox,
      status_on_toolbox,
      last_heartbeat_from_dtma,
      account_tool_environment:account_tool_environments(
        public_ip_address,
        region_slug,
        size_slug
      )
    `)
    .eq('id', serverId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch server ${serverId}: ${error.message}`);
  }

  return data;
}

export async function fetchAllMCPServersRaw(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('account_tool_instances')
    .select(`
      id,
      instance_name_on_toolbox,
      status_on_toolbox,
      last_heartbeat_from_dtma,
      created_at,
      updated_at,
      mcp_server_type,
      mcp_transport_type,
      mcp_endpoint_path,
      mcp_server_capabilities,
      mcp_discovery_metadata,
      account_tool_environment:account_tool_environments(
        id,
        name,
        public_ip_address,
        region_slug,
        size_slug
      )
    `)
    .not('mcp_server_type', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch MCP servers: ${error.message}`);
  }

  return data || [];
}

export async function fetchMCPServerByIdRaw(supabase: SupabaseClient, serverId: string) {
  const { data, error } = await supabase
    .from('account_tool_instances')
    .select(`
      id,
      instance_name_on_toolbox,
      status_on_toolbox,
      last_heartbeat_from_dtma,
      created_at,
      updated_at,
      mcp_server_type,
      mcp_transport_type,
      mcp_endpoint_path,
      mcp_server_capabilities,
      mcp_discovery_metadata,
      account_tool_environment:account_tool_environments(
        id,
        name,
        public_ip_address,
        region_slug,
        size_slug
      )
    `)
    .eq('id', serverId)
    .not('mcp_server_type', 'is', null)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function fetchStatusHistory(
  supabase: SupabaseClient,
  serverId: string,
  hours: number
): Promise<StatusUpdate[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('mcp_server_status_logs')
    .select('*')
    .eq('server_id', serverId)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch status history: ${error.message}`);
  }

  return (data || []).map((log: any) => ({
    serverId: log.server_id,
    previousStatus: log.previous_status,
    currentStatus: log.current_status,
    timestamp: new Date(log.timestamp),
    source: log.source,
    details: log.details
  }));
}

export async function insertStatusChangeLog(supabase: SupabaseClient, update: StatusUpdate): Promise<void> {
  await supabase.from('mcp_server_status_logs').insert({
    server_id: update.serverId,
    previous_status: update.previousStatus,
    current_status: update.currentStatus,
    timestamp: update.timestamp.toISOString(),
    source: update.source,
    details: update.details
  });
}

export function mapRawToEnhancedServers(
  records: any[],
  transform: (record: any) => EnhancedMCPServer
): EnhancedMCPServer[] {
  return records.map(transform);
}

