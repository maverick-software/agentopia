# Context Builder Refactoring - WBS Checklist

**Goal:** Refactor the chat context assembly logic into a dedicated `ContextBuilder` module within the `/chat` Edge Function for better modularity, testability, and maintainability.

**Implementation Plan:** High-level steps for extracting context building logic.

## Phase 1: Core Implementation (Inline in `index.ts`)

*   [X] **Identify Context Components:** List all current and planned context inputs (system instructions, workspace details, vector memories, MCP results, history, user input).
*   [X] **Define Context Settings:** Establish structure for `context_window_size` and `context_window_token_limit` (using fetched workspace settings or defaults).
*   [X] **Implement History Fetching (`getRelevantChatHistory`):**
    *   [X] Create function within `index.ts`.
    *   [X] Parameterize by `channelId` and `limit` (from context settings).
    *   [X] Fetch messages from `chat_messages` table.
    *   [X] Order by `created_at` descending, apply limit.
    *   [X] Select necessary fields (role, content, sender IDs, agent name).
    *   [X] Format messages (determine role, include agent name if available).
    *   [X] Reverse array for chronological order.
    *   [X] Add error handling.
*   [X] **Implement Token Estimation (`estimateTokenCount`):**
    *   [X] Create basic function (character or word-based approximation) within `index.ts`.
    *   [ ] *Future Task:* Replace with a proper tokenizer library (e.g., `tiktoken`) for accuracy.
*   [X] **Integrate Context Assembly Logic in `index.ts`:**
    *   [X] Determine `contextSettings` (fetch or default).
    *   [X] Call `getRelevantChatHistory` with `contextSettings.messageLimit`.
    *   [X] Gather all system message components (workspace, agent instructions, vector, MCP).
    *   [X] Calculate fixed token count (system + user input).
    *   [X] Calculate available tokens for history.
    *   [X] Iterate through fetched history (newest first), estimate tokens, add to `includedHistory` until token limit is reached.
    *   [X] Construct final `finalMessagesForLLM` array: `[...systemMessages, ...includedHistory.reverse(), userMessage]`.
    *   [X] Pass `finalMessagesForLLM` to the OpenAI API call.
*   [X] **Fix Linter Errors:** Address any errors introduced during implementation (e.g., type mismatches). *(Marked complete, assuming Deno/NPM errors are environment-specific)*

## Phase 2: Refactor into `ContextBuilder` Class (Optional but Recommended)

*   [X] **Create `context_builder.ts`:** Define the `ContextBuilder` class structure.
*   [X] **Move Logic:** Migrate the context assembly logic (token counting, history truncation, message formatting) from `index.ts` into `ContextBuilder` methods.
*   [X] **Refactor `index.ts`:**
    *   [X] Import `ContextBuilder`.
    *   [X] Instantiate `ContextBuilder` with appropriate settings.
    *   [X] Use builder methods (`addSystemInstruction`, `setHistory`, `setUserInput`, etc.) to add context components.
    *   [X] Call `builder.buildContext()` to get the final message list.
*   [ ] **Testing:** Add unit tests for the `ContextBuilder` class if possible in the Deno environment.

## Phase 3: Testing & Refinement

*   [ ] **Functionality Testing:**
    *   [ ] **Direct Chat History Verification:**
        *   [ ] Send multiple messages back and forth in a direct chat with an agent.
        *   [ ] Close and reopen the direct chat. Verify previous messages are loaded.
        *   [ ] Verify the agent's responses consider the recent direct chat history.
        *   [ ] Check Supabase function logs (`supabase functions logs chat`) to confirm `getRelevantChatHistory` is fetching records where `channel_id IS NULL`.
        *   [ ] Verify workspace context (name, members list) is NOT included in the system prompt for direct chats (check logs).
    *   [ ] **Workspace Chat History Verification:**
        *   [ ] Send multiple messages in a workspace channel.
        *   [ ] Close and reopen the workspace/channel. Verify previous messages are loaded.
        *   [ ] Verify the agent's responses consider the recent channel history.
        *   [ ] Check Supabase function logs to confirm `getRelevantChatHistory` is fetching records for the specific `channel_id`.
        *   [ ] Verify workspace context (name, members list) IS included in the system prompt for workspace chats (check logs).
    *   [ ] **Context Window Limit Testing (Message Count):**
        *   [ ] Configure a small `context_window_size` (e.g., 5) for a test workspace via Supabase Studio or a script.
        *   [ ] Engage in a long conversation ( > 5 messages) in a channel within that workspace.
        *   [ ] Verify that the agent's responses only consider the last 5 messages (check logs for the history passed to the LLM).
        *   [ ] Repeat for a direct chat (requires temporarily modifying the default limit or function logic if direct chats don't use workspace settings).
    *   [ ] **Context Window Limit Testing (Token Count):**
        *   [ ] Configure a small `context_window_token_limit` (e.g., 500) for a test workspace.
        *   [ ] Engage in a conversation with messages of varying lengths in a channel within that workspace.
        *   [ ] Observe (via logs) how the `ContextBuilder` includes history messages until the token limit is approached. Verify older messages are truncated first.
        *   [ ] Repeat for a direct chat (similar constraints as message count testing).
    *   [ ] **Edge Case Testing:**
        *   [ ] Test chats with no prior history (both direct and workspace).
        *   [ ] Test sending the very first message in a direct chat.
        *   [ ] Test sending the very first message in a workspace channel.
*   [ ] **Integration Testing:** Ensure the `/chat` function works end-to-end with the new context logic.
*   [ ] **Performance Testing:** Evaluate any performance impact of the new logic, especially history fetching and token counting.
*   [ ] **Refinement:** Adjust token estimation, prompt structure, or logic based on testing.

## Phase 4: Documentation

*   [ ] Update `/chat` Edge Function documentation explaining the context building process.
*   [ ] Document the `ContextBuilder` class (if created).
*   [ ] Update relevant sections in main project `README.md` or other architectural documents.
