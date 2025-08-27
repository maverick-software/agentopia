import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.2.0/mod.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMTPRequest {
  agent_id: string;
  user_id: string;
  action: string;
  parameters: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    cc?: string;
    bcc?: string;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, agent_id, user_id, parameters } = await req.json() as SMTPRequest
    console.log('SMTP send request:', { action, agent_id, user_id })

    // Validate required parameters
    if (!action || !parameters || !agent_id) {
      throw new Error('Missing required parameters')
    }

    // Create a Supabase client with auth context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Create service role client for secure operations
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user || user.id !== user_id) {
      throw new Error('Invalid or expired token')
    }

    // Validate agent has permission to use SMTP
    const { data: permissions } = await supabaseServiceRole
      .from('agent_integration_permissions')
      .select(`
        id,
        allowed_scopes,
        user_integration_credentials!inner(
          id,
          connection_metadata,
          vault_access_token_id,
          oauth_providers!inner(name)
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('is_active', true)
      .in('user_integration_credentials.oauth_providers.name', ['smtp', 'sendgrid', 'mailgun'])
      .single()

    if (!permissions) {
      throw new Error('Agent does not have permission to send emails via SMTP')
    }

    const connection = permissions.user_integration_credentials
    const providerName = connection.oauth_providers.name

    // Check if send_email scope is granted
    if (!permissions.allowed_scopes || !permissions.allowed_scopes.includes('send_email')) {
      throw new Error('Agent does not have send_email permission')
    }

    let result: any

    if (providerName === 'smtp') {
      // Get SMTP configuration from connection metadata
      const smtpConfig = connection.connection_metadata
      if (!smtpConfig) {
        throw new Error('SMTP configuration not found')
      }

      // Get password from vault
      const passwordVaultId = connection.vault_access_token_id
      if (!passwordVaultId) {
        throw new Error('SMTP password not configured')
      }

      // Retrieve password from vault
      const { data: vaultData, error: vaultError } = await supabaseServiceRole
        .rpc('vault_decrypt', { vault_id: passwordVaultId })

      if (vaultError || !vaultData) {
        throw new Error('Failed to retrieve SMTP password from vault')
      }

      // Create SMTP client
      const client = new SMTPClient({
        connection: {
          hostname: smtpConfig.host,
          port: smtpConfig.port,
          tls: smtpConfig.secure,
          auth: {
            username: smtpConfig.username,
            password: vaultData,
          },
        },
      })

      // Send email
      await client.send({
        from: smtpConfig.from_email || smtpConfig.username,
        to: parameters.to,
        subject: parameters.subject,
        content: parameters.body,
        html: parameters.html,
        cc: parameters.cc,
        bcc: parameters.bcc,
      })

      await client.close()

      result = {
        success: true,
        messageId: `smtp-${Date.now()}`,
        accepted: [parameters.to],
        response: 'Email sent successfully via SMTP',
      }
    } else if (providerName === 'sendgrid' || providerName === 'mailgun') {
      // TODO: Implement SendGrid and Mailgun sending
      throw new Error(`${providerName} email sending not yet implemented`)
    } else {
      throw new Error(`Unknown email provider: ${providerName}`)
    }

    // Log the email send event
    await supabaseServiceRole
      .from('email_logs')
      .insert({
        agent_id,
        user_id,
        provider: providerName,
        recipient: parameters.to,
        subject: parameters.subject,
        status: 'sent',
        metadata: {
          cc: parameters.cc,
          bcc: parameters.bcc,
        },
      })

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('SMTP send error:', error)
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send email via SMTP',
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
