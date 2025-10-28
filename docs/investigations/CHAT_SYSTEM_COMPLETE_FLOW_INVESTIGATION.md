# Chat System Complete Flow Investigation
**Created:** October 22, 2025  
**Purpose:** Comprehensive mapping of the intelligent chat system architecture, conditional logic, context delivery, and model selection

---

## 📋 Table of Contents
- [System Entry Point](#system-entry-point)
- [Complete Processing Pipeline](#complete-processing-pipeline)
- [Conditional Statements & Breakout Points](#conditional-statements--breakout-points)
- [Context Delivery Through Each Stage](#context-delivery-through-each-stage)
- [LLM Model Determination](#llm-model-determination)
- [Tool Loading Logic](#tool-loading-logic)
- [Caching Strategy](#caching-strategy)
- [Complete Flow Diagram](#complete-flow-diagram)

---

## System Entry Point

### **File:** `supabase/functions/chat/index.ts`

**Main Handler Function:** `handler(req: Request): Promise<Response>`

```
REQUEST
  ↓
[CORS Handling] → handleCORS()
  ↓
[Authentication] → supabase.auth.getUser(token)
  ↓
[Request Parsing] → req.json()
  ↓
[Schema Validation] → validator.validateChatRequest(body)
  ↓
[Streaming Check] → wantsStream && body.options?.response?.stream
  ├─ YES → handleStreamingRequest()
  └─ NO → Continue to standard processing
  ↓
[Conversation Session] → ensureConversationSession()
  ↓
[Message Processing Loop] → messageProcessor.process()
  ├─ Attempt 1
  ├─ Attempt 2 (if context overflow)
  └─ Attempt 3 (if context overflow)
  ↓
[Message Persistence] → DualWriteService.saveMessage()
  ↓
[Title Update] → updateConversationTitleAfterThirdMessage() [async, non-blocking]
  ↓
RESPONSE
```

### **Key Conditional: Streaming vs Standard**

```typescript
// Line 299-300
const acceptHeader = req.headers.get('Accept');
const wantsStream = acceptHeader?.includes('text/event-stream');
const requestType = wantsStream && body.options?.response?.stream ? 'streaming' : 'standard';

if (wantsStream && body.options?.response?.stream) {
  return handleStreamingRequest(body, requestId);
}
```

**Condition:** If client requests streaming (`Accept: text/event-stream` + `body.options.response.stream = true`)
- **YES:** Route to `handleStreamingRequest()` → Uses `messageProcessor.processStream()` generator
- **NO:** Continue to standard `messageProcessor.process()` → Returns complete response

---

## Complete Processing Pipeline

### **File:** `supabase/functions/chat/processor/index.ts` (MessageProcessor)

The MessageProcessor orchestrates a **5-stage pipeline**:

```
1. ParsingStage       → Message structure parsing
2. ValidationStage    → Schema + business rule validation
3. EnrichmentStage    → Context window + memory enrichment
4. MainProcessingStage → LLM calls + tool execution
5. ResponseStage      → Final metadata + audit info
```

### **Pipeline Flow:**

```typescript
// File: supabase/functions/chat/processor/index.ts
async process(request: any, options?: ProcessOptions): Promise<any> {
  // Create message from request
  const message = createMessage(request);
  
  // Extract context
  const context: ProcessingContext = {
    conversation_id: message.conversation_id,
    session_id: message.session_id,
    agent_id: message.context?.agent_id,
    user_id: message.context?.user_id,
    channel_id: message.context?.channel_id,
    workspace_id: message.context?.workspace_id,
    request_options: options,
  };
  
  // Initialize metrics
  let metrics: ProcessingMetrics = {
    start_time: Date.now(),
    end_time: 0,
    stages: {},
    tokens_used: 0,
    memory_searches: 0,
    tool_executions: 0,
  };
  
  // Run through pipeline stages
  let processedMessage = message;
  for (const stage of this.stages) {
    const stageStart = Date.now();
    processedMessage = await stage.process(processedMessage, context, metrics);
    metrics.stages[stage.name] = Date.now() - stageStart;
  }
  
  metrics.end_time = Date.now();
  
  // Build response
  return buildSuccessResponse(processedMessage, context, metrics);
}
```

---

## Conditional Statements & Breakout Points

### **Stage 1: Parsing** (`ParsingStage`)
**File:** `supabase/functions/chat/processor/stages.ts`

**No Conditionals** - Pass-through stage (parsing handled in `createMessage`)

---

### **Stage 2: Validation** (`ValidationStage`)
**File:** `supabase/functions/chat/processor/stages.ts`

#### **Conditional 1: Schema Validation**
```typescript
const validation = this.validator.validateMessage(message);

if (!validation.valid) {
  throw new ValidationError(validation.errors); // ❌ BREAKOUT
}
```

#### **Conditional 2: Token Limit**
```typescript
if (message.content.type === 'text') {
  const estimatedTokens = Math.ceil(message.content.text.length / 4);
  if (estimatedTokens > 100000) {
    throw new APIError(ErrorCode.CONTEXT_TOO_LARGE, '...'); // ❌ BREAKOUT
  }
}
```

#### **Conditional 3: Tool Limit**
```typescript
if (message.tools && message.tools.length > 10) {
  throw new APIError(ErrorCode.INVALID_REQUEST, 'Too many tool calls'); // ❌ BREAKOUT
}
```

---

### **Stage 3: Enrichment** (`EnrichmentStage`)
**File:** `supabase/functions/chat/processor/stages.ts`

#### **Conditional 1: Memory Search**
```typescript
const queryText = message.content.type === 'text' ? (message.content.text || '') : '';
if (queryText && context.agent_id) {
  // ✅ Execute memory search (episodic + semantic)
  const memoryResults = await this.memoryManager.contextualSearch(...);
} else {
  // ⏭️ Skip memory search
}
```

**Condition:** Message has text content AND agent_id exists
- **YES:** Query Pinecone (episodic) + GetZep (semantic)
- **NO:** Skip memory search, set default metrics

**Context Injection:** Memory results merged into `context_window.sections` array

---

### **Stage 4: Main Processing** (`MainProcessingStage`)
**File:** `supabase/functions/chat/processor/stages.ts` → Routes to `handlers.ts`

#### **Conditional 1: Handler Selection**
```typescript
const handler = this.handlers.find(h => h.canHandle(message));

if (!handler) {
  throw new APIError(ErrorCode.INVALID_MESSAGE_FORMAT, '...'); // ❌ BREAKOUT
}
```

**Handlers:**
- **`TextMessageHandler`** - `canHandle`: `message.content.type === 'text'` ← Most common
- **`StructuredMessageHandler`** - `canHandle`: `message.content.type === 'structured'`
- **`ToolCallHandler`** - `canHandle`: `message.tools?.length > 0`

---

### **Stage 4.1: Text Message Handler** (Main Flow)
**File:** `supabase/functions/chat/processor/handlers.ts` (`TextMessageHandler.handle()`)

This is where the **magic happens**. The handler executes a **6-step internal pipeline**:

```
STEP 1:  Message Preparation
STEP 1.5: Contextual Awareness Analysis ← 🆕
STEP 2:  Intent Classification ← 🆕
STEP 3:  Conditional Tool Loading
STEP 3.5: Contextual Guidance Injection ← 🆕
STEP 4:  Tool Guidance (if tools loaded)
STEP 5:  LLM Setup & Initial Call
STEP 6:  Tool Execution & MCP Retry Loop
STEP 7:  Final Synthesis (if tools were called)
STEP 8:  Response Finalization
```

---

### **STEP 1: Message Preparation**
**File:** `supabase/functions/chat/processor/handlers/message-preparation.ts`

#### **Context Delivered:**
1. **Agent System Prompt** (from `agents` table)
   - `system_instructions`
   - `assistant_instructions`
   - `description`, `personality`, `name`
   - `system_prompt_override` (if from temporary chat)
   - `chat_intent` (if from temporary chat)

2. **Context Window** (episodic/semantic memory from Stage 3)
   - Formatted sections from `message.context.context_window.sections`
   - Injected as `assistant` message

3. **Unified Context** (via `UnifiedContextLoader`)
   - **Working Memory:** Conversation summary, facts, action items
   - **Recent History:** Last N messages (configurable via `agent.settings.context_history_size`, default: 25)
   - Loaded in **parallel** using `Promise.all`
   - Injected as single `assistant` message

4. **Current User Message**

#### **Conditional: Skip Context for New Conversations**
```typescript
if (conversationId && context.agent_id && userId) {
  // ✅ Load unified context
  const unifiedContext = await this.contextLoader.loadContext(...);
  msgs.push(contextMessage);
} else {
  // ⏭️ Skip context load (new conversation, no history)
  console.log('[Context] ⏭️ Skipped (new conversation)');
}
```

**Output:** `messages` array ready for LLM

---

### **STEP 1.5: Contextual Awareness Analysis** ← 🆕
**File:** `supabase/functions/chat/processor/utils/contextual-awareness.ts`

#### **Purpose:** Understand what the user is ACTUALLY asking for, not just literal text

#### **Process:**
```typescript
const contextAnalyzer = new ContextualAwarenessAnalyzer(this.openai, this.supabase);
const contextualInterpretation = await contextAnalyzer.analyzeContext(
  userText,
  conversationId,
  context.agent_id,
  recentMessages
);
```

#### **LLM Call Details:**
- **Model:** `gpt-4o-mini` (fast + cheap)
- **Temperature:** `0.3` (consistent analysis)
- **Max Tokens:** `500`
- **Response Format:** `json_object`
- **System Prompt:** Fetched from `system_prompts` table (key: `contextual_awareness`), cached for 5 min

#### **Context Delivered to LLM:**
```
AGENT PROFILE:
- Name: {agent.name}
- Personality: {agent.personality}
- Specialization: {agent.description}

CONVERSATION SUMMARY:
- {summary.current_summary}
- Key Facts: {important_facts[]}
- Topics: {topics[]}
- Entities: {entities{}}
- Action Items: {action_items[]}

RECENT CONVERSATION:
1. User: {message}
2. Agent: {message}
...

CURRENT USER MESSAGE:
"{userMessage}"
```

#### **Output:**
```typescript
{
  originalMessage: string;
  interpretedMeaning: string;  // What user ACTUALLY means
  userIntent: string;           // What user wants to accomplish
  contextualFactors: string[];  // Factors that informed interpretation
  confidence: 'high' | 'medium' | 'low';
  resolvedReferences: {         // e.g., "it" → "the draft email"
    "it": "draft email to john@example.com",
    "them": "contacts John Doe and Jane Smith"
  };
  suggestedClarifications: string[]; // If ambiguous
  analysisTimeMs: number;
  fromCache: boolean;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

#### **Caching:**
- **Cache Key:** Hash of `(userMessage + conversationId + agentId + recentMessages[-2:])`
- **TTL:** 5 minutes
- **Max Size:** 500 entries
- **Eviction:** LRU (Least Recently Used)

**Cache Hit:** Returns cached interpretation in < 5ms

---

### **STEP 2: Intent Classification** ← 🆕
**File:** `supabase/functions/chat/processor/utils/intent-classifier.ts`

#### **Purpose:** Determine if user message requires tools BEFORE loading them (saves ~750ms)

#### **Process:**
```typescript
const classifier = new IntentClassifier(this.openai, this.supabase);
const classification = await classifier.classifyIntent(
  userText,
  context.agent_id || 'default',
  recentMessages,
  contextualInterpretation // ← Passed from Step 1.5!
);
```

#### **LLM Call Details:**
- **Model:** `gpt-4o-mini`
- **Temperature:** `0.3`
- **Max Tokens:** `150`
- **Response Format:** `json_object`
- **System Prompt:** Fetched from `system_prompts` table (key: `intent_classifier`), cached for 5 min

#### **Context Delivered to LLM:**
```
SYSTEM PROMPT (from database):
- REQUIRES TOOLS: send, search, create, get, find, schedule, etc.
- DOES NOT REQUIRE TOOLS: greetings, conversation, explanations, capability questions

CONTEXTUAL AWARENESS ANALYSIS: ← Priority context!
- Interpreted Meaning: {contextualInterpretation.interpretedMeaning}
- User's Actual Intent: {contextualInterpretation.userIntent}
- Resolved References: {contextualInterpretation.resolvedReferences}

RECENT CONVERSATION:
- {recentMessages.map(...)}

USER MESSAGE:
"{userMessage}"
```

#### **Key Distinction (from system prompt):**
```
❌ DOES NOT REQUIRE TOOLS (Capability Question):
  - "Are you able to get backlink information?"
  - "Can you send emails?"
  - "What tools do you have?"

✅ REQUIRES TOOLS (Action Request):
  - "Get backlink information for example.com"
  - "Send an email to john@example.com"
  - "Search my Gmail for invoices"
```

#### **Output:**
```typescript
{
  requiresTools: boolean;        // ← THE CRITICAL DECISION
  confidence: 'high' | 'medium' | 'low';
  detectedIntent: string;        // Human-readable intent
  suggestedTools: string[];      // Optional tool suggestions
  reasoning: string;             // Why this classification
  classificationTimeMs: number;
  fromCache: boolean;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

#### **Caching:**
- **Cache Key:** Hash of `(agentId + normalized message)`
- **TTL:** 5 minutes
- **Max Size:** 1000 entries
- **Eviction:** LRU

---

### **STEP 3: Conditional Tool Loading** ← 🔥 MAJOR PERFORMANCE OPTIMIZATION
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 158-172)

#### **THE BIG CONDITIONAL:**
```typescript
if (classification.requiresTools) {
  // ✅ Tools needed - LOAD THEM (~750ms)
  console.log(`[IntentClassifier] Loading tools...`);
  fcm = new FunctionCallingManager(this.supabase as any, authToken);
  availableTools = (context.agent_id && context.user_id)
    ? await fcm.getAvailableTools(context.agent_id, context.user_id)
    : [];
  console.log(`[IntentClassifier] ✅ Loaded ${availableTools.length} tools`);
} else {
  // ⏭️ Tools NOT needed - SKIP LOADING (~750ms saved!)
  console.log(`[IntentClassifier] ⚡ Skipped tool loading (~750ms saved)`);
}
```

**Condition:** `classification.requiresTools === true`
- **YES (Action Request):** Load tools from `FunctionCallingManager`
  - Queries `tool_catalog`, `user_integration_credentials`, `agent_integration_permissions`
  - Fetches MCP tools, Gmail tools, contact tools, etc.
  - Duration: ~750ms
  
- **NO (Capability Question/Conversation):** Skip tool loading entirely
  - Sets `availableTools = []`
  - Saves: ~750ms per message
  - **Impact:** 60-70% of messages skip tool loading

#### **Tool Loading Process** (when triggered):
```
FunctionCallingManager.getAvailableTools()
  ↓
1. Query agent's integration permissions
2. Query user's connected integrations
3. Fetch tool definitions from tool_catalog
4. Generate MCP tool schemas dynamically
5. Filter by agent settings (toggles)
6. Return normalized tool array
```

---

### **STEP 3.5: Contextual Guidance Injection** ← 🆕 ALWAYS RUNS
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 174-224)

#### **Purpose:** Inject contextual awareness results into LLM prompt

#### **Context Delivered:**
```typescript
const guidanceParts: string[] = [];

guidanceParts.push(`🧠 CONTEXTUAL UNDERSTANDING:`);
guidanceParts.push(`User said: "${userText}"`);

if (contextualInterpretation.interpretedMeaning !== userText) {
  guidanceParts.push(`Interpreted meaning: "${contextualInterpretation.interpretedMeaning}"`);
}

// Resolved references
if (Object.keys(contextualInterpretation.resolvedReferences || {}).length > 0) {
  guidanceParts.push(`\nResolved references:`);
  Object.entries(contextualInterpretation.resolvedReferences || {}).forEach(([ref, meaning]) => {
    guidanceParts.push(`  - "${ref}" refers to: ${meaning}`);
  });
}

// User intent
guidanceParts.push(`\nUser's actual intent: ${contextualInterpretation.userIntent}`);
guidanceParts.push(`Confidence: ${contextualInterpretation.confidence}`);

// Contextual factors
if (contextualInterpretation.contextualFactors && contextualInterpretation.contextualFactors.length > 0) {
  guidanceParts.push(`\nContextual factors:`);
  contextualInterpretation.contextualFactors.forEach(factor => {
    guidanceParts.push(`  - ${factor}`);
  });
}

// Clarifications if needed
if (contextualInterpretation.suggestedClarifications && contextualInterpretation.suggestedClarifications.length > 0) {
  guidanceParts.push(`\n⚠️ Ambiguous request - consider asking:`);
  contextualInterpretation.suggestedClarifications.forEach(clarification => {
    guidanceParts.push(`  - ${clarification}`);
  });
}

guidanceParts.push(`\nRespond to their ACTUAL INTENT (${contextualInterpretation.userIntent}), not just the literal message text.`);

const contextualGuidance = guidanceParts.join('\n');
msgs.push({ role: 'system', content: contextualGuidance });
```

**Example Output:**
```
🧠 CONTEXTUAL UNDERSTANDING:
User said: "Send it to them"
Interpreted meaning: "Send the Q4 proposal draft to client John Doe"

Resolved references:
  - "it" refers to: Q4 proposal draft
  - "them" refers to: client John Doe

User's actual intent: Compose and send an email with the Q4 proposal to John Doe
Confidence: high

Contextual factors:
  - Recent discussion about Q4 proposal
  - Pronoun "them" refers to John Doe (mentioned in previous messages)

Respond to their ACTUAL INTENT (Compose and send an email with the Q4 proposal to John Doe), not just the literal message text.
```

**Critical:** This is injected as a `system` message BEFORE the main LLM call, ensuring the LLM understands context

---

### **STEP 4: Tool Guidance** (Conditional)
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 226-237)

#### **Conditional:**
```typescript
if (availableTools.length > 0) {
  // ✅ Tools are loaded - add guidance
  const toolNames = availableTools.map((t) => t.name).join(', ');
  const guidance = this.promptBuilder.buildToolGuidance(toolNames);
  msgs.push({ role: 'system', content: guidance });

  // Add explicit instruction for action requests
  msgs.push({
    role: 'system',
    content: `CRITICAL: If the user's message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.`,
  });
} else {
  // ⏭️ No tools - skip guidance
}
```

**Context Delivered (if tools present):**
```
Available Tools: {comma-separated list of tool names}

Tool Usage Guidelines:
- Use appropriate tools when user requests specific actions
- Validate inputs before calling tools
- Explain what you're doing when calling tools

CRITICAL: If the user's message is a REQUEST or COMMAND (send, create, search, get, find, etc.), you MUST call the appropriate tool function. DO NOT just respond with text saying you will do it - actually call the function. This is MANDATORY for all action requests.
```

---

### **STEP 5: LLM Setup & Initial Call**
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 239-308)

#### **Model Selection Logic:**

##### **Conditional 1: LLM Router Enabled?**
```typescript
const useRouter = (typeof (globalThis as any).Deno !== 'undefined')
  ? (globalThis as any).Deno.env.get('USE_LLM_ROUTER')?.toLowerCase() === 'true'
  : false;
```

##### **Conditional 2: Agent Model Override?**
```typescript
if (useRouter && context.agent_id) {
  try {
    const mod = await import('../../shared/llm/router.ts');
    const LLMRouter = (mod as any).LLMRouter;
    router = LLMRouter ? new LLMRouter() : null;
    
    if (router) {
      const resolved = await router.resolveAgent(context.agent_id).catch(() => null);
      effectiveModel = resolved?.prefs?.model || effectiveModel; // ← Agent-specific model!
      console.log('[TextMessageHandler] Resolved model:', effectiveModel);
    }
  } catch (_) {
    router = null;
  }
}
```

**Model Determination Hierarchy:**
```
1. DEFAULT: 'gpt-4'
2. IF (USE_LLM_ROUTER=true AND router.resolveAgent(agent_id) succeeds):
   → Use agent's configured model from router (e.g., 'gpt-4o', 'claude-3-5-sonnet')
3. ELSE: 
   → Use default 'gpt-4'
```

**Agent Model Configuration:**
- Stored in: `agents` table → `metadata` JSONB field → `model` key
- Retrieved by: LLM Router (file: `supabase/functions/_shared/llm/router.ts`)
- Supports: OpenAI, Anthropic, Gemini models

#### **LLM Call:**
```typescript
const llmCaller = new LLMCaller(this.openai, router, context.agent_id);

const llmResult = await llmCaller.call({
  messages: msgs,              // Full context assembled in Steps 1-4
  tools: normalizedTools,      // Empty if Step 3 skipped tool loading
  temperature: 0.7,
  maxTokens: 1200,
  userMessage: userText,       // For tool_choice determination
});
```

##### **LLMCaller Logic** (`supabase/functions/chat/processor/handlers/llm-caller.ts`):

###### **tool_choice Determination:**
```typescript
private determineToolChoice(options: LLMCallOptions): 'auto' | 'required' | 'none' | undefined {
  // Explicit override
  if (options.toolChoice !== undefined) {
    return options.toolChoice;
  }

  // No tools available
  if (!options.tools || options.tools.length === 0) {
    return undefined;
  }

  // Detect if user message implies tool use
  if (options.userMessage && this.detectToolIntent(options.userMessage)) {
    return 'required'; // ← Force tool use for action requests
  }

  // Default
  return 'auto';
}
```

###### **detectToolIntent():**
Checks for action verbs: `send`, `create`, `get`, `show`, `find`, `search`, `list`, `retrieve`, `fetch`, `add`, `update`, `delete`, etc.

**tool_choice Values:**
- `'required'` - LLM MUST call a tool (for action requests like "send email")
- `'auto'` - LLM decides (for ambiguous messages)
- `'none'` - LLM MUST NOT call tools (synthesis phase)
- `undefined` - No tools available

###### **Router vs Direct OpenAI:**
```typescript
if (this.router && this.agentId) {
  // ✅ Use LLM Router (multi-provider support)
  const resp = await this.router.chat(this.agentId, options.messages, { ... });
} else {
  // ⏭️ Fallback to direct OpenAI Chat Completions API
  const completion = await this.openai.chat.completions.create({ ... });
}
```

---

### **STEP 6: Tool Execution & MCP Retry Loop** (Conditional)
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 310-428)

#### **Conditional: Tools Called?**
```typescript
let toolCalls = llmResult.toolCalls || [];

if (toolCalls.length > 0 && fcm) {
  // ✅ LLM called tools - execute them
  
  // Add assistant message with tool calls
  msgs.push({
    role: 'assistant',
    content: llmResult.text || '',
    tool_calls: toolCalls,
  });

  // Execute tools with intelligent retry
  const toolExecResult = await ToolExecutor.executeToolCalls(...);

  // Check if MCP retry needed
  if (toolExecResult.requiresLLMRetry) {
    // ✅ Enter MCP Retry Loop
    const mcpResult = await MCPRetryLoop.execute({ ... });
  }

  // Get final synthesis
  const finalLLMResult = await llmCaller.call({
    messages: synthesisMessages,
    tools: [],               // ← CRITICAL: Empty tools = force text synthesis
    temperature: 0.5,
    maxTokens: 1200,
    toolChoice: undefined,
    userMessage: undefined,
  });
} else {
  // ⏭️ No tools called - skip to finalization
}
```

#### **Tool Execution Process:**

**File:** `supabase/functions/chat/processor/utils/tool-executor.ts`

```
executeToolCalls()
  ↓
For each tool_call:
  1. Extract function name and arguments
  2. Call FunctionCallingManager.executeToolCall()
  3. Append tool result to messages array
  4. Track tokens used
  5. Check if tool failed → set requiresLLMRetry flag
  ↓
Return: { toolDetails, tokensUsed, requiresLLMRetry }
```

#### **MCP Retry Loop** (if tool failed):

**File:** `supabase/functions/chat/processor/handlers/mcp-retry-loop.ts`

```
MCPRetryLoop.execute()
  ↓
WHILE (retryAttempts < 3 AND requiresRetry):
  1. Add reflection guidance
  2. Call LLM again with tool error context
  3. Execute new tool calls
  4. Check if tool succeeded
  5. If failed, increment retryAttempts
  ↓
Return: { toolDetails, promptTokens, completionTokens, retryAttempts }
```

**Purpose:** LLM can self-correct tool parameters based on error messages (e.g., "email field required" → LLM adds email to next attempt)

#### **Final Synthesis** (if tools were executed):

**Critical Message Conversion:**
```typescript
const synthesisMessages = msgs.map((msg: any, index: number) => {
  // Keep system and user messages as-is
  if (msg.role === 'system' || msg.role === 'user') {
    return msg;
  }
  
  // Convert tool messages to user messages
  if (msg.role === 'tool') {
    return {
      role: 'user',
      content: `[Tool Result]\n${msg.content}`
    };
  }
  
  // Remove tool_calls from assistant messages
  if (msg.role === 'assistant') {
    const { tool_calls, ...rest } = msg;
    return {
      ...rest,
      content: rest.content || ''
    };
  }
  
  return msg;
});
```

**Why?** OpenAI requires `tool` messages to follow `assistant` messages with `tool_calls`. Since we're setting `tools: []` (no more tools allowed), we must convert `tool` messages to `user` messages to avoid API errors.

**Synthesis Call:**
```typescript
const finalLLMResult = await llmCaller.call({
  messages: synthesisMessages,
  tools: [],               // ← Force text-only response
  temperature: 0.5,
  maxTokens: 1200,
  toolChoice: undefined,
  userMessage: undefined,
});
```

**Result:** Clean, formatted response incorporating tool results

---

### **STEP 7: Response Finalization**
**File:** `supabase/functions/chat/processor/handlers.ts` (lines 430-538)

#### **Build Metrics Object:**
```typescript
const metrics: ProcessingMetrics = {
  start_time: startTime,
  end_time: endTime,
  tokens_used: promptTokens + completionTokens,
  memory_searches: summaryInfo ? 1 : 0,
  tool_executions: toolDetails.length,
  stages: {
    message_prep: 100,
    contextual_awareness: contextualInterpretation.analysisTimeMs || 0,
    intent_classification: classification.classificationTimeMs || 0,
    tool_loading: availableTools.length > 0 ? 750 : 0,
    llm_calls: endTime - startTime,
  },
  discovered_tools: availableTools.map((t) => ({ name: t.name, description: t.description })),
  tool_details: toolDetails,
  contextual_awareness: { ... },     // Full contextual interpretation
  intent_classification: { ... },   // Full classification result
  llm_calls: llmCalls,              // ← Array of all LLM calls for Debug Modal
};
```

#### **Build Response Message:**
```typescript
const responseMessage: AdvancedChatMessage = {
  id: generateMessageId(),
  version: '2.0.0',
  role: 'assistant',
  content: { type: 'text', text },
  timestamp: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  metadata: { 
    tokens: promptTokens + completionTokens,
    processing_time_ms: endTime - startTime,
    tool_execution_count: toolDetails.length,
    memory_searches: summaryInfo ? 1 : 0,
    requires_user_input: requiresUserInput,
    user_input_request: userInputRequest,
    tool_call_id: toolRequiringInput?.id,
    processingDetails: metrics, // ← Full metrics for Debug Modal
  },
  context: { ... },
  artifacts: artifacts,
  tool_details: toolDetails,
};

return {
  message: responseMessage,
  context,
  metrics,
};
```

---

### **Stage 5: Response** (`ResponseStage`)
**File:** `supabase/functions/chat/processor/stages.ts`

**Adds final metadata:**
```typescript
message.metadata = {
  ...message.metadata,
  processed_at: new Date().toISOString(),
  processing_time_ms: Date.now() - metrics.start_time,
  pipeline_stages: Object.keys(metrics.stages),
};

message.audit = {
  created_by: context.user_id,
  created_at: message.created_at,
  ip_address: '0.0.0.0',
  user_agent: 'Unknown',
};
```

---

## Context Delivery Through Each Stage

### **Complete Message Array Structure (sent to LLM):**

```javascript
[
  // STEP 1: Agent System Prompt
  {
    role: 'system',
    content: `You are {agent.name}, {agent.description}\n\nPersonality: {agent.personality}\n\nInstructions: {agent.system_instructions}`
  },
  
  // STEP 1: Context Window (Episodic/Semantic Memory from Stage 3)
  {
    role: 'assistant',
    content: `=== CONTEXT WINDOW ===\n\nEPISODIC MEMORY:\n{memory snippets}\n\nSEMANTIC MEMORY:\n{knowledge graphs}\n\n=== END CONTEXT WINDOW ===`
  },
  
  // STEP 1: Unified Context (Working Memory + Recent History)
  {
    role: 'assistant',
    content: `=== CONVERSATION SUMMARY ===\n{summary}\n\nKEY FACTS:\n{facts}\n\nACTION ITEMS:\n{action_items}\n\n=== RECENT CONVERSATION HISTORY ===\nUser: {message 1}\nAgent: {message 2}\n...\n=== END RECENT CONVERSATION HISTORY ===`
  },
  
  // STEP 3.5: Contextual Guidance (ALWAYS INJECTED)
  {
    role: 'system',
    content: `🧠 CONTEXTUAL UNDERSTANDING:\nUser said: "Send it to them"\nInterpreted meaning: "Send Q4 proposal to John Doe"\n\nResolved references:\n  - "it" → Q4 proposal draft\n  - "them" → John Doe\n\nUser's actual intent: Compose and send email with Q4 proposal to John Doe\nConfidence: high\n\nRespond to their ACTUAL INTENT, not literal text.`
  },
  
  // STEP 4: Tool Guidance (if tools loaded)
  {
    role: 'system',
    content: `Available Tools: gmail_send_email, search_contacts, create_calendar_event\n\nCRITICAL: If user's message is a REQUEST or COMMAND, you MUST call the tool. DO NOT just say you will do it - actually call the function.`
  },
  
  // Current User Message
  {
    role: 'user',
    content: 'Send it to them'
  }
]
```

**Total Context Delivered:**
1. Agent personality & instructions
2. Episodic memory (recent events)
3. Semantic memory (knowledge graphs)
4. Conversation summary
5. Key facts & action items
6. Recent message history (last 25 messages)
7. Contextual interpretation of current message
8. Resolved implicit references
9. User's actual intent
10. Available tools (if any)
11. Tool usage instructions
12. Current user message

---

## LLM Model Determination

### **Model Selection Decision Tree:**

```
START
  ↓
[Environment Variable Check]
  USE_LLM_ROUTER === 'true'?
  ├─ NO → Use 'gpt-4' (default) → END
  └─ YES ↓
  
[Router Availability Check]
  LLMRouter module exists?
  ├─ NO → Use 'gpt-4' (fallback) → END
  └─ YES ↓
  
[Agent Resolution]
  router.resolveAgent(agent_id) succeeds?
  ├─ NO → Use 'gpt-4' (fallback) → END
  └─ YES ↓
  
[Model Extraction]
  agent.prefs.model exists?
  ├─ NO → Use 'gpt-4' (fallback) → END
  └─ YES → Use agent.prefs.model → END
```

### **Supported Models** (via LLM Router):

**OpenAI:**
- `gpt-4` (default)
- `gpt-4-turbo`
- `gpt-4o`
- `gpt-4o-mini`

**Anthropic:**
- `claude-3-5-sonnet-20241022`
- `claude-3-7-sonnet-20250219`
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

**Google:**
- `gemini-1.5-pro`
- `gemini-1.5-flash`

### **Where Model is Stored:**

**Database:** `agents` table
**Column:** `metadata` (JSONB)
**Path:** `metadata.model`

**Example:**
```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 1200
}
```

### **Special Models (Hardcoded):**

**Contextual Awareness:** `gpt-4o-mini` (always)
**Intent Classification:** `gpt-4o-mini` (always)
**LLMCaller Fallback:** `gpt-4o-mini` (when router not available)

---

## Tool Loading Logic

### **Complete Tool Loading Decision Tree:**

```
START (Step 2: Intent Classification Complete)
  ↓
[Check Classification Result]
  classification.requiresTools === true?
  ├─ NO → Skip tool loading → availableTools = [] → END
  └─ YES ↓
  
[Context Validation]
  context.agent_id AND context.user_id exist?
  ├─ NO → Skip tool loading → availableTools = [] → END
  └─ YES ↓
  
[Tool Loading]
  fcm = new FunctionCallingManager(supabase, authToken)
  availableTools = await fcm.getAvailableTools(agent_id, user_id)
  ↓
[Tool Filtering]
  Filter tools by:
  1. Agent integration permissions (agent_integration_permissions table)
  2. User connected integrations (user_integration_credentials table)
  3. Agent tool toggles (agent.metadata.tool_settings)
  4. Service provider enabled status
  ↓
[Tool Normalization]
  normalizedTools = this.normalizeTools(availableTools)
  - Validate tool schemas
  - Drop malformed tools
  - Format for OpenAI function calling
  ↓
END (Tools ready for LLM)
```

### **FunctionCallingManager.getAvailableTools() Process:**

**File:** `supabase/functions/chat/function_calling/manager.ts`

```
1. Query agent_integration_permissions
   WHERE agent_id = {agent_id}
   → Get list of allowed integration categories

2. Query user_integration_credentials
   WHERE user_id = {user_id}
   → Get list of connected services (Gmail, Outlook, etc.)

3. Query tool_catalog
   WHERE category IN (allowed_categories)
   AND provider_name IN (connected_services)
   → Get tool definitions

4. Fetch Agent Tool Settings
   FROM agents.metadata.tool_settings
   → Check toggles: web_search_enabled, voice_enabled, etc.

5. Filter Tools by Settings
   - IF web_search_enabled = false → Remove serper_api tools
   - IF voice_enabled = false → Remove elevenlabs tools
   - IF document_creation_enabled = false → Remove canvas tools
   - etc.

6. Generate Dynamic MCP Tools
   - Query agent_mcp_connections
   - Fetch MCP server capabilities
   - Generate tool schemas on-the-fly

7. Normalize and Return
   → Return array of { name, description, parameters }
```

### **Tool Categories:**

**Email:**
- Gmail: `gmail_send_email`, `gmail_search_messages`, `gmail_get_thread`, etc.
- Outlook: `outlook_send_email`, `outlook_search_messages`, etc.
- SMTP: `smtp_send_email`

**Contacts:**
- `search_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact`

**Calendar:**
- `create_calendar_event`, `search_calendar_events`, `update_calendar_event`, `delete_calendar_event`

**Web Search:**
- `serper_web_search`, `serper_news_search`, `serper_image_search`

**Voice:**
- `elevenlabs_text_to_speech`, `elevenlabs_get_voices`

**Documents:**
- `create_canvas_document`, `update_canvas_document`, `get_canvas_document`

**MCP (Dynamic):**
- Zapier actions, custom MCP servers, etc.

---

## Caching Strategy

### **Cache 1: Contextual Awareness**

**File:** `supabase/functions/chat/processor/utils/contextual-awareness.ts`

**Implementation:**
```typescript
private cache: Map<string, ContextualInterpretation> = new Map();
private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
private readonly CACHE_MAX_SIZE = 500;
```

**Cache Key Generation:**
```typescript
private generateCacheKey(
  message: string,
  conversationId: string | undefined,
  recentMessages?: RecentMessage[]
): string {
  // Include last 2 messages for context sensitivity
  const recentContext = recentMessages
    ?.slice(-2)
    .map(m => `${m.role}:${m.content.substring(0, 50)}`)
    .join('|') || '';
  
  return `${conversationId || 'new'}:${message.substring(0, 100)}:${recentContext}`;
}
```

**Eviction:** LRU (delete oldest when full)

**Performance:**
- **Cache Hit:** < 5ms (no LLM call)
- **Cache Miss:** ~2-3 seconds (LLM call to gpt-4o-mini)
- **Expected Hit Rate:** 15-25%

---

### **Cache 2: Intent Classification**

**File:** `supabase/functions/chat/processor/utils/intent-classifier.ts`

**Implementation:**
```typescript
private cache: Map<string, CachedClassification> = new Map();
private readonly CACHE_TTL = 300000; // 5 minutes
private readonly MAX_CACHE_SIZE = 1000;
```

**Cache Key Generation:**
```typescript
private generateCacheKey(message: string, agentId: string): string {
  const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
  const hash = this.hashString(normalized);
  return `${agentId}:${hash}`;
}
```

**Eviction:** LRU

**Performance:**
- **Cache Hit:** < 5ms
- **Cache Miss:** ~1-2 seconds (LLM call to gpt-4o-mini)
- **Expected Hit Rate:** 30-40%

---

### **Cache 3: System Prompts**

**Files:**
- `supabase/functions/chat/processor/utils/contextual-awareness.ts`
- `supabase/functions/chat/processor/utils/intent-classifier.ts`

**Implementation:**
```typescript
private systemPrompt: string | null = null;
private promptLastFetched: number = 0;
private readonly PROMPT_CACHE_TTL = 300000; // 5 minutes
```

**Fetch Logic:**
```typescript
private async getSystemPrompt(): Promise<string> {
  const now = Date.now();
  
  // Return cached if still valid
  if (this.systemPrompt && (now - this.promptLastFetched) < this.PROMPT_CACHE_TTL) {
    return this.systemPrompt;
  }
  
  // Try to fetch from database
  try {
    const { data, error } = await this.supabase
      .from('system_prompts')
      .select('content')
      .eq('key', 'contextual_awareness')
      .eq('is_active', true)
      .single();
    
    if (!error && data?.content) {
      this.systemPrompt = data.content;
      this.promptLastFetched = now;
      return data.content;
    }
  } catch (error) {
    console.warn('Error fetching prompt from database, using hardcoded fallback');
  }
  
  // Fallback to hardcoded prompt
  this.systemPrompt = HARDCODED_PROMPT;
  this.promptLastFetched = now;
  return this.systemPrompt;
}
```

**Benefits:**
- Reduces DB queries by 95%+
- Allows runtime prompt updates without code deployment
- Graceful fallback to hardcoded prompts

---

## Complete Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                               USER REQUEST                                  │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │   ENTRY POINT (index.ts)     │
                    │  - CORS handling             │
                    │  - Authentication            │
                    │  - Request parsing           │
                    │  - Schema validation         │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │   Streaming Check            │
                    └──────────────┬───────────────┘
                             YES/NO↓
              ┌────────────────────┴────────────────────┐
              ↓                                         ↓
    ┌─────────────────┐                    ┌─────────────────────┐
    │ handleStreaming │                    │  Standard Processing│
    │   Request()     │                    │   (continues below) │
    └─────────────────┘                    └─────────────────────┘
                                                       ↓
                                   ┌──────────────────────────────┐
                                   │   Conversation Session       │
                                   │   - ensureConversationSession│
                                   │   - Generate AI title        │
                                   └──────────────┬───────────────┘
                                                  ↓
                                   ┌──────────────────────────────┐
                                   │   MessageProcessor.process() │
                                   │   5-Stage Pipeline:          │
                                   └──────────────┬───────────────┘
                                                  ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 1: PARSING                                    │
│  - Message structure parsing (handled in createMessage)                       │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 2: VALIDATION                                   │
│  Conditional 1: Schema valid? → NO → throw ValidationError ❌                │
│  Conditional 2: Tokens < 100K? → NO → throw CONTEXT_TOO_LARGE ❌            │
│  Conditional 3: Tools < 10? → NO → throw INVALID_REQUEST ❌                  │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                         STAGE 3: ENRICHMENT                                   │
│  Conditional: Has text & agent_id?                                            │
│    YES → Query MemoryManager (Pinecone + GetZep) → Inject context_window     │
│    NO  → Skip memory search                                                   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: MAIN PROCESSING                                   │
│                     (TextMessageHandler)                                      │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 1: Message Preparation  │
                    │  - Agent system prompt       │
                    │  - Context window            │
                    │  - Unified context loader    │
                    │    (Working Memory + History)│
                    │  - Current user message      │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 1.5: Contextual         │
                    │   Awareness Analysis         │
                    │  Model: gpt-4o-mini          │
                    │  Cache: 5min, 500 entries    │
                    │  Output: ContextualInterpret │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 2: Intent Classification│
                    │  Model: gpt-4o-mini          │
                    │  Cache: 5min, 1000 entries   │
                    │  Output: requiresTools bool  │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 3: Conditional Tool     │
                    │   Loading                    │
                    │  IF requiresTools = true:    │
                    │    Load tools (~750ms)       │
                    │  ELSE:                       │
                    │    Skip (save ~750ms)        │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 3.5: Inject Contextual  │
                    │   Guidance                   │
                    │  ALWAYS RUNS                 │
                    │  - Interpreted meaning       │
                    │  - Resolved references       │
                    │  - User intent               │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 4: Tool Guidance        │
                    │  (if tools loaded)           │
                    │  - List available tools      │
                    │  - Usage instructions        │
                    │  - CRITICAL instruction      │
                    └──────────────┬───────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ STEP 5: LLM Setup & Initial  │
                    │   Call                       │
                    │  Model Selection:            │
                    │   - Check USE_LLM_ROUTER     │
                    │   - Resolve agent model      │
                    │   - Fallback: gpt-4          │
                    │  tool_choice:                │
                    │   - 'required' if action     │
                    │   - 'auto' otherwise         │
                    └──────────────┬───────────────┘
                                   ↓
                           LLM Response
                                   ↓
                    ┌──────────────────────────────┐
                    │  Tool Calls Present?         │
                    └──────────────┬───────────────┘
                             YES/NO↓
              ┌────────────────────┴────────────────────┐
              ↓                                         ↓
    ┌──────────────────────┐               ┌────────────────────┐
    │ STEP 6: Tool         │               │ Skip to STEP 8     │
    │   Execution          │               └────────────────────┘
    │  - Execute tools     │
    │  - Check for errors  │
    └──────────┬───────────┘
               ↓
    ┌──────────────────────┐
    │  Tool Failed?        │
    └──────────┬───────────┘
         YES/NO↓
    ┌──────────┴────────────┐
    ↓                       ↓
┌────────────┐      ┌──────────────┐
│ MCP Retry  │      │ Continue to  │
│ Loop       │      │ Synthesis    │
│ (max 3x)   │      └──────────────┘
└────────────┘
       ↓
┌──────────────────────┐
│ STEP 7: Final        │
│   Synthesis          │
│  - Convert tool msgs │
│  - Set tools: []     │
│  - Call LLM again    │
│  - Get clean response│
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ STEP 8: Response     │
│   Finalization       │
│  - Build metrics     │
│  - Create response   │
│  - Attach metadata   │
└──────────┬───────────┘
           ↓
┌──────────────────────────────────────────┐
│        STAGE 5: RESPONSE                  │
│  - Add processed_at timestamp             │
│  - Add processing_time_ms                │
│  - Add pipeline_stages list              │
│  - Add audit info                        │
└──────────────────┬───────────────────────┘
                   ↓
        ┌──────────────────────┐
        │ Return to index.ts   │
        └──────────┬───────────┘
                   ↓
        ┌──────────────────────┐
        │ Message Persistence  │
        │  DualWriteService    │
        │  .saveMessage()      │
        └──────────┬───────────┘
                   ↓
        ┌──────────────────────┐
        │ Title Update (async) │
        │  After 3rd message   │
        └──────────┬───────────┘
                   ↓
        ┌──────────────────────┐
        │    HTTP RESPONSE     │
        │  Status: 200         │
        │  Body: JSON          │
        └──────────────────────┘
```

---

## Summary

### **Key Conditional Breakpoints:**

1. **Streaming vs Standard** (index.ts) - Routes to different processing paths
2. **Schema Validation** (ValidationStage) - Throws errors if invalid
3. **Token/Tool Limits** (ValidationStage) - Throws errors if exceeded
4. **Memory Search** (EnrichmentStage) - Skips if no text or agent_id
5. **Handler Selection** (MainProcessingStage) - Routes to appropriate handler
6. **Context Loading** (MessagePreparation) - Skips for new conversations
7. **Intent Classification** (TextMessageHandler) - Determines tool requirement
8. **Tool Loading** (TextMessageHandler) - Loads tools ONLY if needed (~750ms optimization)
9. **Contextual Guidance** (TextMessageHandler) - ALWAYS injected
10. **Tool Execution** (TextMessageHandler) - Executes tools if LLM called them
11. **MCP Retry Loop** (TextMessageHandler) - Retries failed tools up to 3x
12. **Final Synthesis** (TextMessageHandler) - Synthesizes tool results if tools were called

### **Context Delivery Points:**

1. **Agent Prompt** (Step 1) - System message
2. **Context Window** (Step 1) - Assistant message
3. **Unified Context** (Step 1) - Assistant message
4. **Contextual Guidance** (Step 3.5) - System message
5. **Tool Guidance** (Step 4) - System message
6. **User Message** (Step 1) - User message

### **LLM Models Used:**

1. **Contextual Awareness:** gpt-4o-mini (hardcoded)
2. **Intent Classification:** gpt-4o-mini (hardcoded)
3. **Main LLM Call:** Agent-configured model (via LLM Router) or gpt-4 (default)
4. **Tool Synthesis:** Same as main LLM call

### **Performance Optimizations:**

1. **Conditional Tool Loading:** Saves ~750ms for 60-70% of messages
2. **Parallel Context Loading:** Saves ~155ms per message
3. **Contextual Awareness Caching:** 15-25% hit rate, saves ~2-3s
4. **Intent Classification Caching:** 30-40% hit rate, saves ~1-2s
5. **System Prompt Caching:** Reduces DB queries by 95%+

---

**End of Investigation**

