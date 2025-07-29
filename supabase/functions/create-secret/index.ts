import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    console.log('Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    console.log('Parsing request body...');
    const { name, secret, description } = await req.json();
    console.log('Request data:', { name: name ? 'present' : 'missing', secret: secret ? 'present' : 'missing', description: description ? 'present' : 'missing' });

    if (!name || !secret) {
      console.log('Missing required fields');
      return new Response(JSON.stringify({ error: 'Name and secret are required' }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Calling vault.create_secret...');
    // Use the official Supabase Vault function to create secrets
    const { data, error } = await supabase.rpc('vault.create_secret', {
      secret,
      name,
      description
    });

    if (error) {
      console.error('Vault error:', error);
      throw error;
    }

    console.log('Secret created successfully, ID:', data);
    return new Response(JSON.stringify({ id: data }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 