import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getPipedreamAllowedOrigins,
  getPipedreamConfig,
  pipedreamApiRequest,
} from '../_shared/pipedream.ts';

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

    const body = await req.json().catch(() => ({}));
    const config = getPipedreamConfig();
    const allowedOrigins = body.allowed_origins || getPipedreamAllowedOrigins();
    const tokenBody: Record<string, unknown> = {
      external_user_id: user.id,
      allowed_origins: allowedOrigins,
      expires_in: body.expires_in || 14_400,
      scope: body.scope || 'connect:accounts:read connect:accounts:write',
    };

    if (body.success_redirect_uri) tokenBody.success_redirect_uri = body.success_redirect_uri;
    if (body.error_redirect_uri) tokenBody.error_redirect_uri = body.error_redirect_uri;
    if (body.webhook_uri) tokenBody.webhook_uri = body.webhook_uri;

    const tokenResponse = await pipedreamApiRequest<{
      token: string;
      expires_at: string;
      connect_link_url: string;
    }>(
      `/v1/connect/${config.projectId}/tokens`,
      {
        method: 'POST',
        body: JSON.stringify(tokenBody),
      },
      'connect:tokens:create',
    );

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenResponse.token,
        expires_at: tokenResponse.expires_at,
        connect_link_url: tokenResponse.connect_link_url,
        external_user_id: user.id,
        environment: config.environment,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Pipedream Connect Token] Failed:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Pipedream Connect token',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
