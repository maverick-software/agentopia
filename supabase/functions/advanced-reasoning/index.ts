import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Import reasoning components
import { IterativeMarkovController } from './reasoning/iterative-markov-controller.ts';
import { InductiveReasoner } from './reasoning/inductive-reasoner.ts';
import { DeductiveReasoner } from './reasoning/deductive-reasoner.ts';
import { AbductiveReasoner } from './reasoning/abductive-reasoner.ts';
import { ComplexityAnalyzer } from './reasoning/complexity-analyzer.ts';

// Types
interface ReasoningRequest {
  action: string;
  agent_id: string;
  user_id: string;
  tool_name?: string;
  [key: string]: any;
}

interface ReasoningResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: any;
}

interface ReasoningSession {
  id: string;
  agent_id: string;
  user_id: string;
  conversation_id?: string;
  query: string;
  reasoning_type: string;
  iterations: number;
  max_iterations: number;
  initial_confidence: number;
  final_confidence?: number;
  confidence_threshold: number;
  conclusion?: string;
  insights: any[];
  memory_connections: any;
  started_at: string;
  completed_at?: string;
  forced_stop: boolean;
  stop_reason?: string;
  total_tokens_used: number;
  total_processing_time_ms: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const requestBody: ReasoningRequest = await req.json();
    const { action, agent_id, user_id, tool_name } = requestBody;

    console.log(`[advanced-reasoning] Processing action: ${action} for agent: ${agent_id}`);

    // Route to appropriate handler
    let response: ReasoningResponse;

    switch (action) {
      case 'execute_chain':
        response = await handleExecuteChain(requestBody, supabase);
        break;
      case 'inductive_reasoning':
        response = await handleInductiveReasoning(requestBody, supabase);
        break;
      case 'deductive_reasoning':
        response = await handleDeductiveReasoning(requestBody, supabase);
        break;
      case 'abductive_reasoning':
        response = await handleAbductiveReasoning(requestBody, supabase);
        break;
      default:
        response = {
          success: false,
          error: `Unknown action: ${action}. Available actions: execute_chain, inductive_reasoning, deductive_reasoning, abductive_reasoning`
        };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.success ? 200 : 400
    });

  } catch (error) {
    console.error('[advanced-reasoning] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

/**
 * Handle execute_chain action - Main reasoning orchestrator
 */
async function handleExecuteChain(request: ReasoningRequest, supabase: any): Promise<ReasoningResponse> {
  const startTime = Date.now();
  
  try {
    const {
      agent_id,
      user_id,
      query,
      conversation_id,
      max_iterations = 6,
      confidence_threshold = 0.85,
      reasoning_style = 'auto',
      include_memory = true,
      timeout_ms = 30000
    } = request;

    console.log(`[execute_chain] Starting reasoning for query: "${query?.substring(0, 100)}..."`);

    // Validate required parameters
    if (!query || !agent_id || !user_id) {
      return {
        success: false,
        error: 'Missing required parameters: query, agent_id, user_id'
      };
    }

    // Analyze query complexity and determine reasoning style
    const complexityAnalyzer = new ComplexityAnalyzer();
    const complexity = await complexityAnalyzer.analyze(query);
    
    let finalReasoningStyle = reasoning_style;
    if (reasoning_style === 'auto') {
      finalReasoningStyle = complexityAnalyzer.recommendStyle(complexity);
    }

    console.log(`[execute_chain] Complexity: ${complexity.score}, Style: ${finalReasoningStyle}`);

    // Create reasoning session
    const sessionId = crypto.randomUUID();
    const session: Partial<ReasoningSession> = {
      id: sessionId,
      agent_id,
      user_id,
      conversation_id,
      query,
      reasoning_type: finalReasoningStyle,
      iterations: 0,
      max_iterations,
      initial_confidence: 0.5,
      confidence_threshold,
      insights: [],
      memory_connections: {},
      started_at: new Date().toISOString(),
      forced_stop: false,
      total_tokens_used: 0,
      total_processing_time_ms: 0
    };

    // Insert session into database
    const { error: sessionError } = await supabase
      .from('reasoning_sessions')
      .insert(session);

    if (sessionError) {
      console.error('[execute_chain] Failed to create session:', sessionError);
      return {
        success: false,
        error: 'Failed to create reasoning session'
      };
    }

    // Initialize iterative Markov controller
    const controller = new IterativeMarkovController({
      sessionId,
      agentId: agent_id,
      userId: user_id,
      supabase,
      maxIterations: max_iterations,
      confidenceThreshold: confidence_threshold,
      timeoutMs: timeout_ms,
      includeMemory: include_memory
    });

    // Execute reasoning chain
    const result = await controller.executeChain(query, finalReasoningStyle);

    // Update session with results
    const processingTime = Date.now() - startTime;
    const { error: updateError } = await supabase
      .from('reasoning_sessions')
      .update({
        iterations: result.iterations,
        final_confidence: result.finalConfidence,
        conclusion: result.conclusion,
        insights: result.insights,
        memory_connections: result.memoryConnections,
        completed_at: new Date().toISOString(),
        forced_stop: result.forcedStop,
        stop_reason: result.stopReason,
        total_tokens_used: result.totalTokens,
        total_processing_time_ms: processingTime
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[execute_chain] Failed to update session:', updateError);
    }

    console.log(`[execute_chain] Completed in ${processingTime}ms with ${result.iterations} iterations`);

    return {
      success: true,
      data: {
        session_id: sessionId,
        reasoning_type: finalReasoningStyle,
        iterations: result.iterations,
        final_confidence: result.finalConfidence,
        conclusion: result.conclusion,
        insights: result.insights,
        steps: result.steps,
        memory_connections: result.memoryConnections,
        complexity_analysis: complexity
      },
      metadata: {
        processing_time_ms: processingTime,
        tokens_used: result.totalTokens,
        stop_reason: result.stopReason
      }
    };

  } catch (error) {
    console.error('[execute_chain] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute reasoning chain'
    };
  }
}

/**
 * Handle inductive_reasoning action
 */
async function handleInductiveReasoning(request: ReasoningRequest, supabase: any): Promise<ReasoningResponse> {
  try {
    const { observations, context, confidence_threshold = 0.8 } = request;

    if (!observations || !Array.isArray(observations)) {
      return {
        success: false,
        error: 'Missing required parameter: observations (array)'
      };
    }

    const reasoner = new InductiveReasoner();
    const result = await reasoner.reason({
      observations,
      context,
      confidenceThreshold: confidence_threshold
    });

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('[inductive_reasoning] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to perform inductive reasoning'
    };
  }
}

/**
 * Handle deductive_reasoning action
 */
async function handleDeductiveReasoning(request: ReasoningRequest, supabase: any): Promise<ReasoningResponse> {
  try {
    const { premises, rules, context } = request;

    if (!premises || !Array.isArray(premises)) {
      return {
        success: false,
        error: 'Missing required parameter: premises (array)'
      };
    }

    const reasoner = new DeductiveReasoner();
    const result = await reasoner.reason({
      premises,
      rules: rules || [],
      context
    });

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('[deductive_reasoning] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to perform deductive reasoning'
    };
  }
}

/**
 * Handle abductive_reasoning action
 */
async function handleAbductiveReasoning(request: ReasoningRequest, supabase: any): Promise<ReasoningResponse> {
  try {
    const { observations, anomalies, context } = request;

    if (!observations || !Array.isArray(observations)) {
      return {
        success: false,
        error: 'Missing required parameter: observations (array)'
      };
    }

    const reasoner = new AbductiveReasoner();
    const result = await reasoner.reason({
      observations,
      anomalies: anomalies || [],
      context
    });

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('[abductive_reasoning] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to perform abductive reasoning'
    };
  }
}