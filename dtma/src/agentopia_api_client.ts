import axios from 'axios';
import fs from 'fs/promises';

// --- Configuration ---
// TODO: Move configuration loading to a dedicated module
const DTMA_CONFIG_PATH = '/etc/dtma.conf'; 
const AGENTOPIA_API_BASE_URL = process.env.AGENTOPIA_API_BASE_URL || 'http://localhost:54321/functions/v1'; // Default to local Supabase URL

let dtmaAuthToken: string | null = null;

async function getDtmaAuthToken(): Promise<string> {
  if (dtmaAuthToken) return dtmaAuthToken;
  try {
    const configContent = await fs.readFile(DTMA_CONFIG_PATH, 'utf-8');
    const match = configContent.match(/^DTMA_AUTH_TOKEN=(\S+)$/m);
    if (match && match[1]) {
      dtmaAuthToken = match[1];
      console.log('DTMA auth token loaded for API client.');
      return dtmaAuthToken;
    }
    throw new Error(`Could not parse DTMA_AUTH_TOKEN from ${DTMA_CONFIG_PATH}.`);
  } catch (error: any) {
    console.error(`Fatal: Failed to load DTMA auth token: ${error.message}`);
    // If the token can't load, the DTMA cannot function. Exit or throw fatal.
    // For now, throw to prevent operations without auth.
    throw new Error(`DTMA Auth Token load failed: ${error.message}`);
  }
}

// Initialize token on load
getDtmaAuthToken();

// --- API Client Instance ---
const apiClient = axios.create({
  baseURL: AGENTOPIA_API_BASE_URL,
  timeout: 15000, // 15 second timeout
});

// Add Authorization header interceptor
apiClient.interceptors.request.use(async (config) => {
  const token = await getDtmaAuthToken(); // Ensure token is loaded
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- API Functions ---

/**
 * Sends heartbeat data to the Agentopia backend.
 * @param heartbeatPayload - The data to send (dtma_version, system_status, etc.)
 */
export async function sendHeartbeat(heartbeatPayload: any): Promise<void> {
  try {
    console.log('Sending heartbeat...', heartbeatPayload);
    const response = await apiClient.post('/heartbeat', heartbeatPayload); // Endpoint defined in WBS 2.1.5
    if (response.status === 204) {
        console.log('Heartbeat sent successfully.');
    } else {
        // Log unexpected success status
        console.warn(`Heartbeat API returned unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Error sending heartbeat:', error.response?.data || error.message);
    // Decide if this error should be propagated or just logged
  }
}

/**
 * Fetches secrets for a specific tool instance from the Agentopia backend.
 * @param toolInstanceDbId - The database ID of the agent_droplet_tools entry.
 * @returns Promise<{ [key: string]: string | null } | null> - Object containing secrets or null on error.
 */
export async function fetchToolSecrets(toolInstanceDbId: string): Promise<{ [key: string]: string | null } | null> {
  try {
    console.log(`Fetching secrets for tool instance: ${toolInstanceDbId}`);
    const response = await apiClient.post('/fetch-tool-secrets', { // Endpoint defined in WBS 2.1.6
        tool_instance_db_id: toolInstanceDbId 
    }); 
    
    if (response.status === 200 && response.data?.secrets) {
      console.log(`Secrets received successfully for tool instance: ${toolInstanceDbId}`);
      return response.data.secrets;
    } else {
      console.warn(`Fetch secrets API returned unexpected status or data format: ${response.status}`);
      return null;
    }
  } catch (error: any) {
    console.error(`Error fetching secrets for tool ${toolInstanceDbId}:`, error.response?.data || error.message);
    return null; // Return null or throw, depending on how critical this is for the caller
  }
} 