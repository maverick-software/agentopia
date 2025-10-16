/**
 * OCR.Space API Edge Function
 * Handles optical character recognition operations using system-level API key
 * Supports image URL and base64 image input
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Request/Response interfaces
interface OCRRequest {
  agent_id: string;
  action: 'ocr_image' | 'ocr_url';
  params: {
    url?: string;
    base64Image?: string;
    language?: string;
    isOverlayRequired?: boolean;
    detectOrientation?: boolean;
    scale?: boolean;
    isTable?: boolean;
    OCREngine?: 1 | 2 | 3;
  };
}

interface OCRResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    processing_time_ms?: number;
    is_error_detected?: boolean;
  };
}

// OCR.Space API client
class OCRSpaceClient {
  private apiKey: string;
  private baseUrl = 'https://api.ocr.space/parse/image';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(formData: FormData): Promise<any> {
    console.log(`[OCR.Space] Making OCR request`);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
        },
        body: formData,
      });

      console.log(`[OCR.Space] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OCR.Space] API error response: ${errorText}`);
        throw new Error(`OCR.Space API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      
      // OCR.Space returns success indicators in the response body
      if (responseData.IsErroredOnProcessing) {
        const errorMessage = responseData.ErrorMessage?.[0] || 'Unknown OCR error';
        throw new Error(`OCR processing failed: ${errorMessage}`);
      }

      return responseData;
    } catch (error: any) {
      console.error(`[OCR.Space] Request failed:`, error.message);
      throw error;
    }
  }

  // OCR from URL
  async ocrFromUrl(params: any): Promise<any> {
    if (!params.url) {
      throw new Error('Missing required "url" parameter');
    }

    const formData = new FormData();
    formData.append('url', params.url);
    formData.append('language', params.language || 'eng');
    formData.append('isOverlayRequired', String(params.isOverlayRequired ?? false));
    formData.append('detectOrientation', String(params.detectOrientation ?? true));
    formData.append('scale', String(params.scale ?? true));
    formData.append('isTable', String(params.isTable ?? false));
    formData.append('OCREngine', String(params.OCREngine || 2));

    return await this.makeRequest(formData);
  }

  // OCR from base64 image
  async ocrFromBase64(params: any): Promise<any> {
    if (!params.base64Image) {
      throw new Error('Missing required "base64Image" parameter');
    }

    const formData = new FormData();
    formData.append('base64Image', params.base64Image);
    formData.append('language', params.language || 'eng');
    formData.append('isOverlayRequired', String(params.isOverlayRequired ?? false));
    formData.append('detectOrientation', String(params.detectOrientation ?? true));
    formData.append('scale', String(params.scale ?? true));
    formData.append('isTable', String(params.isTable ?? false));
    formData.append('OCREngine', String(params.OCREngine || 2));

    return await this.makeRequest(formData);
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const body: OCRRequest = await req.json();
    const { agent_id, action, params } = body;

    console.log(`[OCR.Space] Processing ${action} request for agent ${agent_id}`);

    // Authenticate user
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

    // ============================================
    // SYSTEM-LEVEL API KEY RETRIEVAL
    // ============================================
    console.log(`[OCR.Space] Fetching system-level API key for OCR.Space`);
    
    const { data: systemKey, error: systemKeyError } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id, is_active')
      .eq('provider_name', 'ocr_space')
      .eq('is_active', true)
      .single();

    console.log(`[OCR.Space] System key query result - Error: ${systemKeyError?.message}, Key found: ${!!systemKey}`);
    
    if (systemKeyError || !systemKey || !systemKey.vault_secret_id) {
      console.error(`[OCR.Space] System API key not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OCR.Space system API key is not configured. Please contact your administrator to set up this service in the Admin Settings.',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 503, // Service Unavailable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Decrypt system API key from Vault
    console.log(`[OCR.Space] Decrypting system API key - Vault ID: ${systemKey.vault_secret_id}`);
    
    const { data: apiKeyData, error: keyError } = await supabase.rpc(
      'vault_decrypt',
      { vault_id: systemKey.vault_secret_id }
    );

    console.log(`[OCR.Space] Vault decryption result - API Key: ${apiKeyData ? 'SUCCESS' : 'FAILED'}`);
    
    if (keyError || !apiKeyData) {
      console.error(`[OCR.Space] API key decryption failed:`, keyError);
      throw new Error('Failed to decrypt OCR.Space system API key. Please contact your administrator.');
    }

    // Initialize OCR.Space client
    console.log(`[OCR.Space] Initializing OCR.Space client with system API key`);
    const ocrClient = new OCRSpaceClient(apiKeyData);

    // Execute the requested action
    console.log(`[OCR.Space] Executing action: ${action}`);
    let result: any;

    switch (action) {
      case 'ocr_url':
        result = await ocrClient.ocrFromUrl(params);
        break;
      
      case 'ocr_image':
        result = await ocrClient.ocrFromBase64(params);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}. Supported actions: ocr_url, ocr_image`);
    }

    // Extract processing time
    const processingTimeMs = result.ProcessingTimeInMilliseconds || 0;

    // Log successful operation
    await supabase.from('tool_execution_logs').insert({
      agent_id: agent_id,
      user_id: user.id,
      tool_name: `ocr_space_${action}`,
      tool_provider: 'ocr_space',
      parameters: {
        ...params,
        // Don't log full base64 images to save space
        base64Image: params.base64Image ? '[BASE64_IMAGE_DATA]' : undefined
      },
      result_data: result,
      success: true,
      execution_time_ms: Date.now() - startTime,
      quota_consumed: 1
    });

    const response: OCRResponse = {
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        processing_time_ms: processingTimeMs,
        is_error_detected: result.IsErroredOnProcessing || false,
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[OCR.Space] Error:', error);

    // Log failed operation
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let logAgentId = null;
      let logAction = 'unknown';
      
      try {
        const requestBody = await req.clone().json();
        logAgentId = requestBody.agent_id || null;
        logAction = requestBody.action || 'unknown';
      } catch (parseError) {
        console.warn('[OCR.Space] Could not parse request body for error logging');
      }

      await supabase.from('tool_execution_logs').insert({
        agent_id: logAgentId,
        user_id: null,
        tool_name: `ocr_space_${logAction}`,
        tool_provider: 'ocr_space',
        parameters: {},
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        quota_consumed: 0
      });
    } catch (logError) {
      console.error('[OCR.Space] Failed to log error:', logError);
    }

    const response: OCRResponse = {
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




