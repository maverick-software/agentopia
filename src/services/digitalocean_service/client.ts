import { createApiClient } from 'dots-wrapper';
import { IAPIClient } from 'dots-wrapper/dist/client'; // Correct import path for IAPIClient if needed

// Placeholder for a function that securely retrieves secrets from Supabase Vault
// This should be implemented as part of the Agentopia backend's existing secret management.
async function getSecretFromVault(secretName: string): Promise<string | undefined> {
  // In a real scenario, this would interact with Supabase Vault.
  // For now, it might try to read from an environment variable or return a placeholder.
  // Ensure this is securely implemented in the actual backend.
  console.warn(`Attempting to get secret: ${secretName}. Ensure this is securely implemented.`);
  if (secretName === 'DIGITALOCEAN_API_TOKEN') {
    // return process.env.DIGITALOCEAN_API_TOKEN; // Example for Node.js environment
    return 'YOUR_DO_API_TOKEN_PLACEHOLDER'; // TODO: Replace with actual secure retrieval
  }
  return undefined;
}

let apiClientInstance: IAPIClient | null = null;

/**
 * Initializes and returns the DigitalOcean API client.
 * Fetches the API token from a secure vault.
 * @returns {Promise<IAPIClient>} The initialized API client.
 * @throws {Error} If the API token cannot be retrieved or client initialization fails.
 */
export async function getDOClient(): Promise<IAPIClient> {
  if (apiClientInstance) {
    return apiClientInstance;
  }

  const apiToken = await getSecretFromVault('DIGITALOCEAN_API_TOKEN');

  if (!apiToken || apiToken === 'YOUR_DO_API_TOKEN_PLACEHOLDER') {
    // In a real app, you might throw an error or have a more robust fallback/logging
    console.error('DigitalOcean API token is not configured. Please set it in Vault.');
    throw new Error('DigitalOcean API token is not configured.');
  }

  try {
    apiClientInstance = createApiClient({ token: apiToken });
    console.info('DigitalOcean API client initialized successfully.');
    return apiClientInstance;
  } catch (error) {
    console.error('Failed to initialize DigitalOcean API client:', error);
    throw new Error('Failed to initialize DigitalOcean API client.');
  }
}

// Optional: A way to get the client synchronously if it's guaranteed to be initialized
// Use with caution, prefer getDOClient for async safety.
export function getDOClientSync(): IAPIClient {
  if (!apiClientInstance) {
    throw new Error('DigitalOcean API client has not been initialized. Call getDOClient() first.');
  }
  return apiClientInstance;
} 