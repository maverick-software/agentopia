import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { ProcessingContext } from '../types.ts';

export interface AgentData {
  name?: string;
  description?: string;
  personality?: string;
  system_instructions?: string;
  assistant_instructions?: string;
}

export class PromptBuilder {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetch agent data from database
   */
  async fetchAgentData(agentId: string): Promise<AgentData | null> {
    const { data: agent } = await this.supabase
      .from('agents')
      .select('system_instructions, assistant_instructions, description, personality, name')
      .eq('id', agentId)
      .single();
    
    return agent;
  }

  /**
   * Build agent identity section
   */
  buildAgentIdentity(agent: AgentData | null): string[] {
    const sections: string[] = [];
    
    sections.push(`=== AGENT IDENTITY ===`);
    sections.push(`Your name is "${agent?.name || 'Assistant'}".`);
    sections.push(`You MUST always identify yourself by this name when asked.`);
    
    if (agent?.description) {
      sections.push(`Your description/role: ${agent.description}`);
    }
    
    if (agent?.personality) {
      sections.push(`Your personality traits: ${agent.personality}`);
      sections.push(`You MUST maintain these personality characteristics consistently in all interactions.`);
    }
    
    sections.push(`When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is ${agent?.name || 'Assistant'}"`);
    sections.push(`=== END AGENT IDENTITY ===\n`);
    
    return sections;
  }

  /**
   * Build system instructions section
   */
  buildSystemInstructions(agent: AgentData | null): string[] {
    const sections: string[] = [];
    
    if (agent?.system_instructions) {
      sections.push(`=== SYSTEM INSTRUCTIONS ===`);
      sections.push(agent.system_instructions);
      sections.push(`=== END SYSTEM INSTRUCTIONS ===\n`);
    }
    
    return sections;
  }

  /**
   * Build document access instructions
   */
  buildDocumentInstructions(): string[] {
    return [
      `=== DOCUMENT ACCESS INSTRUCTIONS ===`,
      `IMPORTANT: When users ask about uploaded documents, files, or content they've shared:`,
      `1. FIRST use 'search_documents' to find relevant documents`,
      `2. THEN use 'get_document_content' to retrieve the actual content`,
      `3. Reference the document content directly in your response`,
      `4. Always mention the document name/source when referencing content`,
      `Examples of when to use document tools:`,
      `- "What does the document say about..."`,
      `- "Summarize the uploaded file"`,
      `- "What are the key points in..."`,
      `- "Tell me about the document I uploaded"`,
      `=== END DOCUMENT ACCESS INSTRUCTIONS ===\n`
    ];
  }

  /**
   * Build memory handling instructions
   */
  buildMemoryInstructions(): string[] {
    return [
      `=== MEMORY HANDLING INSTRUCTIONS ===\n` +
      `You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.\n\n` +
      `Use these rules to apply memory to the current user request:\n` +
      `1) EPISODIC MEMORY (events/examples):\n` +
      `   - Purpose: continuity, personalization, and recent task alignment.\n` +
      `   - Prioritize recency and direct relevance to the current query.\n` +
      `   - Do NOT restate full content; summarize only what is minimally necessary.\n` +
      `2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):\n` +
      `   - Purpose: factual grounding and domain knowledge.\n` +
      `   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.\n` +
      `   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.\n` +
      `3) SAFETY & PRIVACY:\n` +
      `   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).\n` +
      `4) BREVITY & RELEVANCE:\n` +
      `   - Extract only memory that materially improves the answer. Be concise and avoid repetition.\n` +
      `=== END MEMORY HANDLING INSTRUCTIONS ===\n`
    ];
  }

  /**
   * Build markdown formatting instructions
   */
  buildFormattingInstructions(): string[] {
    return [
      `CRITICAL FORMATTING INSTRUCTIONS - You MUST format your responses using proper Markdown:

1. **Paragraphs**: Add a blank line between EVERY paragraph for proper spacing.

2. **Lists**: 
   - Use bullet points (- or *) for unordered lists
   - Use numbers (1. 2. 3.) for ordered lists
   - Add a blank line before and after lists
   - Each list item should be on its own line

3. **Emphasis**:
   - Use **bold** for important terms or key points
   - Use *italics* for subtle emphasis or examples
   - Use \`inline code\` for technical terms, commands, or values

4. **Headers**:
   - Use ## for main section headers
   - Use ### for subsection headers
   - Always add a blank line before and after headers

5. **Code Blocks**:
   \`\`\`language
   // Use triple backticks for code blocks
   // Specify the language for syntax highlighting
   \`\`\`

6. **Line Breaks**:
   - ALWAYS add blank lines between different sections
   - ALWAYS add blank lines between paragraphs
   - ALWAYS add blank lines around lists, headers, and code blocks

7. **Structure**:
   - Start with a brief introduction if needed
   - Organize content into logical sections
   - Use headers to separate major topics
   - End with a summary or conclusion if appropriate

EXAMPLE of proper formatting:

## Main Topic

This is the first paragraph with some **important information**.

This is the second paragraph, separated by a blank line. It includes \`technical terms\` in inline code.

### Subsection

Here's a list of items:

- First item with **bold emphasis**
- Second item with *italic text*
- Third item with more details

Another paragraph after the list, properly spaced.

Remember: ALWAYS use blank lines between elements for readability!`
    ];
  }

  /**
   * Build tool usage guidance
   */
  buildToolGuidance(toolNames: string): string {
    return `You have access to the following tools that can help you complete the user's requests:\n\n${toolNames}\n\n=== TOOL USAGE GUIDELINES ===\n1. ALWAYS use tools when the user asks you to take an action (send email, search, create document, etc.)\n2. Tools have prefixes indicating their provider (gmail_, smtp_, microsoft_outlook_, clicksend_, web_search, etc.)\n3. For email-related requests, check which email tools are available and use the appropriate one\n4. For SMS requests, use the clicksend_ tools\n5. For calendar/contacts requests with Outlook, use the microsoft_outlook_ tools\n6. Use web_search tools for internet searches\n7. Only answer directly (without tools) for simple questions or when no relevant tool exists\n\n=== CRITICAL: YOU MUST USE FUNCTION CALLING ===\n❌ NEVER just say you will do something - you MUST actually call the function\n❌ NEVER respond with text like "I'll send the SMS now" without calling the tool\n❌ NEVER simulate or pretend to take action - USE THE ACTUAL TOOL\n✅ When the user asks you to send/create/search/do ANYTHING, you MUST call the appropriate tool function\n✅ Do not write conversational responses about taking action - TAKE THE ACTION by calling the tool\n\n=== CRITICAL RESPONSE FORMATTING ===\n• When using tools, DO NOT include the raw JSON parameters in your response\n• DO NOT show code blocks like { "to": "...", "message": "..." }\n• Simply state what you're doing in ONE concise sentence, then call the tool\n• After the tool executes, report the result clearly\n• NEVER repeat the same action or explanation multiple times\n\nExample GOOD response:\n"I'll send that summary to Charles now."\n[tool executes]\n"✅ SMS sent successfully to Charles Sears."\n\nExample BAD response:\n"I'll send the SMS now.\n{ \"to\": \"+1234567890\", \"message\": \"...\" }\nNow I'll proceed with sending."\n\nIMPORTANT: When a user asks you to DO something (not just ask about it), you MUST use the appropriate tool. Do not just describe what you would do - actually use the tool to do it.`;
  }

  /**
   * Build final reflection guidance (for after tool execution)
   */
  buildReflectionGuidance(): string {
    return `Now provide a FINAL, clean response to the user. Your response should:\n\n✅ Be concise and professional\n✅ Summarize what was accomplished\n✅ Report any results or outcomes clearly\n✅ Use markdown formatting for readability\n\n❌ DO NOT repeat intermediate steps or explanations\n❌ DO NOT include raw JSON or code blocks\n❌ DO NOT say "I'll do X now" - just report what was done\n\nThe user only needs to know the final outcome in a clear, friendly way.`;
  }

  /**
   * Build reasoning context integration
   */
  buildReasoningContext(reasoningContext: any): string {
    if (!reasoningContext || !reasoningContext.enabled || !reasoningContext.steps?.length) {
      return '';
    }

    let reasoningPrompt = `=== ADVANCED REASONING ANALYSIS ===\n`;
    reasoningPrompt += `The user's query has been analyzed using ${reasoningContext.style?.toUpperCase() || 'ANALYTICAL'} reasoning.\n`;
    reasoningPrompt += `Analysis Confidence: ${(reasoningContext.score * 100).toFixed(1)}% (threshold: ${(reasoningContext.threshold * 100).toFixed(0)}%)\n\n`;
    
    reasoningPrompt += `REASONING CHAIN (${reasoningContext.steps.length} steps):\n`;
    reasoningContext.steps.forEach((step: any, index: number) => {
      const stepNum = index + 1;
      const state = step.state?.toUpperCase() || 'ANALYSIS';
      const confidence = step.confidence ? ` [${(step.confidence * 100).toFixed(0)}% confidence]` : '';
      
      if (step.question) {
        reasoningPrompt += `${stepNum}. [${state}] Question: ${step.question}${confidence}\n`;
      }
      if (step.hypothesis) {
        reasoningPrompt += `${stepNum}. [${state}] Analysis: ${step.hypothesis}${confidence}\n`;
      }
      if (step.description && !step.hypothesis && !step.question) {
        reasoningPrompt += `${stepNum}. [${state}] ${step.description}${confidence}\n`;
      }
      
      if (step.memory_insights?.length > 0) {
        reasoningPrompt += `   → Memory Context: ${step.memory_insights.join(', ')}\n`;
      }
      
      if (step.episodic_count > 0 || step.semantic_count > 0) {
        reasoningPrompt += `   → Memories Referenced: ${step.episodic_count} episodic, ${step.semantic_count} semantic\n`;
      }
    });
    
    const finalStep = reasoningContext.steps[reasoningContext.steps.length - 1];
    if (finalStep && (finalStep.state === 'conclude' || finalStep.type === 'decision')) {
      reasoningPrompt += `\nREASONING CONCLUSION:\n`;
      reasoningPrompt += `${finalStep.hypothesis || finalStep.description}\n`;
      if (finalStep.confidence) {
        reasoningPrompt += `Final Confidence: ${(finalStep.confidence * 100).toFixed(0)}%\n`;
      }
    }
    
    reasoningPrompt += `\nINSTRUCTIONS FOR RESPONSE:\n`;
    reasoningPrompt += `• Build upon the reasoning analysis above\n`;
    reasoningPrompt += `• Incorporate the insights and conclusions reached\n`;
    reasoningPrompt += `• Address any uncertainties identified in the analysis\n`;
    reasoningPrompt += `• Maintain appropriate confidence level based on the reasoning\n`;
    reasoningPrompt += `• Reference the reasoning process when it adds value to your response\n`;
    reasoningPrompt += `=== END REASONING ANALYSIS ===`;
    
    return reasoningPrompt;
  }

  /**
   * Build context window injection
   */
  buildContextWindow(contextWindow: any): string {
    const sections = Array.isArray(contextWindow?.sections) ? contextWindow.sections : [];
    if (sections.length === 0) {
      return '';
    }

    const toLabel = (s: any): string => {
      if (s?.source === 'episodic_memory') return 'EPISODIC MEMORY';
      if (s?.source === 'semantic_memory') return 'SEMANTIC MEMORY';
      return s?.title || 'Context';
    };

    const top = sections
      .slice(0, 4)
      .map((s: any) => `${toLabel(s)}:\n${String(s.content || '').slice(0, 2000)}`);
    
    return [
      '=== CONTEXT WINDOW ===',
      ...top,
      '=== END CONTEXT WINDOW ===\n',
    ].join('\n\n');
  }

  /**
   * Build complete system messages array (old method - for backward compatibility)
   */
  async buildSystemMessages(context: ProcessingContext, message: any): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (!context.agent_id) {
      return msgs;
    }

    // Fetch agent data
    const agent = await this.fetchAgentData(context.agent_id);

    // Build preamble
    const preamble: string[] = [];
    preamble.push(...this.buildAgentIdentity(agent));
    preamble.push(...this.buildSystemInstructions(agent));
    preamble.push(...this.buildDocumentInstructions());
    preamble.push(...this.buildMemoryInstructions());
    preamble.push(...this.buildFormattingInstructions());

    if (preamble.length) {
      msgs.push({ role: 'system', content: preamble.join('\n') });
    }

    // Add context window as assistant message
    const ctxWin = message?.context?.context_window;
    const contextWindowContent = this.buildContextWindow(ctxWin);
    if (contextWindowContent) {
      msgs.push({ role: 'assistant', content: contextWindowContent });
    }

    // Add assistant instructions
    if (agent?.assistant_instructions) {
      msgs.push({ role: 'assistant', content: agent.assistant_instructions });
    }

    return msgs;
  }

  /**
   * Build comprehensive system prompt string with agent identity, instructions, and guidance
   */
  buildSystemPromptString(agent: any): string {
    const sections: string[] = [];
    
    // CRITICAL: Agent Identity - Must be first and explicit
    sections.push(`=== AGENT IDENTITY ===
Your name is "${agent?.name || 'Assistant'}".
You MUST always identify yourself by this name when asked.
${agent?.description ? `Your description/role: ${agent.description}` : ''}
${agent?.personality ? `Your personality traits: ${agent.personality}\nYou MUST maintain these personality characteristics consistently in all interactions.` : ''}
When asked "What is your name?" or "Who are you?", you MUST respond with: "My name is ${agent?.name || 'Assistant'}"
=== END AGENT IDENTITY ===`);
    
    // System instructions come after identity
    if (agent?.system_instructions) {
      sections.push(`=== SYSTEM INSTRUCTIONS ===
${agent.system_instructions}
=== END SYSTEM INSTRUCTIONS ===`);
    }
    
    // Document tools guidance
    sections.push(`=== DOCUMENT ACCESS INSTRUCTIONS ===
IMPORTANT: When users ask about uploaded documents, files, or content they've shared:
1. FIRST use 'search_documents' to find relevant documents
2. THEN use 'get_document_content' to retrieve the actual content
3. Reference the document content directly in your response
4. Always mention the document name/source when referencing content
Examples of when to use document tools:
- "What does the document say about..."
- "Summarize the uploaded file"
- "What are the key points in..."
- "Tell me about the document I uploaded"
=== END DOCUMENT ACCESS INSTRUCTIONS ===`);
    
    // Memory handling guidance
    sections.push(`=== MEMORY HANDLING INSTRUCTIONS ===
You have access to a CONTEXT WINDOW with EPISODIC and SEMANTIC MEMORY sections injected as assistant messages.

Use these rules to apply memory to the current user request:
1) EPISODIC MEMORY (events/examples):
   - Purpose: continuity, personalization, and recent task alignment.
   - Prioritize recency and direct relevance to the current query.
   - Do NOT restate full content; summarize only what is minimally necessary.
2) SEMANTIC MEMORY (facts/entities/conclusions/concepts):
   - Purpose: factual grounding and domain knowledge.
   - Prefer higher-confidence, multi-source items; prefer well-supported conclusions/concepts derived from 3–6 connected nodes/edges.
   - If conflicts exist, resolve by (a) higher confidence, (b) greater evidence, (c) more recent; if unresolved, note uncertainty briefly.
3) SAFETY & PRIVACY:
   - Never leak raw sensitive content. Summarize and reference sources (e.g., [source: message 2025-08-12]).
4) BREVITY & RELEVANCE:
   - Extract only memory that materially improves the answer. Be concise and avoid repetition.
=== END MEMORY HANDLING INSTRUCTIONS ===`);
    
    // Output formatting guidance
    sections.push(this.buildFormattingInstructions().join('\n'));
    
    return sections.join('\n\n');
  }
}

