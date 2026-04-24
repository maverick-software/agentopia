import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getPipedreamConfig, pipedreamApiRequest } from '../_shared/pipedream.ts';

interface PipedreamAccount {
  id: string;
  name?: string | null;
  external_id?: string | null;
  healthy?: boolean;
  dead?: boolean | null;
  authorized_scopes?: string[];
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  app?: {
    name_slug: string;
    name: string;
    description?: string | null;
    img_src?: string | null;
  };
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

    const config = getPipedreamConfig();
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const app = url.searchParams.get('app') || body.app;
    const limit = url.searchParams.get('limit') || body.limit || '100';
    const query = new URLSearchParams({
      external_user_id: user.id,
      limit,
    });
    if (app) query.set('app', app);

    const response = await pipedreamApiRequest<{ data: PipedreamAccount[]; page_info?: unknown }>(
      `/v1/connect/${config.projectId}/accounts?${query.toString()}`,
      { method: 'GET' },
      'connect:accounts:read',
    );

    const rows = (response.data || [])
      .filter((account) => account.app?.name_slug)
      .map((account) => ({
        user_id: user.id,
        external_user_id: user.id,
        app_slug: account.app!.name_slug,
        app_name: account.app!.name,
        app_description: account.app!.description || null,
        app_icon_url: account.app!.img_src || null,
        account_id: account.id,
        account_name: account.name || account.external_id || account.app!.name,
        external_account_id: account.external_id || null,
        healthy: account.healthy ?? true,
        dead: account.dead ?? false,
        authorized_scopes: account.authorized_scopes || [],
        error_message: account.error || null,
        connected_at: account.created_at || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await serviceClient
        .from('user_pipedream_accounts')
        .upsert(rows, { onConflict: 'user_id,account_id' });

      if (upsertError) {
        throw new Error(`Failed to sync Pipedream accounts: ${upsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        accounts: rows,
        page_info: response.page_info,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Pipedream Accounts] Failed:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync Pipedream accounts',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
