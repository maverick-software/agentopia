/**
 * Intelligent Retry System for MCP Tools
 * 
 * This system provides:
 * 1. Automatic parameter transformation for common issues
 * 2. LLM-powered error analysis and parameter suggestion
 * 3. Context-aware retry logic for different tool types
 * 4. Flawless retry handling for both internal and external tools
 */

import type { FunctionCallingManager } from '../function_calling/manager.ts';

export interface ToolExecutionContext {
  toolName: string;
  originalParams: Record<string, any>;
  error: string;
  agentId: string;
  userId: string;
  attempt: number;
  maxAttempts: number;
}

export interface RetryAnalysis {
  shouldRetry: boolean;
  transformedParams?: Record<string, any>;
  enhancedInstructions?: string;
  confidence: number;
  reasoning: string;
}

export interface ParameterTransformation {
  from: string;
  to: string;
  condition?: (toolName: string, error: string) => boolean;
  transformer?: (value: any, context: ToolExecutionContext) => any;
}

export class IntelligentRetrySystem {
  private static parameterTransformations: ParameterTransformation[] = [
    // Zapier MCP Outlook Tools
    {
      from: 'instructions',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue'),
      transformer: (value: string) => value || ""
    },
    {
      from: 'query',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue')
    },
    {
      from: 'search',
      to: 'searchValue',
      condition: (toolName, error) => 
        toolName.includes('microsoft_outlook_find_emails') && 
        error.toLowerCase().includes('searchvalue')
    },
    
    // Gmail Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('gmail_search_emails') && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('gmail_search_emails') && 
        error.toLowerCase().includes('query')
    },
    
    // Contact Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName === 'search_contacts' && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName === 'search_contacts' && 
        error.toLowerCase().includes('query')
    },
    
    // SMS Tools
    {
      from: 'message',
      to: 'message_text',
      condition: (toolName, error) => 
        toolName.includes('clicksend_send_sms') && 
        error.toLowerCase().includes('message_text')
    },
    {
      from: 'phone',
      to: 'to',
      condition: (toolName, error) => 
        toolName.includes('send_sms') && 
        error.toLowerCase().includes('to')
    },
    
    // Web Search Tools
    {
      from: 'instructions',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('web_search') && 
        error.toLowerCase().includes('query')
    },
    {
      from: 'search',
      to: 'query',
      condition: (toolName, error) => 
        toolName.includes('web_search') && 
        error.toLowerCase().includes('query')
    }
  ];

  /**
   * Analyze tool execution error and determine retry strategy
   */
  static async analyzeError(context: ToolExecutionContext, openai: any): Promise<RetryAnalysis> {
    console.log(`[IntelligentRetry] Analyzing error for ${context.toolName} (attempt ${context.attempt}/${context.maxAttempts})`);
    console.log(`[IntelligentRetry] Error: ${context.error}`);
    console.log(`[IntelligentRetry] Original params:`, context.originalParams);

    // First, try automatic parameter transformation
    const transformedParams = this.tryParameterTransformation(context);
    if (transformedParams) {
      console.log(`[IntelligentRetry] ✅ Automatic parameter transformation successful`);
      console.log(`[IntelligentRetry] Transformed params:`, transformedParams);
      
      return {
        shouldRetry: true,
        transformedParams,
        confidence: 0.9,
        reasoning: 'Automatic parameter transformation applied based on known patterns',
        enhancedInstructions: this.generateEnhancedInstructions(context, transformedParams)
      };
    }

    // If automatic transformation fails, use LLM analysis
    console.log(`[IntelligentRetry] No automatic transformation found, using LLM analysis...`);
    return await this.llmAnalyzeError(context, openai);
  }

  /**
   * Try automatic parameter transformation based on known patterns
   */
  private static tryParameterTransformation(context: ToolExecutionContext): Record<string, any> | null {
    const { toolName, error, originalParams } = context;
    
    for (const transformation of this.parameterTransformations) {
      // Check if transformation condition matches
      if (transformation.condition && !transformation.condition(toolName, error)) {
        continue;
      }
      
      // Check if the source parameter exists in original params
      if (!(transformation.from in originalParams)) {
        continue;
      }
      
      console.log(`[IntelligentRetry] Applying transformation: ${transformation.from} → ${transformation.to}`);
      
      // Create transformed parameters
      const transformedParams = { ...originalParams };
      
      // Get the value to transform
      let value = originalParams[transformation.from];
      
      // Apply custom transformer if provided
      if (transformation.transformer) {
        value = transformation.transformer(value, context);
      }
      
      // Apply transformation
      transformedParams[transformation.to] = value;
      delete transformedParams[transformation.from];
      
      return transformedParams;
    }
    
    return null;
  }

  /**
   * Use LLM to analyze error and suggest parameter fixes
   */
  private static async llmAnalyzeError(context: ToolExecutionContext, openai: any): Promise<RetryAnalysis> {
    try {
      const prompt = `You are an expert at analyzing tool execution errors and fixing parameter issues.

TOOL: ${context.toolName}
ERROR: ${context.error}
ORIGINAL PARAMETERS: ${JSON.stringify(context.originalParams, null, 2)}
ATTEMPT: ${context.attempt}/${context.maxAttempts}

Analyze this error and determine:
1. Is this a fixable parameter issue?
2. What parameters need to be changed/added/removed?
3. What are the correct parameter names and values?

Common patterns:
- Zapier MCP tools often need "searchValue" instead of "instructions" or "query"
- Gmail tools need "query" parameter for searches
- Contact tools need "query" parameter for searches
- SMS tools need "to" (phone) and "message_text" parameters
- Email tools need "to", "subject", "body" parameters

Respond with a JSON object:
{
  "shouldRetry": boolean,
  "transformedParams": { "param": "value" } or null,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of the fix"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response
      const analysis = JSON.parse(content);
      
      console.log(`[IntelligentRetry] LLM analysis result:`, analysis);
      
      return {
        shouldRetry: analysis.shouldRetry && context.attempt < context.maxAttempts,
        transformedParams: analysis.transformedParams,
        confidence: analysis.confidence || 0.5,
        reasoning: analysis.reasoning || 'LLM analysis',
        enhancedInstructions: analysis.transformedParams ? 
          this.generateEnhancedInstructions(context, analysis.transformedParams) : undefined
      };

    } catch (error) {
      console.error(`[IntelligentRetry] LLM analysis failed:`, error);
      
      // Fallback to heuristic analysis
      return this.heuristicAnalysis(context);
    }
  }

  /**
   * Fallback heuristic analysis when LLM fails
   */
  private static heuristicAnalysis(context: ToolExecutionContext): RetryAnalysis {
    const { toolName, error, originalParams, attempt, maxAttempts } = context;
    const lowerError = error.toLowerCase();
    
    // Check for common fixable errors
    const isParameterError = lowerError.includes('missing') || 
                            lowerError.includes('required') || 
                            lowerError.includes('invalid') ||
                            lowerError.includes('parameter');
    
    if (!isParameterError || attempt >= maxAttempts) {
      return {
        shouldRetry: false,
        confidence: 0.8,
        reasoning: 'Not a fixable parameter error or max attempts reached'
      };
    }

    // Try to suggest common fixes
    let transformedParams = { ...originalParams };
    let reasoning = 'Heuristic parameter fix attempt';

    // Common transformations
    if (lowerError.includes('searchvalue') && 'instructions' in originalParams) {
      transformedParams.searchValue = originalParams.instructions || "";
      delete transformedParams.instructions;
      reasoning = 'Transformed instructions to searchValue';
    } else if (lowerError.includes('query') && 'instructions' in originalParams) {
      transformedParams.query = originalParams.instructions || "";
      delete transformedParams.instructions;
      reasoning = 'Transformed instructions to query';
    } else if (lowerError.includes('to') && 'phone' in originalParams) {
      transformedParams.to = originalParams.phone;
      delete transformedParams.phone;
      reasoning = 'Transformed phone to to';
    }

    return {
      shouldRetry: true,
      transformedParams: transformedParams,
      confidence: 0.6,
      reasoning: reasoning,
      enhancedInstructions: this.generateEnhancedInstructions(context, transformedParams)
    };
  }

  /**
   * Generate enhanced instructions for the retry attempt
   */
  private static generateEnhancedInstructions(
    context: ToolExecutionContext, 
    transformedParams: Record<string, any>
  ): string {
    const { toolName, error, attempt } = context;
    
    return `RETRY ATTEMPT ${attempt}: The previous tool call failed with error: "${error}"

CORRECTED PARAMETERS: The tool call has been automatically corrected with the following parameters:
${JSON.stringify(transformedParams, null, 2)}

CRITICAL: You MUST retry the tool call immediately using these EXACT corrected parameters. Do not modify them or ask for user input. The system has already analyzed the error and provided the correct parameter format.

For ${toolName}:
- Use the corrected parameter names and values exactly as provided
- Do not use generic parameters like "instructions" 
- The error has been analyzed and the parameters have been fixed automatically

RETRY NOW with the corrected parameters.`;
  }

  /**
   * Execute intelligent retry with parameter transformation
   */
  static async executeIntelligentRetry(
    context: ToolExecutionContext,
    fcm: FunctionCallingManager,
    openai: any
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    finalParams?: Record<string, any>;
  }> {
    console.log(`[IntelligentRetry] Starting intelligent retry for ${context.toolName}`);
    
    // Analyze the error and get retry strategy
    const analysis = await this.analyzeError(context, openai);
    
    if (!analysis.shouldRetry) {
      console.log(`[IntelligentRetry] Analysis determined retry should not be attempted: ${analysis.reasoning}`);
      return {
        success: false,
        error: `Retry analysis failed: ${analysis.reasoning}`,
        finalParams: context.originalParams
      };
    }

    if (!analysis.transformedParams) {
      console.log(`[IntelligentRetry] No parameter transformation suggested`);
      return {
        success: false,
        error: 'No parameter transformation could be determined',
        finalParams: context.originalParams
      };
    }

    console.log(`[IntelligentRetry] Retrying with transformed parameters (confidence: ${analysis.confidence})`);
    console.log(`[IntelligentRetry] Reasoning: ${analysis.reasoning}`);
    console.log(`[IntelligentRetry] Transformed params:`, analysis.transformedParams);

    try {
      // Execute the tool with transformed parameters
      const result = await fcm.executeFunction(
        context.agentId,
        context.userId,
        context.toolName,
        analysis.transformedParams
      );

      if (result.success) {
        console.log(`[IntelligentRetry] ✅ Retry successful after parameter transformation`);
        return {
          success: true,
          result: result,
          finalParams: analysis.transformedParams
        };
      } else {
        console.log(`[IntelligentRetry] ❌ Retry failed even with transformed parameters: ${result.error}`);
        return {
          success: false,
          error: result.error,
          finalParams: analysis.transformedParams
        };
      }

    } catch (error: any) {
      console.error(`[IntelligentRetry] Exception during retry:`, error);
      return {
        success: false,
        error: error.message || 'Retry execution failed',
        finalParams: analysis.transformedParams
      };
    }
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(toolName: string, error: string): boolean {
    const lowerError = error.toLowerCase();
    
    // Parameter-related errors are always retryable
    if (lowerError.includes('missing') || 
        lowerError.includes('required') || 
        lowerError.includes('invalid parameter') ||
        lowerError.includes('searchvalue') ||
        lowerError.includes('question:')) {
      return true;
    }

    // Authentication errors are not retryable
    if (lowerError.includes('unauthorized') || 
        lowerError.includes('forbidden') || 
        lowerError.includes('authentication')) {
      return false;
    }

    // Network/temporary errors are retryable
    if (lowerError.includes('timeout') || 
        lowerError.includes('network') || 
        lowerError.includes('connection')) {
      return true;
    }

    // Tool-specific retryable patterns
    if (toolName.includes('microsoft_outlook_') && lowerError.includes('search value')) {
      return true;
    }

    return false;
  }
}
