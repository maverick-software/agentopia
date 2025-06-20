# Chat Function Analysis - Refactoring Plan

**File:** `supabase/functions/chat/index.ts`
**Current Size:** 695 lines
**Target Size:** <450 lines (main orchestrator)

## Current Structure Analysis

### Identified Logical Modules:

#### 1. **Vector Search Module** (Lines ~43-155)
- `getVectorSearchResults()` function
- Pinecone integration logic
- Embedding generation
- Vector query and formatting
- **Extract to:** `supabase/functions/chat/vector_search.ts`
- **Size:** ~110 lines

#### 2. **MCP Integration Module** (Lines ~156-322)
- MCP configuration management
- Vault API key handling
- MCP context preparation
- MCP server communication
- **Extract to:** `supabase/functions/chat/mcp_integration.ts`
- **Size:** ~165 lines

#### 3. **Workspace Management Module** (Lines ~349-417)
- `getWorkspaceDetails()` function
- Workspace member management
- Context settings handling
- **Extract to:** `supabase/functions/chat/workspace_manager.ts`
- **Size:** ~70 lines

#### 4. **Chat History Module** (Lines ~418-495)
- `getRelevantChatHistory()` function
- Channel-based and direct chat history
- Message formatting and filtering
- **Extract to:** `supabase/functions/chat/chat_history.ts`
- **Size:** ~80 lines

#### 5. **Authentication & Validation Module** (Lines ~496-540)
- Request authentication
- Rate limiting
- Request validation
- **Extract to:** `supabase/functions/chat/auth_handler.ts`
- **Size:** ~45 lines

#### 6. **Message Processing Module** (Lines ~540-695)
- User message handling
- Agent response generation
- Database operations
- Context building orchestration
- **Keep in main:** `supabase/functions/chat/index.ts`
- **Size:** ~155 lines + orchestration

## Refactoring Strategy

### Phase 1: Extract Support Modules
1. Create `vector_search.ts` - Pinecone/RAG functionality
2. Create `mcp_integration.ts` - MCP server communication
3. Create `workspace_manager.ts` - Workspace context handling
4. Create `chat_history.ts` - Message history management
5. Create `auth_handler.ts` - Authentication and validation

### Phase 2: Refactor Main Function
1. Import all extracted modules
2. Simplify main function to orchestrate modules
3. Maintain existing API contract
4. Ensure clean separation of concerns

## Dependencies to Preserve

### External Dependencies:
- OpenAI SDK
- Pinecone SDK
- Supabase client
- Rate limiter
- MCP Manager

### Internal Dependencies:
- ContextBuilder
- Types from types.ts
- Shared interfaces

## Success Criteria

- [x] All backups created
- [ ] Main index.ts < 450 lines
- [ ] Each extracted module < 200 lines
- [ ] All existing functionality preserved
- [ ] TypeScript compilation successful
- [ ] No breaking changes to API

## File Structure After Refactoring

```
supabase/functions/chat/
├── index.ts                 (~350 lines - main orchestrator)
├── vector_search.ts         (~110 lines - Pinecone/RAG)
├── mcp_integration.ts       (~165 lines - MCP servers)
├── workspace_manager.ts     (~70 lines - workspace context)
├── chat_history.ts          (~80 lines - message history)
├── auth_handler.ts          (~45 lines - auth & validation)
├── context_builder.ts       (existing - no changes)
├── manager.ts               (existing - no changes)
└── types.ts                 (existing - no changes)
```

Total lines reduction: 695 → 350 (main) + 470 (modules) = 820 lines across 6 files
Main file reduction: 695 → 350 lines (49% reduction) 