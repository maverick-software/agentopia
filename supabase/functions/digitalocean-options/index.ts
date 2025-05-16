import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '@shared/cors.ts';
import { listAvailableRegions, listAvailableSizes } from '@services/digitalocean_service/options.ts';

console.log('DigitalOcean Options function started.');

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Expected path: /digitalocean-options/regions or /digitalocean-options/sizes
    const optionType = pathSegments.length > 1 ? pathSegments[pathSegments.length -1] : null;

    let data: any;
    let error: any = null;

    if (req.method === 'GET') {
      if (optionType === 'regions') {
        console.log('Fetching DigitalOcean regions...');
        data = await listAvailableRegions();
        console.log(`Found ${data?.length || 0} regions.`);
      } else if (optionType === 'sizes') {
        console.log('Fetching DigitalOcean sizes...');
        data = await listAvailableSizes();
        console.log(`Found ${data?.length || 0} sizes.`);
      } else {
        error = { message: 'Invalid option type. Use /regions or /sizes.' };
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } else {
      error = { message: 'Method not allowed. Only GET is supported.' };
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    if (error) {
        return new Response(JSON.stringify({ error: error.message || 'An unknown error occurred' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: error.status || 500,
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Error in DigitalOcean Options function:', err);
    const errorMessage = err?.message || 'Internal Server Error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 