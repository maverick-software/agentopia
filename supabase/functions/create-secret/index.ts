import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') || '';
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { name, secret, description } = await req.json();

    if (!name || !secret) {
      return new Response(JSON.stringify({ error: 'Name and secret are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // The 'vault' schema is protected, so we can't use an RPC wrapper.
    // We must call it from a secure context, like an Edge Function, using the service_role key.
    const { data, error } = await supabase
      .from('vault.secrets')
      .insert({ name, secret, description })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 