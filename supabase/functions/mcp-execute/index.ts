import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface MCPExecuteRequest {
  connection_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  agent_id: string;
}

interface MCPExecuteResponse {
  success: boolean;
  data?: any;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for vault access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { connection_id, tool_name, parameters, agent_id }: MCPExecuteRequest = await req.json()

    if (!connection_id || !tool_name || !agent_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Connection ID, tool name, and agent ID are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[MCP Execute] Executing tool ${tool_name} for agent ${agent_id} on connection ${connection_id}`)

    // Get the connection details
    const { data: connection, error: connectionError } = await supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('agent_id', agent_id)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection not found or not authorized: ${connectionError?.message}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!connection.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Connection is not active' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the server URL securely using service role
    const { data: serverUrl, error: urlError } = await supabase.rpc('get_mcp_server_url', {
      connection_id: connection_id
    })

    if (urlError || !serverUrl) {
      console.error(`[MCP Execute] Failed to retrieve server URL: ${urlError?.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to retrieve server URL: ${urlError?.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Execute the tool via MCP protocol
    try {
      console.log(`[MCP Execute] Calling MCP server for tool: ${tool_name}`)
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2024-11-05'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: tool_name,
            arguments: parameters
          }
        })
      })

      // Handle different response formats (JSON or SSE)
      let mcpResponse
      const contentType = response.headers.get('content-type') || ''
      
      if (contentType.includes('text/event-stream')) {
        // Handle Server-Sent Events format (Zapier MCP uses this)
        const responseText = await response.text()
        console.log(`[MCP Execute] SSE Response received for tool ${tool_name}`)
        
        // Parse SSE format: look for "data: " lines
        const lines = responseText.split('\n')
        let jsonData = ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonData = line.substring(6) // Remove "data: " prefix
            break
          }
        }
        
        if (!jsonData) {
          throw new Error('No data found in SSE response')
        }
        
        try {
          mcpResponse = JSON.parse(jsonData)
        } catch (parseError) {
          throw new Error(`Failed to parse SSE data: ${parseError.message}`)
        }
      } else {
        // Handle regular JSON response
        if (!response.ok && response.status !== 400) {
          // Some MCP servers return 400 but still have valid data
          const text = await response.text()
          console.error(`[MCP Execute] HTTP error ${response.status}: ${text}`)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        mcpResponse = await response.json()
      }
      
      // Check for MCP protocol errors
      if (mcpResponse.error) {
        console.error(`[MCP Execute] MCP Error:`, mcpResponse.error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `MCP Error: ${mcpResponse.error.message || 'Unknown error'}`,
            data: mcpResponse.error
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Extract the result
      const result = mcpResponse.result

      console.log(`[MCP Execute] Tool ${tool_name} executed successfully`)

      // Log tool execution for analytics (optional)
      await supabase
        .from('mcp_tools_cache')
        .update({ last_updated: new Date().toISOString() })
        .eq('connection_id', connection_id)
        .eq('tool_name', tool_name)
        .catch(err => console.warn('Failed to update tool usage timestamp:', err))

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (mcpError: any) {
      console.error(`[MCP Execute] MCP connection error:`, mcpError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `MCP execution failed: ${mcpError.message}`,
          data: null
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('[MCP Execute] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
