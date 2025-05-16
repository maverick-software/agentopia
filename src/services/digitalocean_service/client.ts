// Forcing linter re-evaluation after tsconfig.node.json change.
import DotsWrapper from 'https://esm.sh/dots-wrapper@3.11.17'; // Try default import
const { createApiClient } = DotsWrapper; // Then destructure
// Removed: import { IAPIClient } from 'dots-wrapper/dist/client';
// Removed Supabase client import as it's no longer needed for vault operations here

// Define the type for the DigitalOcean API client based on the return type of createApiClient
export type DotsApiClient = ReturnType<typeof createApiClient>;

// Removed Supabase admin client initialization and getSecretFromVault function
// as we are now fetching the DO_API_TOKEN directly from environment variables.

let apiClientInstance: DotsApiClient | null = null;

/**
 * Initializes and returns the DigitalOcean API client.
 * Fetches the API token directly from environment variables.
 * @returns {Promise<DotsApiClient>} The initialized API client.
 * @throws {Error} If the API token is not configured or client initialization fails.
 */
export async function getDOClient(): Promise<DotsApiClient> {
  if (apiClientInstance) {
    return apiClientInstance;
  }

  const apiToken = Deno.env.get('DO_API_TOKEN');
  if (!apiToken) {
    console.error(
      'DigitalOcean API token (DO_API_TOKEN) is not configured in environment.'
    );
    throw new Error('DigitalOcean API token (DO_API_TOKEN) is not configured.');
  }

  try {
    apiClientInstance = createApiClient({ token: apiToken });
    console.info('DigitalOcean API client initialized successfully using DO_API_TOKEN from env.');
    return apiClientInstance;
  } catch (error) {
    console.error('Failed to initialize DigitalOcean API client:', error);
    // Ensure the error is typed or cast to access error.message if needed
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize DigitalOcean API client: ${errorMessage}`);
  }
}

// Removed getDOClientSync as direct env var retrieval simplifies initialization logic
// and async nature of getDOClient should be preferred. 