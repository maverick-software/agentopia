import { supabase } from '../supabase'; // Adjust path if necessary
import type { Database, Json } from '../../types/database.types'; // Assuming database.types.ts is in src/types

// Type for a single tool instance, based on account_tool_instances.Row
export type AccountToolInstanceRecord = Database['public']['Tables']['account_tool_instances']['Row'];

// Type for the status enum, if needed separately
export type AccountToolInstanceStatus =
  Database['public']['Enums']['account_tool_installation_status_enum'];


// Reusable function to get auth headers
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        throw new Error('User not authenticated or session expired.');
    }
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

const getToolboxToolsApiUrl = (toolboxId: string, path?: string) => {
    // Use the proper Supabase functions URL pattern like other parts of the app
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
    }
    let url = `${supabaseUrl}/functions/v1/toolbox-tools/${toolboxId}/tools`;
    if (path) {
        url += path; // e.g., path = '/{toolInstanceId}/start'
    }
    return url;
};

/**
 * Lists all tool instances deployed to a specific toolbox.
 * @param toolboxId - The ID of the toolbox.
 * @returns {Promise<AccountToolInstanceRecord[]>} A promise that resolves to an array of tool instances.
 */
export const listToolInstancesForToolbox = async (toolboxId: string): Promise<AccountToolInstanceRecord[]> => {
    const headers = await getAuthHeaders(); 
    const response = await fetch(getToolboxToolsApiUrl(toolboxId), {
        method: 'GET',
        headers,
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`Error fetching tool instances for toolbox ${toolboxId}:`, errorData);
        throw new Error(errorData.message || `Failed to fetch tool instances. Status: ${response.status}`);
    }
    return response.json() as Promise<AccountToolInstanceRecord[]>;
};

// TODO: Add other functions for managing tool instances:
// - getToolInstanceById(toolboxId: string, toolInstanceId: string)
// - deployToolToToolbox(toolboxId: string, payload: DeployToolPayload) -> POST to /tools
// - removeToolFromToolbox(toolboxId: string, toolInstanceId: string) -> DELETE to /tools/{toolInstanceId}
// - startToolOnToolbox(toolboxId: string, toolInstanceId: string) -> POST to /tools/{toolInstanceId}/start
// - stopToolOnToolbox(toolboxId: string, toolInstanceId: string) -> POST to /tools/{toolInstanceId}/stop 