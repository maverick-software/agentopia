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

// Export supabase client for use in other parts of the function
export { supabase };

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
 * Checks if agent has assigned media for Media Library tools
 */
export async function hasAgentDocuments(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent media assignments for agent ${agentId}, user ${userId}`);

  const { data: assignments, error } = await supabase
    .from('agent_media_assignments')
    .select('id')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);
  
  if (error) {
    console.error('[DatabaseService] Error checking agent media assignments:', error);
    return false;
  }

  console.log(`[DatabaseService] Found ${assignments?.length || 0} active media assignments`);
  return assignments && assignments.length > 0;
}

/**
 * Checks if agent has contact permissions
 */
export async function hasAgentContactPermissions(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent contact permissions for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: contactPermissions, error } = await supabase
      .from('agent_contact_permissions')
      .select('id')
      .eq('agent_id', agentId)
      .limit(1);
    
    if (error) {
      console.error('[DatabaseService] Error checking contact permissions:', error);
      return false;
    }

    const hasPermissions = contactPermissions && contactPermissions.length > 0;
    console.log(`[DatabaseService] Found ${contactPermissions?.length || 0} contact permission records`);
    return hasPermissions;
  } catch (error) {
    console.error('[DatabaseService] Error checking contact permissions:', error);
    return false;
  }
}

/**
 * Checks if agent has temporary chat links enabled in settings
 */
export async function hasTemporaryChatLinksEnabled(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for temporary chat links setting for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('metadata')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('[DatabaseService] Error fetching agent metadata:', error);
      return false;
    }

    const metadata = agent?.metadata || {};
    const settings = metadata.settings || {};
    const isEnabled = settings.temporary_chat_links_enabled === true;
    
    console.log(`[DatabaseService] Temporary chat links enabled: ${isEnabled}`);
    return isEnabled;
  } catch (error) {
    console.error('[DatabaseService] Error checking temporary chat links setting:', error);
    return false;
  }
}

/**
 * Check if agent has advanced reasoning enabled
 */
export async function hasAdvancedReasoningEnabled(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for advanced reasoning setting for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('metadata, reasoning_config')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error || !agent) {
      console.log(`[DatabaseService] Agent not found or error:`, error);
      return false;
    }

    // Check both locations where reasoning might be enabled
    // UI stores in metadata.settings.reasoning_enabled
    // Database trigger uses reasoning_config.enabled
    const metadata = agent?.metadata || {};
    const settings = metadata.settings || {};
    const reasoningConfig = agent?.reasoning_config || {};
    
    const reasoningEnabledInMetadata = settings.reasoning_enabled;
    const reasoningEnabledInConfig = reasoningConfig.enabled === true;
    
    // Use metadata setting if it's explicitly set (true or false), otherwise fall back to reasoning_config
    const reasoningEnabled = reasoningEnabledInMetadata !== undefined 
      ? reasoningEnabledInMetadata === true
      : reasoningEnabledInConfig;
    
    console.log(`[DatabaseService] Advanced reasoning enabled: ${reasoningEnabled} (metadata: ${reasoningEnabledInMetadata}, config: ${reasoningEnabledInConfig})`);
    return reasoningEnabled;
  } catch (error) {
    console.error(`[DatabaseService] Error checking advanced reasoning:`, error);
    return false;
  }
}

