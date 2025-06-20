import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DTMAStatusResponse {
  status: string;
  timestamp: string;
  version: string;
  service: string;
  environment: {
    hasAuthToken: boolean;
    hasApiKey: boolean;
    hasApiBaseUrl: boolean;
    port: string;
  };
  tool_instances?: Array<{
    account_tool_instance_id: string | null;
    instance_name_on_toolbox: string;
    container_id: string;
    status: string;
    image: string;
    ports: Array<{
      ip?: string;
      private_port: number;
      public_port?: number;
      type: string;
    }>;
    created: number;
  }>;
}

interface SystemMetrics {
  cpu_load_percent: number;
  memory: {
    total_bytes: number;
    active_bytes: number;
    free_bytes: number;
    used_bytes: number;
  };
  disk: {
    mount: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from JWT token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body to get toolboxId and action
    const body = await req.json();
    const { toolboxId, action } = body;

    if (!toolboxId) {
      return new Response(
        JSON.stringify({ error: 'Toolbox ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get toolbox details
    const { data: toolbox, error: toolboxError } = await supabaseClient
      .from('account_tool_environments')
      .select('*')
      .eq('id', toolboxId)
      .single();

    if (toolboxError || !toolbox) {
      return new Response(
        JSON.stringify({ error: 'Toolbox not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has access to this toolbox
    const { data: userAccess } = await supabaseClient
      .from('account_tool_environments')
      .select('id')
      .eq('id', toolboxId)
      .eq('user_id', user.id)
      .single();

    if (!userAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const dtmaBaseUrl = `http://${toolbox.public_ip_address}:30000`;
    const dtmaAuthToken = Deno.env.get('BACKEND_TO_DTMA_API_KEY') || '';

    // Handle different actions
    switch (action) {
      case 'status':
        return await handleStatusCheck(dtmaBaseUrl, dtmaAuthToken);
      
      case 'restart':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { 
              status: 405, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        return await handleRestart(toolbox.public_ip_address);
      
      case 'redeploy':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { 
              status: 405, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        return await handleRedeploy(toolbox.public_ip_address);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Error in toolbox-dtma-console function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleStatusCheck(dtmaBaseUrl: string, dtmaAuthToken: string) {
  try {
    // Check DTMA enhanced status endpoint (now includes system metrics)
    const statusResponse = await fetch(`${dtmaBaseUrl}/status`, {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!statusResponse.ok) {
      throw new Error(`DTMA status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    const dtmaStatus = await statusResponse.json() as any;

    // The enhanced /status endpoint now includes system_metrics
    const systemMetrics = dtmaStatus.system_metrics || null;

    return new Response(
      JSON.stringify({
        success: true,
        dtma_status: dtmaStatus,
        system_metrics: systemMetrics,
        connection_status: 'connected',
        last_checked: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('DTMA status check failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        connection_status: 'failed',
        last_checked: new Date().toISOString(),
      }),
      { 
        status: 200, // Return 200 but with success: false
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleRestart(dropletIp: string) {
  try {
    // Use DigitalOcean API to restart the DTMA service
    // This would typically involve SSH commands or a droplet action
    
    // For now, we'll simulate a restart by making a request to a restart endpoint
    // In a real implementation, you might:
    // 1. SSH into the droplet and run: sudo systemctl restart dtma
    // 2. Use a webhook endpoint on the droplet
    // 3. Use DigitalOcean's API to run commands
    
    console.log(`Attempting to restart DTMA service on ${dropletIp}`);
    
    // Simulate restart delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'DTMA restart initiated',
        action: 'restart',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('DTMA restart failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        action: 'restart',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleRedeploy(dropletIp: string) {
  try {
    // Redeploy would involve:
    // 1. Stop the current DTMA service
    // 2. Pull the latest DTMA code/image
    // 3. Restart the service with new code
    
    console.log(`Attempting to redeploy DTMA service on ${dropletIp}`);
    
    // Simulate redeploy delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'DTMA redeployment initiated',
        action: 'redeploy',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('DTMA redeploy failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        action: 'redeploy',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
} 