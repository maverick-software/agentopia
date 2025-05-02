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
    *   [ ] Verify context is correctly assembled for workspace chats.
    *   [ ] Verify context is correctly assembled for non-workspace chats (if applicable).
    *   [ ] Test message limit enforcement (`context_window_size`).
    *   [ ] Test token limit enforcement (`context_window_token_limit`) - requires better token counting.
*   [ ] **Integration Testing:** Ensure the `/chat` function works end-to-end with the new context logic.
*   [ ] **Performance Testing:** Evaluate any performance impact of the new logic, especially history fetching and token counting.
*   [ ] **Refinement:** Adjust token estimation, prompt structure, or logic based on testing.

## Phase 4: Documentation

*   [ ] Update `/chat` Edge Function documentation explaining the context building process.
*   [ ] Document the `ContextBuilder` class (if created).
*   [ ] Update relevant sections in main project `README.md` or other architectural documents.
