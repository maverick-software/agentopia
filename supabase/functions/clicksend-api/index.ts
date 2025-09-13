import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ClickSend API configuration
const CLICKSEND_API_BASE_URL = 'https://rest.clicksend.com/v3';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Request/Response interfaces
interface ClickSendRequest {
  agent_id: string;
  action: string;
  parameters: any;
}

interface ClickSendResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    quota_consumed?: number;
    message_id?: string;
    cost?: number;
  };
}

// ClickSend API client
class ClickSendClient {
  private baseUrl: string;
  private username: string;
  private apiKey: string;

  constructor(username: string, apiKey: string) {
    this.baseUrl = CLICKSEND_API_BASE_URL;
    this.username = username;
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    const credentials = btoa(`${this.username}:${this.apiKey}`);
    return `Basic ${credentials}`;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    console.log(`[ClickSend] Making ${method} request to ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ClickSend] API error ${response.status}: ${errorText}`);
      throw new Error(`ClickSend API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // Send SMS message
  async sendSMS(to: string, body: string, from?: string): Promise<any> {
    const payload = {
      messages: [
        {
          source: 'agentopia',
          from: from || null,
          to: to,
          body: body,
        }
      ]
    };

    return await this.makeRequest('/sms/send', 'POST', payload);
  }

  // Send MMS message
  async sendMMS(to: string, body: string, mediaUrl: string, subject?: string, from?: string): Promise<any> {
    const payload = {
      messages: [
        {
          source: 'agentopia',
          from: from || null,
          to: to,
          subject: subject || '',
          body: body,
          media: [mediaUrl]
        }
      ]
    };

    return await this.makeRequest('/mms/send', 'POST', payload);
  }

  // Get account balance
  async getBalance(): Promise<any> {
    return await this.makeRequest('/account');
  }

  // Get SMS history
  async getSMSHistory(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/sms/history?page=${page}&limit=${limit}`);
  }

  // Get MMS history
  async getMMSHistory(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/mms/history?page=${page}&limit=${limit}`);
  }

  // Get delivery receipts
  async getDeliveryReceipts(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/sms/receipts?page=${page}&limit=${limit}`);
  }
}

// Utility functions
function validatePhoneNumber(phoneNumber: string): boolean {
  // Basic international phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

function validateSMSBody(body: string): boolean {
  // SMS can be up to 1600 characters (concatenated)
  return body.length > 0 && body.length <= 1600;
}

function validateMMSMediaUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: ClickSendRequest = await req.json();
    const { agent_id, action, parameters } = body;

    console.log(`[ClickSend] Processing ${action} request for agent ${agent_id}`);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Validate agent permissions for ClickSend
    const { data: hasPermissions, error: permissionError } = await supabase.rpc(
      'validate_agent_clicksend_permissions',
      {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_required_scopes: getRequiredScopes(action)
      }
    );

    if (permissionError || !hasPermissions) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Agent does not have required ClickSend permissions',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user's ClickSend connection
    const { data: connection, error: connectionError } = await supabase.rpc(
      'get_user_clicksend_connection',
      { p_user_id: user.id }
    );

    if (connectionError || !connection || connection.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active ClickSend connection found. Please connect your ClickSend account.',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const userConnection = connection[0];

    // Decrypt credentials from Supabase Vault
    const { data: usernameData, error: usernameError } = await supabase.rpc(
      'vault.decrypt_secret',
      { secret_id: userConnection.encrypted_access_token }
    );

    const { data: apiKeyData, error: apiKeyError } = await supabase.rpc(
      'vault.decrypt_secret', 
      { secret_id: userConnection.encrypted_refresh_token }
    );

    if (usernameError || apiKeyError || !usernameData || !apiKeyData) {
      throw new Error('Failed to decrypt ClickSend credentials');
    }

    // Initialize ClickSend client
    const clicksendClient = new ClickSendClient(usernameData.decrypted_secret, apiKeyData.decrypted_secret);

    // Execute the requested action
    let result: any;
    let quotaConsumed = 0;

    switch (action) {
      case 'send_sms':
        result = await handleSendSMS(clicksendClient, parameters);
        quotaConsumed = 1;
        break;
      
      case 'send_mms':
        result = await handleSendMMS(clicksendClient, parameters);
        quotaConsumed = 3; // MMS typically costs more
        break;
      
      case 'get_balance':
        result = await handleGetBalance(clicksendClient, parameters);
        quotaConsumed = 0; // Balance check is typically free
        break;
      
      case 'get_sms_history':
        result = await handleGetSMSHistory(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      case 'get_mms_history':
        result = await handleGetMMSHistory(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      case 'get_delivery_receipts':
        result = await handleGetDeliveryReceipts(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log successful operation
    await supabase.from('tool_execution_logs').insert({
      agent_id: agent_id,
      user_id: user.id,
      tool_name: `clicksend_${action}`,
      tool_provider: 'clicksend',
      parameters: parameters,
      result_data: result,
      success: true,
      execution_time_ms: Date.now() - startTime,
      quota_consumed: quotaConsumed
    });

    const response: ClickSendResponse = {
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        quota_consumed: quotaConsumed,
        message_id: result?.data?.messages?.[0]?.message_id,
        cost: result?.data?.total_price
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[ClickSend] Error:', error);

    // Log failed operation
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('tool_execution_logs').insert({
        agent_id: body?.agent_id || null,
        user_id: null, // We may not have user context in error cases
        tool_name: `clicksend_${body?.action || 'unknown'}`,
        tool_provider: 'clicksend',
        parameters: body?.parameters || {},
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        quota_consumed: 0
      });
    } catch (logError) {
      console.error('[ClickSend] Failed to log error:', logError);
    }

    const response: ClickSendResponse = {
      success: false,
      error: error.message,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Action handlers
async function handleSendSMS(client: ClickSendClient, params: any): Promise<any> {
  const { to, body, from } = params;

  // Validate required parameters
  if (!to || !body) {
    throw new Error('Missing required parameters: to, body');
  }

  // Validate phone number format
  if (!validatePhoneNumber(to)) {
    throw new Error('Invalid phone number format. Use international format: +1234567890');
  }

  // Validate SMS body
  if (!validateSMSBody(body)) {
    throw new Error('SMS body must be between 1 and 1600 characters');
  }

  return await client.sendSMS(to, body, from);
}

async function handleSendMMS(client: ClickSendClient, params: any): Promise<any> {
  const { to, body, media_url, subject, from } = params;

  // Validate required parameters
  if (!to || !body || !media_url) {
    throw new Error('Missing required parameters: to, body, media_url');
  }

  // Validate phone number format
  if (!validatePhoneNumber(to)) {
    throw new Error('Invalid phone number format. Use international format: +1234567890');
  }

  // Validate media URL
  if (!validateMMSMediaUrl(media_url)) {
    throw new Error('Invalid media URL. Must be a valid HTTP/HTTPS URL');
  }

  return await client.sendMMS(to, body, media_url, subject, from);
}

async function handleGetBalance(client: ClickSendClient, params: any): Promise<any> {
  return await client.getBalance();
}

async function handleGetSMSHistory(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getSMSHistory(page, limit);
}

async function handleGetMMSHistory(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getMMSHistory(page, limit);
}

async function handleGetDeliveryReceipts(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getDeliveryReceipts(page, limit);
}

// Helper function to get required scopes for each action
function getRequiredScopes(action: string): string[] {
  const scopeMap: Record<string, string[]> = {
    'send_sms': ['sms'],
    'send_mms': ['mms'],
    'get_balance': ['balance'],
    'get_sms_history': ['history'],
    'get_mms_history': ['history'],
    'get_delivery_receipts': ['history']
  };

  return scopeMap[action] || [];
}
