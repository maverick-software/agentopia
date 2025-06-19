import axios from 'axios';
import fs from 'fs/promises';

// --- Configuration ---
// TODO: Move configuration loading to a dedicated module
const DTMA_CONFIG_PATH = '/etc/dtma.conf'; 
// Default to local Supabase URL but handle Netlify URL format if provided
const AGENTOPIA_API_BASE_URL = process.env.AGENTOPIA_API_BASE_URL || 'http://localhost:54321/functions/v1'; 

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

// Load API base URL from config
async function getApiBaseUrl(): Promise<string> {
  try {
    const configContent = await fs.readFile(DTMA_CONFIG_PATH, 'utf-8');
    const match = configContent.match(/^AGENTOPIA_API_BASE_URL=(\S+)$/m);
    if (match && match[1]) {
      const apiUrl = match[1];
      console.log(`API base URL loaded from config: ${apiUrl}`);
      return apiUrl;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Could not load API base URL from config: ${errorMessage}`);
  }
  
  console.log(`Using default API base URL: ${AGENTOPIA_API_BASE_URL}`);
  return AGENTOPIA_API_BASE_URL;
}

// Initialize token on load
getDtmaAuthToken();

// --- API Client Instance ---
let apiClient: ReturnType<typeof axios.create>;

// Initialize the API client with the correct URL
async function initializeApiClient() {
  const baseURL = await getApiBaseUrl();
  
  apiClient = axios.create({
    baseURL,
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
  
  console.log('API client initialized with base URL:', baseURL);
}

// Initialize the API client
initializeApiClient();

// --- API Functions ---

/**
 * Sends heartbeat data to the Agentopia backend.
 * @param heartbeatPayload - The data to send (dtma_version, system_status, etc.)
 */
export async function sendHeartbeat(heartbeatPayload: any): Promise<void> {
  try {
    // Make sure API client is initialized
    if (!apiClient) await initializeApiClient();
    
    console.log('Sending heartbeat...', heartbeatPayload);
    
    // Check for offline mode
    if (await isOfflineMode()) {
      console.log('[OFFLINE] Would send heartbeat to /heartbeat');
      console.log('[OFFLINE] With payload:', JSON.stringify(heartbeatPayload, null, 2));
      return;
    }
    
    const response = await apiClient.post('/heartbeat', heartbeatPayload);
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
    // Make sure API client is initialized
    if (!apiClient) await initializeApiClient();
    
    console.log(`Fetching secrets for tool instance: ${toolInstanceDbId}`);
    
    // Check for offline mode
    if (await isOfflineMode()) {
      console.log('[OFFLINE] Would fetch secrets from /fetch-tool-secrets');
      console.log('[OFFLINE] With tool instance ID:', toolInstanceDbId);
      return { dummy_secret: 'offline_mode_secret_value' };
    }
    
    const response = await apiClient.post('/fetch-tool-secrets', {
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

/**
 * Check if DTMA is running in offline mode
 * @returns Promise<boolean> - True if in offline mode, false otherwise
 */
export async function isOfflineMode(): Promise<boolean> {
  try {
    const configContent = await fs.readFile(DTMA_CONFIG_PATH, 'utf-8');
    return configContent.includes('OFFLINE_MODE=true');
  } catch (err) {
    console.error('Error checking offline mode:', err);
    return false;
  }
} 