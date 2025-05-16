import axios from 'axios';

// --- Configuration ---
const AGENTOPIA_API_BASE_URL = process.env.AGENTOPIA_API_BASE_URL;
const DTMA_OWN_BEARER_TOKEN = process.env.DTMA_BEARER_TOKEN; // Renamed for clarity

if (!AGENTOPIA_API_BASE_URL) {
  console.error('CRITICAL: AGENTOPIA_API_BASE_URL environment variable is not set. DTMA cannot communicate with the backend.');
  // process.exit(1); // Consider exiting if this is a fatal startup error
}

if (!DTMA_OWN_BEARER_TOKEN) {
  console.error('CRITICAL: DTMA_BEARER_TOKEN environment variable is not set. DTMA cannot authenticate itself to the backend.');
  // process.exit(1); // Consider exiting
}

// --- API Client Instance ---
const apiClient = axios.create({
  baseURL: AGENTOPIA_API_BASE_URL,
  timeout: 15000, // 15 second timeout
});

// Add Authorization header interceptor
apiClient.interceptors.request.use((config) => {
  if (DTMA_OWN_BEARER_TOKEN) {
    config.headers.Authorization = `Bearer ${DTMA_OWN_BEARER_TOKEN}`;
  }
  // If token is somehow still not set here (despite initial check), 
  // the request might fail at the backend, or we could throw an error here.
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Types for API Payloads/Responses (Define more accurately based on backend implementation) ---
export interface DtmaHeartbeatPayload {
  dtma_version: string;
  system_status: Record<string, any>; // e.g., cpu, memory, disk
  tool_statuses: Array<{
    account_tool_instance_id: string;
    status_on_toolbox: string; // Should match 'account_tool_installation_status_enum' values
    runtime_details?: Record<string, any>;
  }>;
}

export interface AgentToolCredentialsRequestPayload {
  agentId: string;
  accountToolInstanceId: string;
}

// Assuming secrets are returned as a simple key-value pair
export type AgentToolCredentialsResponse = Record<string, string | null>; 

// --- API Functions ---

/**
 * Sends heartbeat data to the Agentopia backend.
 * @param heartbeatPayload - The data to send.
 */
export async function sendHeartbeat(heartbeatPayload: DtmaHeartbeatPayload): Promise<void> {
  try {
    console.log('Sending heartbeat...', JSON.stringify(heartbeatPayload, null, 2));
    // Endpoint updated as per WBS 1.4.1 (/dtma/heartbeat)
    const response = await apiClient.post('/dtma/heartbeat', heartbeatPayload);
    if (response.status === 200 || response.status === 204) { // Backend might return 200 with data or 204
        console.log(`Heartbeat sent successfully (status: ${response.status}).`);
    } else {
        console.warn(`Heartbeat API returned unexpected status: ${response.status}, data:`, response.data);
    }
  } catch (error: any) {
    console.error('Error sending heartbeat:', error.response?.data || error.message);
  }
}

/**
 * Fetches agent-specific credentials for a tool instance from the Agentopia backend.
 * Renamed from fetchToolSecrets and updated as per WBS 2.3.2 & 1.4.1.
 * @param payload - Object containing agentId and accountToolInstanceId.
 * @returns Promise<AgentToolCredentialsResponse | null> - Object containing secrets or null on error.
 */
export async function getAgentToolCredentials(
  payload: AgentToolCredentialsRequestPayload
): Promise<AgentToolCredentialsResponse | null> {
  try {
    console.log(`Fetching agent tool credentials for: agentId=${payload.agentId}, instanceId=${payload.accountToolInstanceId}`);
    // Endpoint and payload updated as per WBS 1.4.1 & 2.3.2
    const response = await apiClient.post('/dtma/get-agent-tool-credentials', payload);
    
    if (response.status === 200 && response.data) { // Expecting secrets directly in response.data
      console.log(`Agent tool credentials received successfully for: agentId=${payload.agentId}, instanceId=${payload.accountToolInstanceId}`);
      return response.data as AgentToolCredentialsResponse; // Assuming response.data is the secrets object
    } else {
      console.warn(`Get agent tool credentials API returned unexpected status ${response.status} or data format:`, response.data);
      return null;
    }
  } catch (error: any) {
    console.error(
        `Error fetching agent tool credentials for agentId=${payload.agentId}, instanceId=${payload.accountToolInstanceId}:`,
        error.response?.data || error.message
    );
    return null;
  }
} 