// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// import { corsHeaders } from '../_shared/cors.ts' // Remove CORS import for now

console.log(`Function 'generate-agent-image' up and running!`);

// Define expected request body structure
interface RequestPayload {
  prompt: string;
  agentId: string;
}

serve(async (req) => {
  // 1. Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    // Simplified CORS headers
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' , 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    // 2. Create Supabase client with auth context from request headers
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 3. Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return new Response(JSON.stringify({ error: 'User not authenticated' }), { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 4. Parse request body
    const { prompt, agentId }: RequestPayload = await req.json();
    if (!prompt || !agentId) {
      return new Response(JSON.stringify({ error: 'Missing prompt or agentId' }), { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 5. Authorize: Check if user can manage this agent
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: canManage, error: rpcError } = await supabaseAdminClient
      .rpc('can_manage_agent', { agent_id_param: agentId });

    if (rpcError) {
      console.error('RPC Error checking permissions:', rpcError);
      return new Response(JSON.stringify({ error: 'Failed to check permissions' }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (!canManage) {
      console.warn(`User ${user.id} attempted to generate image for agent ${agentId} without permission.`);
      return new Response(JSON.stringify({ error: 'User does not have permission to manage this agent' }), { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    console.log(`User ${user.id} authorized to generate image for agent ${agentId}. Prompt: ${prompt}`);

    // 6. Call OpenAI DALL-E API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured.');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured server-side.' }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let generatedImageUrl = '';
    try {
      console.log('Calling DALL-E 3 API...')
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024", 
          response_format: "url", 
          quality: "standard"
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('OpenAI API Error:', errorBody);
        throw new Error(`OpenAI API request failed: ${response.statusText} - ${JSON.stringify(errorBody.error)}`);
      }

      const result = await response.json();
      if (!result.data || result.data.length === 0 || !result.data[0].url) {
         throw new Error('OpenAI API did not return a valid image URL.');
      }

      generatedImageUrl = result.data[0].url; 
      console.log('DALL-E 3 generated image URL (temporary):', generatedImageUrl);

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        return new Response(JSON.stringify({ error: `Failed to generate image: ${error.message}` }), {
          headers: { 'Access-Control-Allow-Origin': '*' },
          status: 500,
        });
    }

    // 7. Download image from temporary URL
    let imageBlob: Blob;
    try {
      console.log('Downloading generated image from temporary URL...');
      const imageResponse = await fetch(generatedImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download generated image: ${imageResponse.statusText}`);
      }
      imageBlob = await imageResponse.blob();
      console.log(`Image downloaded successfully. Type: ${imageBlob.type}, Size: ${imageBlob.size}`);

      // Basic validation (optional but recommended)
      if (!imageBlob.type.startsWith('image/')) {
        throw new Error(`Downloaded file is not an image: ${imageBlob.type}`);
      }
      // Add size validation if desired (e.g., < 5MB)
      // const maxSize = 5 * 1024 * 1024; 
      // if (imageBlob.size > maxSize) { ... }

    } catch (error) {
      console.error('Error downloading image from OpenAI URL:', error);
      return new Response(JSON.stringify({ error: `Failed to process generated image: ${error.message}` }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 500,
      });
    }

    // 8. Upload Blob to Supabase Storage
    const imagePath = `public/${agentId}.png`; // Example path, use PNG
    let permanentImageUrl = '';
    try {
      console.log(`Uploading image to Supabase Storage at: ${imagePath}`);
      const { data: uploadData, error: uploadError } = await supabaseAdminClient.storage
        .from('agent-avatars')
        .upload(imagePath, imageBlob, {
          cacheControl: '3600', // Cache for 1 hour
          upsert: true, // Overwrite if exists
          contentType: 'image/png' // Force PNG type
        });

      if (uploadError) {
        console.error('Supabase Storage Upload Error:', uploadError);
        throw uploadError;
      }

      // 9. Get the permanent public URL
      const { data: urlData } = supabaseAdminClient.storage
         .from('agent-avatars')
         .getPublicUrl(imagePath);
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not get public URL after upload.');
      }
      permanentImageUrl = urlData.publicUrl;
      console.log('Image uploaded successfully. Permanent URL:', permanentImageUrl);

    } catch (error) {
      console.error('Error uploading image to Supabase Storage:', error);
      return new Response(JSON.stringify({ error: `Failed to store generated image: ${error.message}` }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 500,
      });
    }

    // 10. Update agents table with permanent avatar_url
    try {
        const { error: updateError } = await supabaseAdminClient
            .from('agents')
            .update({ avatar_url: permanentImageUrl })
            .eq('id', agentId)
            .eq('user_id', user.id); // Ensure user still owns agent

        if (updateError) {
            console.error('DB Update Error:', updateError);
            // Consider if we should delete the uploaded storage object if DB update fails
            throw new Error('Failed to update agent avatar URL in database.');
        }
        console.log(`Agent ${agentId} avatar_url updated successfully.`);

    } catch(error) {
        console.error('Error updating agent table:', error);
        // Consider cleanup of uploaded image
        return new Response(JSON.stringify({ error: `Failed to finalize avatar update: ${error.message}` }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          status: 500,
        });
    }

    // 11. Return permanent image URL
    return new Response(JSON.stringify({ imageUrl: permanentImageUrl }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });

  } catch (error) {
    console.error('General error in function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, // Simplified CORS
      status: 500,
    });
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-agent-image' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
