/**
 * MCP Retry Handler
 * Implements proper Model Context Protocol retry mechanism
 * Based on: archive/tool_use/mcp_client_error_response_protocol.md
 */

export interface MCPRetryContext {
  toolName: string;
  originalParams: Record<string, any>;
  errorMessage: string;
  attempt: number;
  maxAttempts: number;
}

export class MCPRetryHandler {
  /**
   * Detect if an error is an MCP interactive error that should trigger retry
   * Following MCP protocol pattern detection
   */
  static isMCPInteractiveError(errorMessage: string): boolean {
    if (!errorMessage) return false;
    
    const lowerError = errorMessage.toLowerCase();
    
    // MCP protocol patterns from documentation
    return lowerError.includes('question:') ||
           lowerError.includes('what ') ||
           lowerError.includes('please provide') ||
           lowerError.includes('which ') ||
           lowerError.includes('how ') ||
           lowerError.includes('who ') ||
           lowerError.includes('where ') ||
           lowerError.includes('missing');
  }

  /**
   * Generate MCP retry system message following protocol guidelines
   */
  static generateRetrySystemMessage(context: MCPRetryContext): string {
    return `🔄 MCP TOOL RETRY - Attempt ${context.attempt}/${context.maxAttempts}

The tool "${context.toolName}" returned an interactive error message that requires additional information:

ERROR MESSAGE:
${context.errorMessage}

📋 MCP PROTOCOL INSTRUCTIONS:
1. READ the error message carefully - it tells you EXACTLY what's needed
2. The error message is conversational and guides you on what parameters to provide
3. Generate a NEW tool call with the CORRECTED parameters based on the error guidance
4. If the error asks for a specific parameter (e.g., "searchValue"), use THAT parameter name
5. If no specific value is mentioned, use reasonable defaults or empty strings for optional fields

⚠️ CRITICAL: 
- The error message above is from the MCP server and contains the guidance you need
- Follow the parameter names EXACTLY as mentioned in the error message
- Do NOT ask the user for input - use your best judgment or reasonable defaults
- Retry the tool call immediately with corrected parameters

ORIGINAL PARAMETERS (for reference):
${JSON.stringify(context.originalParams, null, 2)}

Now, please retry the ${context.toolName} tool call with the correct parameters as guided by the error message.`;
  }

  /**
   * Generate simplified retry guidance for automatic transformation cases
   */
  static generateAutoTransformGuidance(
    toolName: string,
    originalParams: Record<string, any>,
    transformedParams: Record<string, any>,
    errorMessage: string
  ): string {
    const changes: string[] = [];
    
    // Detect what changed
    for (const [key, value] of Object.entries(transformedParams)) {
      if (!(key in originalParams) || originalParams[key] !== value) {
        changes.push(`  - Added/Changed "${key}": ${JSON.stringify(value)}`);
      }
    }
    
    for (const key of Object.keys(originalParams)) {
      if (!(key in transformedParams)) {
        changes.push(`  - Removed "${key}"`);
      }
    }

    return `🔄 MCP AUTO-FIX APPLIED

The tool "${toolName}" had parameter issues. The system automatically corrected them:

ORIGINAL ERROR:
${errorMessage}

PARAMETER CHANGES:
${changes.join('\n')}

CORRECTED PARAMETERS:
${JSON.stringify(transformedParams, null, 2)}

✅ Please retry the tool call with these corrected parameters.`;
  }

  /**
   * Extract parameter hints from MCP error message
   */
  static extractParameterHints(errorMessage: string): {
    requiredParam?: string;
    suggestedValue?: string;
    parameterType?: string;
  } {
    const hints: any = {};
    
    // Try to extract parameter name from patterns like:
    // "use the 'searchValue' parameter"
    // "provide the 'to' field"
    // "missing 'subject'"
    const paramMatch = errorMessage.match(/['"`](\w+)['"`]\s*(?:parameter|field|value)/i);
    if (paramMatch) {
      hints.requiredParam = paramMatch[1];
    }

    // Try to extract suggested value from patterns like:
    // "use empty string (\"\")"
    // "provide email@example.com"
    const valueMatch = errorMessage.match(/(?:use|provide|try)\s+["']([^"']+)["']/i);
    if (valueMatch) {
      hints.suggestedValue = valueMatch[1];
    }

    // Try to extract parameter type
    if (errorMessage.toLowerCase().includes('email')) {
      hints.parameterType = 'email';
    } else if (errorMessage.toLowerCase().includes('search')) {
      hints.parameterType = 'search_query';
    } else if (errorMessage.toLowerCase().includes('phone')) {
      hints.parameterType = 'phone';
    }

    return hints;
  }

  /**
   * Build enhanced conversation context for MCP retry
   */
  static buildRetryConversationContext(
    toolName: string,
    errorMessage: string,
    attempt: number
  ): {
    userMessage: string;
    systemGuidance: string;
  } {
    const hints = this.extractParameterHints(errorMessage);
    
    let guidance = `The MCP server needs additional information for "${toolName}". `;
    
    if (hints.requiredParam) {
      guidance += `Specifically, it needs the "${hints.requiredParam}" parameter. `;
    }
    
    if (hints.suggestedValue) {
      guidance += `Suggested value: "${hints.suggestedValue}". `;
    }
    
    guidance += `Please retry with the correct parameters based on this guidance: ${errorMessage}`;

    return {
      userMessage: errorMessage,
      systemGuidance: guidance
    };
  }
}
