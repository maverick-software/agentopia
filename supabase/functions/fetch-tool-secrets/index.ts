import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Database, Json } from '../_shared/database.types.ts' // Added Json import

console.log('Fetch-Tool-Secrets function starting...');

// CORS Headers (ensure consistency, restrict origin in prod)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // POST is used currently
};

// Helper to create Supabase admin client (can be moved to _shared)
function getSupabaseAdminClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured for Edge Function.');
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

// Interface for the structure within tool_catalog.required_secrets_schema
interface RequiredSecretSchemaEntry {
  name: string; // User-friendly name of the secret
  env_var_name: string; // The environment variable name the tool expects
  description?: string;
}

// Structure assumed in agent_droplet_tools.config_values for storing the mapping
interface ConfiguredSecretVaultIDs {
  [env_var_name: string]: string; // e.g., { "OPENAI_API_KEY": "vault-uuid-for-openai-key" }
}

serve(async (req) => {
  console.log('Fetch-Tool-Secrets request received:', req.method, req.url);

  // Handle OPTIONS pre-flight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // We expect a POST request with tool_instance_db_id in the body
  // Or a GET request like /fetch-tool-secrets/tool-instance-uuid (more RESTful)
  // Let's use POST for now, assuming DTMA knows its agent_droplet_tools.id
  if (req.method !== 'POST') { 
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Extract DTMA Bearer token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid DTMA token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const dtmaAuthToken = authHeader.substring(7);

  // 2. Get tool_instance_db_id from request payload
  let toolInstanceDbId: string;
  try {
    const payload = await req.json();
    toolInstanceDbId = payload.tool_instance_db_id;
    if (!toolInstanceDbId) throw new Error('tool_instance_db_id is required in payload.');
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Invalid JSON payload: ${e.message}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient(req);

    // 3. Validate DTMA token and get associated droplet ID
    const { data: dropletData, error: dropletAuthError } = await supabaseAdmin
      .from('agent_droplets')
      .select('id') // Select only the ID for verification
      .eq('dtma_auth_token', dtmaAuthToken)
      .single();

    if (dropletAuthError || !dropletData) {
      const status = dropletAuthError?.code === 'PGRST116' ? 401 : 500;
      const message = dropletAuthError?.code === 'PGRST116' ? 'Unauthorized: Invalid DTMA token' : 'Could not verify DTMA token';
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const agentDropletId = dropletData.id;

    // 4. Fetch the agent_droplet_tools record and its corresponding tool_catalog entry
    // Ensure the tool instance belongs to the authenticated droplet.
    const { data: toolInstanceData, error: toolFetchError } = await supabaseAdmin
      .from('agent_droplet_tools')
      .select(`
        id,
        agent_droplet_id,
        config_values, 
        tool_catalog (
          required_secrets_schema
        )
      `)
      .eq('id', toolInstanceDbId)
      .eq('agent_droplet_id', agentDropletId) // Crucial security check
      .single();

    if (toolFetchError || !toolInstanceData) {
      const status = toolFetchError?.code === 'PGRST116' ? 404 : 500;
      const message = toolFetchError?.code === 'PGRST116' ? 'Tool instance not found or not associated with this droplet' : 'Error fetching tool instance';
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Determine required secrets and their Vault IDs
    // The `required_secrets_schema` in `tool_catalog` should define what keys the tool needs.
    // e.g., [{ "name": "OPENAI_API_KEY", "env_var_name": "OPENAI_API_KEY", "description": "..."}]
    // The `agent_droplet_tools.config_values` (or a dedicated mapping) should link these names to actual Vault secret UUIDs for *this specific instance*.
    // This logic is complex and depends on how this mapping is stored. 
    // For this example, let's assume `toolInstanceData.tool_catalog.required_secrets_schema` is an array of VaultSecret objects
    // OR `toolInstanceData.config_values.secret_mappings` contains this info.
    // Simplified: Assume `toolInstanceData.tool_catalog.required_secrets_schema` contains `VaultSecret[]` directly.
    
    const fetchedSecrets: { [key: string]: string | null } = {};
    const requiredSecretsSchema = toolInstanceData.tool_catalog?.required_secrets_schema as RequiredSecretSchemaEntry[] | null;
    const configuredSecretVaultIDs = toolInstanceData.config_values?.secret_vault_ids as ConfiguredSecretVaultIDs | null;

    if (requiredSecretsSchema && Array.isArray(requiredSecretsSchema) && configuredSecretVaultIDs) {
      for (const schemaEntry of requiredSecretsSchema) {
        if (schemaEntry && typeof schemaEntry === 'object' && schemaEntry.env_var_name) {
          const vaultId = configuredSecretVaultIDs[schemaEntry.env_var_name];
          if (vaultId && typeof vaultId === 'string') {
            try {
              const { data: rpcData, error: rpcError } = await supabaseAdmin
                .rpc('get_secret', { secret_id: vaultId });

              if (rpcError) {
                console.error(`Error fetching Vault secret (vault_id: ${vaultId}) for env_var ${schemaEntry.env_var_name}:`, rpcError.message);
                fetchedSecrets[schemaEntry.env_var_name] = null;
              } else {
                fetchedSecrets[schemaEntry.env_var_name] = (rpcData as any)?.key || null;
              }
            } catch (e: any) {
              console.error(`Exception fetching Vault secret (vault_id: ${vaultId}) for env_var ${schemaEntry.env_var_name}:`, e.message);
              fetchedSecrets[schemaEntry.env_var_name] = null;
            }
          } else {
            console.warn(`Vault ID not configured for required secret env_var: ${schemaEntry.env_var_name} in tool instance ${toolInstanceDbId}`);
            fetchedSecrets[schemaEntry.env_var_name] = null; // Indicate missing configuration
          }
        } else {
            console.warn('Invalid entry in required_secrets_schema:', schemaEntry);
        }
      }
    } else {
      console.log('No required secrets schema found in catalog or no configured vault IDs in tool instance, or schema/config is not in expected format.');
      // No secrets defined as required or no mappings, return empty secrets object
    }
    
    return new Response(JSON.stringify({ secrets: fetchedSecrets }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Fetch-Tool-Secrets: Unhandled exception:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 