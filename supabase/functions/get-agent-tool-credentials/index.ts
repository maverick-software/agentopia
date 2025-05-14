import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Database, Json } from '../_shared/database.types.ts' // Added Json import

console.log('Get-Agent-Tool-Credentials function starting...');

// CORS Headers (ensure consistency, restrict origin in prod)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // POST is used currently
};

// Helper to create Supabase admin client (can be moved to _shared)
function getSupabaseAdminClient(req: Request): SupabaseClient<Database> {
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
  type?: string; // e.g., 'api_key', 'oauth2_token_set' - for matching with agent_tool_credentials.credential_type
}

interface ExpectedPayload { // Added interface for payload type
  agentId: string;
  accountToolInstanceId: string;
}

serve(async (req: Request) => { // Added type Request for req
  console.log('Get-Agent-Tool-Credentials request received:', req.method, req.url); // Renamed Log

  // Handle OPTIONS pre-flight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // We expect a POST request
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

  // 2. Get agentId and accountToolInstanceId from request payload (Refactored)
  let agentId: string;
  let accountToolInstanceId: string;
  try {
    const payload = await req.json() as ExpectedPayload; // Assert type of payload
    agentId = payload.agentId;
    accountToolInstanceId = payload.accountToolInstanceId;
    if (!agentId || !accountToolInstanceId) {
      throw new Error('agentId and accountToolInstanceId are required in payload.');
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Invalid JSON payload: ${e.message}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient(req);

    // 3. Validate DTMA token (Refactored - WBS 2.3.2, Point 2 & 4a)
    const { data: toolboxData, error: toolboxAuthError } = await supabaseAdmin
      .from('account_tool_environments')
      .select('id') // We only need to confirm the token is valid for a toolbox
      .eq('dtma_bearer_token', dtmaAuthToken)
      .single();

    if (toolboxAuthError || !toolboxData) {
      const status = toolboxAuthError?.code === 'PGRST116' ? 401 : 500;
      const message = toolboxAuthError?.code === 'PGRST116' ? 'Unauthorized: Invalid DTMA token' : 'Could not verify DTMA token';
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Toolbox validated, toolboxData.id is the account_tool_environment_id

    // 4. Fetch agent_toolbelt_item and related tool_catalog.required_secrets_schema (Refactored - WBS 2.3.2, Point 4b)
    const { data: toolbeltItemData, error: toolbeltItemError } = await supabaseAdmin
      .from('agent_toolbelt_items')
      .select(`
        id,
        account_tool_instances (
          tool_catalog_id,
          tool_catalog ( required_secrets_schema )
        )
      `)
      .eq('agent_id', agentId)
      .eq('account_tool_instance_id', accountToolInstanceId)
      .eq('is_active_for_agent', true)
      .single();

    if (toolbeltItemError || !toolbeltItemData) {
      console.error(
        `Error fetching toolbelt item for agent ${agentId} and instance ${accountToolInstanceId}:`,
        toolbeltItemError?.message
      );
      const status = toolbeltItemError?.code === 'PGRST116' ? 404 : 500;
      const message = toolbeltItemError?.code === 'PGRST116' 
        ? 'Tool not found in agent toolbelt, or not active.' 
        : 'Error fetching agent toolbelt item.';
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentToolbeltItemId = toolbeltItemData.id;
    const requiredSecretsSchema = toolbeltItemData.account_tool_instances?.tool_catalog?.required_secrets_schema as RequiredSecretSchemaEntry[] | null;

    if (!requiredSecretsSchema || !Array.isArray(requiredSecretsSchema) || requiredSecretsSchema.length === 0) {
      console.log(`No required secrets schema found or schema is empty in catalog for tool instance ${accountToolInstanceId} (Toolbelt Item ID: ${agentToolbeltItemId}). Returning empty secrets.`);
      return new Response(JSON.stringify({ secrets: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 5. Fetch agent_tool_credentials for this toolbelt item (Refactored - WBS 2.3.2, Point 4c)
    const { data: agentCredentials, error: credentialsError } = await supabaseAdmin
      .from('agent_tool_credentials')
      .select('credential_type, encrypted_credentials, status') // encrypted_credentials is the Vault ID
      .eq('agent_toolbelt_item_id', agentToolbeltItemId)
      .eq('status', 'active'); // Only fetch active credentials

    if (credentialsError) {
      console.error(`Error fetching agent credentials for toolbelt item ${agentToolbeltItemId}:`, credentialsError.message);
      return new Response(JSON.stringify({ error: 'Error fetching agent credentials.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!agentCredentials || agentCredentials.length === 0) {
      console.log(`No active agent credentials found for toolbelt item ${agentToolbeltItemId}. Returning empty secrets for required schema.`);
      const emptySecrets: { [key: string]: string | null } = {};
      for (const schemaEntry of requiredSecretsSchema) {
        if (schemaEntry && schemaEntry.env_var_name) {
          emptySecrets[schemaEntry.env_var_name] = null;
        }
      }
      return new Response(JSON.stringify({ secrets: emptySecrets }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Retrieve secrets from Vault and map to env_var_names (Refactored - WBS 2.3.2, Point 4d & 4e)
    const fetchedSecrets: { [key: string]: string | null } = {};

      for (const schemaEntry of requiredSecretsSchema) {
        if (schemaEntry && typeof schemaEntry === 'object' && schemaEntry.env_var_name) {
        const matchingCredential = agentCredentials.find((cred: {
          credential_type: string | null; 
          encrypted_credentials: string | null; 
          status: string | null; 
        } | any) => // Typed cred based on select, allow any as fallback for local linting if types are complex
            (schemaEntry.type && cred.credential_type === schemaEntry.type) || 
            cred.credential_type === schemaEntry.env_var_name
        );

        if (matchingCredential && matchingCredential.encrypted_credentials) {
          const vaultId = matchingCredential.encrypted_credentials; // This is the Vault Secret ID
            try {
              const { data: rpcData, error: rpcError } = await supabaseAdmin
                .rpc('get_secret', { secret_id: vaultId });

              if (rpcError) {
                console.error(`Error fetching Vault secret (vault_id: ${vaultId}) for env_var ${schemaEntry.env_var_name}:`, rpcError.message);
              fetchedSecrets[schemaEntry.env_var_name] = null; // Error fetching
              } else {
              fetchedSecrets[schemaEntry.env_var_name] = (rpcData as any)?.key || null; // Successfully fetched, might be null if key is empty
              }
            } catch (e: any) {
              console.error(`Exception fetching Vault secret (vault_id: ${vaultId}) for env_var ${schemaEntry.env_var_name}:`, e.message);
            fetchedSecrets[schemaEntry.env_var_name] = null; // Exception
          }
        } else {
          console.warn(`No active/matching agent credential found or Vault ID missing for required secret env_var: ${schemaEntry.env_var_name} (Toolbelt Item ID: ${agentToolbeltItemId})`);
          fetchedSecrets[schemaEntry.env_var_name] = null; // Not configured for this agent or schema type mismatch
        }
      } else {
        console.warn('Skipping invalid entry in required_secrets_schema:', schemaEntry);
      }
    }
    
    console.log(`Successfully prepared secrets for agent ${agentId}, toolbelt item ${agentToolbeltItemId}`);
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