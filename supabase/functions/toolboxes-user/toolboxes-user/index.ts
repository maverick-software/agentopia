import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseAdminClient } from '../_shared/supabaseAdminClient.ts';
import { AccountEnvironmentService } from '../../../src/services/account_environment_service/manager.ts'; // Adjust path as needed
console.log('Initializing toolboxes-user function');
const accountEnvService = new AccountEnvironmentService(supabaseAdminClient);
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }
  let userId;
  try {
    // Authenticate user and get userId from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid authorization header'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({
        error: userError?.message || 'Authentication failed'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    userId = user.id;
    console.log('Authenticated user:', userId);
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const basePathIndex = pathSegments.indexOf('toolboxes-user');
    const relevantPathSegments = basePathIndex !== -1 ? pathSegments.slice(basePathIndex + 1) : [];
    console.log('Request:', req.method, url.pathname, 'Relevant segments:', relevantPathSegments);
    // --- ROUTING LOGIC START ---
    if (req.method === 'POST' && relevantPathSegments.length === 0) {
      // POST /toolboxes-user -> provisionToolboxForUser
      const body = await req.json();
      if (!body.name || !body.regionSlug || !body.sizeSlug) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: name, regionSlug, sizeSlug'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 400
        });
      }
      // imageSlug is optional in ProvisionToolboxOptions, service provides default
      const newToolbox = await accountEnvService.provisionToolboxForUser(userId, body);
      return new Response(JSON.stringify(newToolbox), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 201
      });
    } else if (req.method === 'GET' && relevantPathSegments.length === 0) {
      // GET /toolboxes-user -> getUserToolboxes
      const toolboxes = await accountEnvService.getToolboxEnvironmentsByUserId(userId);
      return new Response(JSON.stringify(toolboxes), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (req.method === 'GET' && relevantPathSegments.length === 1 && relevantPathSegments[0] !== 'refresh-status') {
      // GET /toolboxes-user/{toolboxId} -> getUserToolboxById
      const toolboxId = relevantPathSegments[0];
      const toolbox = await accountEnvService.getToolboxEnvironmentByIdForUser(userId, toolboxId);
      if (!toolbox) {
        return new Response(JSON.stringify({
          error: 'Toolbox not found or access denied'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 404
        });
      }
      return new Response(JSON.stringify(toolbox), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (req.method === 'DELETE' && relevantPathSegments.length === 1 && relevantPathSegments[0] !== 'refresh-status') {
      // DELETE /toolboxes-user/{toolboxId} -> deprovisionToolbox
      const toolboxId = relevantPathSegments[0];
      // The service method `deprovisionToolbox` includes an optional userId for ownership check.
      const result = await accountEnvService.deprovisionToolbox(toolboxId, userId);
      if (!result.success) {
        // Use status 403 for access denied, 404 if not found by service, 500 for other errors
        let statusCode = 500;
        if (result.message?.includes('Access denied')) statusCode = 403;
        if (result.message?.includes('not found')) statusCode = 404; // Assuming service implies not found for user
        return new Response(JSON.stringify({
          error: result.message || 'Deprovisioning failed'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: statusCode
        });
      }
      return new Response(null, {
        headers: {
          ...corsHeaders
        },
        status: 204
      }); // No content on successful delete
    } else if (req.method === 'POST' && relevantPathSegments.length === 2 && relevantPathSegments[1] === 'refresh-status') {
      // POST /toolboxes-user/{toolboxId}/refresh-status -> refreshToolboxStatusFromDtma
      const toolboxId = relevantPathSegments[0];
      // The service method `refreshToolboxStatusFromDtma` includes userId for ownership check.
      const refreshedToolbox = await accountEnvService.refreshToolboxStatusFromDtma(toolboxId, userId);
      return new Response(JSON.stringify(refreshedToolbox), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- ROUTING LOGIC END ---
    return new Response(JSON.stringify({
      error: 'Not found or method not supported for the path'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 404
    });
  } catch (e) {
    console.error('Error in toolboxes-user function:', e);
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    if (e instanceof Error) {
      errorMessage = e.message;
    // Example: Could check for specific error types for different status codes
    // if (e instanceof SomeSpecificAuthError) statusCode = 403;
    // if (e instanceof SomeNotFoundError) statusCode = 404;
    }
    // If the error is from a service call that might already have a status (e.g., validation error from service)
    // and it's an object with a status property, we could potentially use that.
    // For simplicity now, just using 500 for most caught errors or specific ones if checked.
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: statusCode
    });
  }
});
console.log('toolboxes-user function script processed');
