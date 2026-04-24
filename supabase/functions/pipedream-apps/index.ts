import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { pipedreamApiRequest } from '../_shared/pipedream.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const params = new URLSearchParams();
    const passthroughParams = [
      'after',
      'before',
      'limit',
      'q',
      'sort_key',
      'sort_direction',
      'has_components',
      'has_actions',
      'has_triggers',
    ];

    for (const key of passthroughParams) {
      const value = url.searchParams.get(key) || body[key];
      if (value) params.set(key, value);
    }

    if (!params.has('limit')) params.set('limit', '50');
    if (!params.has('sort_key')) params.set('sort_key', 'featured_weight');
    if (!params.has('sort_direction')) params.set('sort_direction', 'desc');
    params.set('has_actions', params.get('has_actions') || 'true');

    const response = await pipedreamApiRequest<any>(
      `/v1/connect/apps?${params.toString()}`,
      { method: 'GET' },
      'connect:*',
    );

    return new Response(
      JSON.stringify({ success: true, ...response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Pipedream Apps] Failed:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list Pipedream apps',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
