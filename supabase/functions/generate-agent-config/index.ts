import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompt for agent configuration generation
const SYSTEM_PROMPT = `You are an expert AI agent configuration specialist. Generate complete agent configurations from user descriptions.

Output ONLY valid JSON matching this exact structure:
{
  "name": "Agent Name",
  "description": "Brief agent description",
  "purpose": "What the agent is good at",
  "personality": "professional|friendly|analytical|creative|supportive|direct|enthusiastic|thoughtful",
  "theme": "professional|business-casual|futuristic|alien|animal|custom",
  "mbtiType": "INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP",
  "gender": "male|female|neutral",
  "behavior": {
    "role": "Agent's primary role and responsibilities",
    "instructions": "How the agent should operate and communicate",
    "constraints": "What the agent should avoid or be careful about",
    "tools": "Guidelines for tool usage",
    "rules": [
      {"content": "Specific rule (max 50 words)"}
    ]
  },
  "suggested_tools": {
    "voice_enabled": false,
    "web_search_enabled": true,
    "document_creation_enabled": true,
    "ocr_processing_enabled": false,
    "temporary_chat_links_enabled": false
  },
  "llm_preferences": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7
  }
}

Guidelines:
- Names should be professional and memorable
- Behavior sections should be clear and actionable
- Rules must be under 50 words each, max 10 rules
- Tool selections should match the agent's purpose
- Be creative but professional`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Parse request
    const { description } = await req.json();
    
    if (!description || !description.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenAI API key from platform settings
    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('openai_api_key_vault_id')
      .single();

    let openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    // Try to get from vault if available
    if (platformSettings?.openai_api_key_vault_id) {
      try {
        const { data: vaultData } = await supabase.rpc('vault_decrypt', {
          vault_id: platformSettings.openai_api_key_vault_id
        });
        if (vaultData) {
          openaiApiKey = vaultData;
        }
      } catch (error) {
        console.warn('Could not retrieve API key from vault, using environment variable');
      }
    }

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Call OpenAI API
    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate agent configuration for: ${description}` }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const result = await response.json();
    const generationTime = Date.now() - startTime;
    
    // Parse the generated configuration
    const configuration = JSON.parse(result.choices[0].message.content);
    
    // Add unique IDs to rules
    if (configuration.behavior?.rules) {
      configuration.behavior.rules = configuration.behavior.rules.map((rule: any, idx: number) => ({
        id: `rule_${Date.now()}_${idx}`,
        content: rule.content
      }));
    }

    // Log generation for analytics
    try {
      await supabase.from('agent_generation_logs').insert({
        user_id: user.id,
        user_description: description,
        generation_method: 'ai_full',
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        generation_time_ms: generationTime,
        generated_config: configuration
      });
    } catch (logError) {
      console.error('Failed to log generation:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        configuration,
        metadata: {
          generation_time_ms: generationTime,
          model_used: 'gpt-4o-mini',
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating agent configuration:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate configuration'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


