# LLM Debug Modal - Implementation Complete

**Date:** October 20, 2025  
**Status:** ✅ **IMPLEMENTED AND READY**  
**Feature:** LLM Debug Viewer for Chat Processing Pipeline

---

## 🎯 **Purpose**

Provide developers and power users with visibility into **every LLM call** made during a conversation turn, including:
- Request parameters (model, messages, tools, temperature)
- Response content (text, tool calls, usage stats)
- Timing information (duration per stage)
- Token usage per stage

This enables:
- ✅ Debugging AI responses
- ✅ Optimizing prompts
- ✅ Understanding processing flow
- ✅ Monitoring token usage
- ✅ Identifying bottlenecks

---

## 🏗️ **Architecture**

### **Button Location:**
Next to the "Process" button on assistant messages in the chat interface.

### **Modal Features:**
1. **Expandable Stages** - Each LLM call is a collapsible section
2. **Request/Response Viewer** - JSON formatted with syntax highlighting
3. **Copy to Clipboard** - One-click copy for each request/response
4. **Token Usage Stats** - Per-stage and total token counts
5. **Duration Tracking** - Time spent on each stage
6. **Pretty Formatting** - Color-coded JSON for readability

---

## 📁 **Files Created/Modified**

### **1. LLMDebugModal Component (NEW)**
**File:** `src/components/modals/LLMDebugModal.tsx`

**Features:**
- ✅ Expandable stage viewer
- ✅ JSON syntax highlighting (green for requests, blue for responses)
- ✅ Copy to clipboard with visual feedback
- ✅ Stats bar showing total stages/tokens/time
- ✅ "Expand All" button
- ✅ Responsive design with max-width

**Props:**
```typescript
interface LLMDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingDetails: any; // Contains LLM call data
}
```

**Data Structure:**
```typescript
interface LLMCall {
  stage: string;                    // e.g., 'contextual_awareness', 'intent_classification'
  description: string;              // e.g., '🧠 Contextual Awareness Analysis'
  request: {
    model?: string;
    messages?: any[];
    tools?: any[];
    temperature?: number;
    max_tokens?: number;
  };
  response: {
    content?: string;
    tool_calls?: any[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  timestamp?: string;
  duration_ms?: number;
}
```

---

### **2. MessageList Component (UPDATED)**
**File:** `src/components/chat/MessageComponents.tsx`

**Changes:**
- ✅ Added `onShowDebugModal` prop to `MessageListProps`
- ✅ Added purple "Debug" button next to "Process" button
- ✅ Button only shows when `message.metadata?.processingDetails` exists
- ✅ Hover effect: purple glow on hover
- ✅ Code icon (</> symbol)

**Code:**
```tsx
{/* Debug Button - Show LLM calls and responses */}
{message.metadata?.processingDetails && onShowDebugModal && (
  <button
    onClick={() => {
      console.log('[MessageList] Debug button clicked for message:', message);
      onShowDebugModal(message.metadata?.processingDetails);
    }}
    className="flex items-center space-x-1 cursor-pointer hover:bg-purple-500/20 rounded-md px-1.5 py-0.5 transition-colors"
    title="View LLM requests and responses"
  >
    <svg className="h-3 w-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
    <span className="text-xs text-purple-500">Debug</span>
  </button>
)}
```

---

### **3. AgentChatPage (UPDATED)**
**File:** `src/pages/AgentChatPage.tsx`

**Changes:**
- ✅ Added `showDebugModal` state
- ✅ Added `debugProcessingDetails` state
- ✅ Imported `LLMDebugModal` component
- ✅ Passed `onShowDebugModal` to `MessageList`
- ✅ Rendered `LLMDebugModal` at bottom of component

**Code:**
```tsx
// State
const [showDebugModal, setShowDebugModal] = useState(false);
const [debugProcessingDetails, setDebugProcessingDetails] = useState<any>(null);

// MessageList prop
onShowDebugModal={(details) => {
  console.log('[AgentChatPage] Debug modal opened with details:', details);
  setDebugProcessingDetails(details);
  setShowDebugModal(true);
}}

// Modal render
<LLMDebugModal
  isOpen={showDebugModal}
  onClose={() => setShowDebugModal(false)}
  processingDetails={debugProcessingDetails}
/>
```

---

## 🔄 **Processing Stages Displayed**

The modal displays LLM calls from these stages:

### **1. 🧠 Contextual Awareness Analysis**
- Model: `gpt-4o-mini`
- Purpose: Interpret user message in conversation context
- Shows: Resolved references, interpreted meaning, user intent

### **2. 🎯 Intent Classification**
- Model: `gpt-4o-mini`
- Purpose: Determine if tools are needed
- Shows: Classification result, confidence, reasoning

### **3. 💬 Main LLM Call**
- Model: `gpt-4` (or configured model)
- Purpose: Generate response or tool calls
- Shows: Full message history, tool schemas, response content

### **4. 🔧 Tool Execution**
- Purpose: Execute tools (MCP, integrations)
- Shows: Tool name, parameters, result, errors

### **5. 🔄 Retry Analysis** (if retries occurred)
- Model: `gpt-4o-mini`
- Purpose: Analyze tool failure and suggest fixes
- Shows: Error analysis, suggested parameter fixes

---

## 🎨 **UI Design**

### **Color Scheme:**
- **Purple** - Debug theme color
- **Green** - Request JSON (terminal-style)
- **Blue** - Response JSON
- **Yellow** - Sparkles icon (responses)
- **Dark background** - Code blocks with syntax highlighting

### **Layout:**
```
┌─────────────────────────────────────────────────────┐
│  🔧 LLM Debug Viewer                            [X]  │
│  View all LLM requests and responses...              │
├─────────────────────────────────────────────────────┤
│  ⚡ Total Stages: 5  |  🔥 Tokens: 2,340  |  ⏱ 1,250ms│
├─────────────────────────────────────────────────────┤
│                                                       │
│  ▶ #1 🧠 Contextual Awareness Analysis    342ms  │
│  ▶ #2 🎯 Intent Classification             123ms  │
│  ▼ #3 💬 Main LLM Call                     785ms  │
│     ├─ 📤 Request                          [Copy]  │
│     │   {                                           │
│     │     "model": "gpt-4",                         │
│     │     "messages": [...]                         │
│     │   }                                           │
│     │                                               │
│     └─ 📥 Response                         [Copy]  │
│         {                                           │
│           "content": "Here is...",                  │
│           "usage": {...}                            │
│         }                                           │
│                                                     │
│  ▶ #4 🔧 Tool: zapier_search_contact        89ms  │
│                                                       │
├─────────────────────────────────────────────────────┤
│  💡 Tip: Click any stage to expand...  [Expand All] │
└─────────────────────────────────────────────────────┘
```

---

## 📊 **Example: What Users Will See**

### **Contextual Awareness Stage:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a contextual awareness analyzer..."
    },
    {
      "role": "user",
      "content": "AGENT PROFILE:\nName: Jordan's Agent\n\nCURRENT USER MESSAGE:\n\"Send him an email\""
    }
  ],
  "temperature": 0.3,
  "max_tokens": 500
}

// Response:
{
  "content": "{\n  \"interpretedMeaning\": \"Send an email to John Doe\",\n  \"userIntent\": \"Compose and send email\",\n  \"resolvedReferences\": {\n    \"him\": \"John Doe\"\n  }\n}",
  "usage": {
    "prompt_tokens": 245,
    "completion_tokens": 87,
    "total_tokens": 332
  }
}
```

### **Main LLM Call Stage:**
```json
{
  "model": "gpt-4",
  "messages": [
    { "role": "system", "content": "You are Jordan's Agent..." },
    { "role": "assistant", "content": "=== CONTEXT WINDOW ===" },
    { "role": "system", "content": "🧠 CONTEXTUAL UNDERSTANDING: User said: \"Send him an email\" But actually means: \"Send email to John Doe\"" },
    { "role": "user", "content": "Send him an email" }
  ],
  "tools": [
    { "name": "gmail_send_email", "description": "Send an email via Gmail", "parameters": {...} }
  ],
  "temperature": 0.7,
  "max_tokens": 1200
}

// Response:
{
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "gmail_send_email",
        "arguments": "{\"to\":\"john.doe@example.com\",\"subject\":\"Hello\",\"body\":\"Hi John!\"}"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1,234,
    "completion_tokens": 156,
    "total_tokens": 1,390
  }
}
```

---

## 🚀 **Usage Flow**

### **For Users:**
1. Send a message to an agent
2. Agent responds
3. See "Process" and "Debug" buttons next to the response
4. Click **"Debug"** button
5. Modal opens showing all LLM stages
6. Click any stage to expand and view details
7. Click "Copy" to copy request/response JSON
8. Click "Expand All" to see everything at once

### **For Developers:**
- Use to debug why agent gave a certain response
- Optimize prompts by seeing what's sent to LLM
- Monitor token usage per stage
- Identify which stage is slowest
- Copy exact requests to test in OpenAI playground

---

## ✅ **Benefits**

| Before | After |
|--------|-------|
| ❌ No visibility into LLM calls | ✅ Full transparency of all stages |
| ❌ Can't see why agent responded that way | ✅ See exact prompts and responses |
| ❌ Hard to debug tool selection issues | ✅ See tool schemas sent to LLM |
| ❌ No token usage breakdown | ✅ Per-stage token usage visible |
| ❌ Can't optimize prompts | ✅ Copy exact requests to test |

---

## 🎯 **Future Enhancements**

Potential additions (not implemented yet):
- [ ] Search/filter stages
- [ ] Export all data as JSON file
- [ ] Compare two different responses side-by-side
- [ ] Show diff between retry attempts
- [ ] Performance graphs (time per stage)
- [ ] Cost calculation (tokens × pricing)
- [ ] Save favorite debugging sessions

---

## 📝 **Testing Checklist**

- [x] Button appears next to Process button
- [x] Button only shows when processingDetails exists
- [x] Modal opens when Debug button clicked
- [x] All stages display correctly
- [x] Expand/collapse works
- [x] Copy to clipboard works
- [x] Token usage displays correctly
- [x] Duration displays correctly
- [x] "Expand All" button works
- [x] Close button works
- [x] Responsive on mobile
- [x] No linting errors

---

## 🎉 **Summary**

**The LLM Debug Modal is now LIVE!** 🚀

Users can now:
- ✅ See **every LLM call** made during chat processing
- ✅ View **full requests and responses** with syntax highlighting
- ✅ **Copy JSON** to clipboard for testing
- ✅ Track **token usage** and **timing** per stage
- ✅ **Debug AI behavior** by seeing exact prompts
- ✅ **Optimize performance** by identifying slow stages

**This provides unprecedented visibility into the AI pipeline!** 🔍✨

---

**Implementation Complete:** October 20, 2025  
**Ready for Production:** ✅ YES  
**Location:** Next to "Process" button on agent messages  
**Icon:** Purple `</>` code symbol

