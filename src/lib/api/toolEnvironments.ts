import { supabase } from '../supabase'; // Assuming your Supabase client is exported from here

export interface ToolEnvironmentResponse {
  success: boolean;
  message?: string;
  data?: any; // Could be more specific, e.g., { status: string; ip_address?: string | null }
  error?: string;
}

/**
 * Activates or ensures the tool environment for a given agent.
 * Calls the Supabase Edge Function.
 */
export async function activateAgentToolEnvironment(agentId: string): Promise<ToolEnvironmentResponse> {
  if (!agentId) throw new Error('Agent ID is required to activate tool environment.');

  const { data, error } = await supabase.functions.invoke(
    `manage-agent-tool-environment/${agentId}`,
    {
      method: 'POST',
      // No body needed if agentId is in path and Edge Function extracts it from there
    }
  );

  if (error) {
    console.error('Error activating tool environment:', error);
    // Attempt to parse a more specific error message if the function returned a JSON error object
    try {
        const parsedError = JSON.parse(error.message);
        if (parsedError && parsedError.error) {
            throw new Error(parsedError.error);
        }
    } catch (e) { /* Ignore parsing error, throw original */ }
    throw new Error(error.message || 'Failed to activate tool environment.');
  }
  return data as ToolEnvironmentResponse; // Assuming the Edge function returns a compatible structure
}

/**
 * Deactivates the tool environment for a given agent.
 * Calls the Supabase Edge Function.
 */
export async function deactivateAgentToolEnvironment(agentId: string): Promise<ToolEnvironmentResponse> {
  if (!agentId) throw new Error('Agent ID is required to deactivate tool environment.');

  const { data, error } = await supabase.functions.invoke(
    `manage-agent-tool-environment/${agentId}`,
    {
      method: 'DELETE',
    }
  );

  if (error) {
    console.error('Error deactivating tool environment:', error);
    try {
        const parsedError = JSON.parse(error.message);
        if (parsedError && parsedError.error) {
            throw new Error(parsedError.error);
        }
    } catch (e) { /* Ignore parsing error, throw original */ }
    throw new Error(error.message || 'Failed to deactivate tool environment.');
  }
  return data as ToolEnvironmentResponse;
}

/**
 * Fetches the current status of the agent's tool environment.
 * (Placeholder - this might call a different endpoint or be part of agent data loading)
 */
export async function getAgentToolEnvironmentStatus(agentId: string): Promise<ToolEnvironmentResponse | null> {
    console.log(`API CALL (get status - placeholder) for agent ${agentId}`);
    // This function would typically fetch data from an endpoint that returns the agent_droplets record.
    // For now, returning a default inactive status as it's integrated into the main agent fetch.
    // If a dedicated status endpoint is created, this function would call it.
    // Example: 
    // const { data, error } = await supabase.from('agent_droplets').select('status, ip_address').eq('agent_id', agentId).single();
    // if (error) { ... }
    // return { success: true, data: { status: data?.status || 'inactive', ip_address: data?.ip_address }};
    return null; // Or a default state, since AgentEditPage now fetches this with the agent.
} 