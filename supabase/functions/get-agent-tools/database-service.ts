/**
 * Database service for agent tools queries
 * Handles all database interactions with proper error handling
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { AgentPermission, ServiceProvider } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Fetches agent integration permissions with user credentials
 */
export async function getAgentPermissions(agentId: string, userId: string) {
  console.log(`[DatabaseService] Fetching permissions for agent ${agentId}, user ${userId}`);

  const { data: permissions, error } = await supabase
    .from('agent_integration_permissions')
    .select(`
      allowed_scopes,
      is_active,
      permission_level,
      user_integration_credentials!agent_integration_permissions_user_oauth_connection_id_fkey(
        id,
        connection_name,
        oauth_provider_id,
        credential_type,
        connection_status,
        token_expires_at
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_integration_credentials.user_id', userId)
    .eq('is_active', true)
    .in('user_integration_credentials.connection_status', ['active', 'expired'])
    .order('granted_at', { ascending: false });
  
  if (error) {
    console.error('[DatabaseService] Error fetching permissions:', error);
    throw error;
  }

  return permissions as AgentPermission[];
}

/**
 * Fetches service provider details by IDs
 */
export async function getServiceProviders(providerIds: string[]) {
  console.log(`[DatabaseService] Fetching service providers for IDs: ${providerIds.join(', ')}`);

  const { data: providers, error } = await supabase
    .from('service_providers')
    .select('id, name, display_name')
    .in('id', providerIds);
  
  if (error) {
    console.error('[DatabaseService] Error fetching service providers:', error);
    throw error;
  }

  return providers as ServiceProvider[];
}

/**
 * Checks if agent has assigned documents for Media Library tools
 */
export async function hasAgentDocuments(agentId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent documents for agent ${agentId}`);

  const { data: documents, error } = await supabase
    .from('agent_documents')
    .select('document_id')
    .eq('agent_id', agentId)
    .limit(1);
  
  if (error) {
    console.error('[DatabaseService] Error checking agent documents:', error);
    return false;
  }

  return documents && documents.length > 0;
}

/**
 * Alternative method to check agent media assignments (if agent_documents doesn't exist)
 */
export async function hasAgentMediaAssignments(agentId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent media assignments for agent ${agentId}`);

  const { data: assignments, error } = await supabase
    .from('agent_media_assignments')
    .select('id')
    .eq('agent_id', agentId)
    .limit(1);
  
  if (error) {
    console.warn('[DatabaseService] Error checking agent media assignments (this may be expected):', error);
    return false;
  }

  return assignments && assignments.length > 0;
}
