import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildPipedreamMcpHeaders,
  PIPEDREAM_MCP_SERVER_URL,
} from '../_shared/pipedream.ts';

async function parseMcpResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const responseText = await response.text();
    const dataLine = responseText
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (!dataLine) {
      throw new Error('No data found in SSE response');
    }

    return JSON.parse(dataLine.substring(6));
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const agentId = body.agentId || body.agent_id;
    const appSlug = body.appSlug || body.app_slug;
    const accountId = body.accountId || body.account_id;
    const connectionName = body.connectionName || body.connection_name || `Pipedream ${appSlug}`;

    if (!agentId || !appSlug) {
      return new Response(
        JSON.stringify({ success: false, error: 'agentId and appSlug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: agent, error: agentError } = await serviceClient
      .from('agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent || agent.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authConfig = {
      provider: 'pipedream',
      external_user_id: user.id,
      app_slug: appSlug,
      account_id: accountId || undefined,
    };
    const headers = await buildPipedreamMcpHeaders(authConfig);

    const toolsResponse = await fetch(PIPEDREAM_MCP_SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });

    if (!toolsResponse.ok && toolsResponse.status !== 400) {
      throw new Error(`Pipedream MCP tools/list failed: HTTP ${toolsResponse.status}`);
    }

    const toolsResult = await parseMcpResponse(toolsResponse);
    if (toolsResult.error) {
      throw new Error(`Pipedream MCP error: ${toolsResult.error.message || 'Unknown error'}`);
    }

    const toolCount = toolsResult.result?.tools?.length || 0;
    const { data: existing } = await serviceClient
      .from('agent_mcp_connections')
      .select('id')
      .eq('agent_id', agentId)
      .eq('connection_type', 'pipedream')
      .eq('auth_config->>app_slug', appSlug)
      .eq(accountId ? 'auth_config->>account_id' : 'auth_config->>external_user_id', accountId || user.id)
      .maybeSingle();

    if (existing?.id) {
      const { data: updated, error: updateError } = await serviceClient
        .from('agent_mcp_connections')
        .update({
          connection_name: connectionName,
          auth_config: authConfig,
          server_info: {
            name: `Pipedream ${appSlug}`,
            vendor: 'Pipedream',
            appSlug,
            accountId: accountId || null,
          },
          server_capabilities: { tools: { listChanged: false } },
          protocol_version: '2024-11-05',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) throw updateError;
      await serviceClient.functions.invoke('refresh-mcp-tools', { body: { connectionId: existing.id } });
      return new Response(
        JSON.stringify({ success: true, connection: updated, toolCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: vaultId, error: vaultError } = await serviceClient.rpc('create_vault_secret', {
      p_secret: PIPEDREAM_MCP_SERVER_URL,
      p_name: `pipedream_mcp_url_${agentId}_${Date.now()}`,
      p_description: `Pipedream MCP URL for ${connectionName}`,
    });

    if (vaultError || !vaultId) {
      throw new Error(`Failed to secure Pipedream MCP URL: ${vaultError?.message || 'Unknown vault error'}`);
    }

    const { data: connection, error: insertError } = await serviceClient
      .from('agent_mcp_connections')
      .insert({
        agent_id: agentId,
        connection_name: connectionName,
        vault_server_url_id: vaultId,
        server_url: null,
        connection_type: 'pipedream',
        auth_config: authConfig,
        server_capabilities: { tools: { listChanged: false } },
        server_info: {
          name: `Pipedream ${appSlug}`,
          vendor: 'Pipedream',
          appSlug,
          accountId: accountId || null,
        },
        protocol_version: '2024-11-05',
        is_active: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await serviceClient.functions.invoke('refresh-mcp-tools', {
      body: { connectionId: connection.id },
    });

    return new Response(
      JSON.stringify({ success: true, connection, toolCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Create Pipedream MCP Connection] Failed:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Pipedream MCP connection',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
