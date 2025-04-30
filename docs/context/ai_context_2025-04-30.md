# AI Context Document - Wed 04/30/2025 8:49:32.76

This document summarizes the system state and context following the execution of the `new_chat_protocol` on Wed 04/30/2025.

## Investigation Date & Time
Wed 04/30/2025 8:49:32.76

## Project Structure & Key Components

*   **Goal:** Agentopia - Platform for creating, managing, and interacting with AI agents, with a focus on Discord integration. Includes user management, teams, RAG (via datastores), MCP, admin features, and currently implementing chat rooms/workspaces.
*   **Tech Stack:** React/Vite/TS (Frontend), Supabase (DB, Auth, Realtime, Edge Functions, Vault), Node.js/TS (Backend Services on DigitalOcean droplet `165.22.172.98`), Discord.js, PM2, Pinecone (for RAG).
*   **Core Directories:** `src/` (Frontend), `supabase/functions/` (API Layer), `supabase/migrations/` (DB), `services/` (Backend Workers - `discord-worker`, `worker-manager`), `docs/`.
*   **Documentation:** `README.md` (Detailed overview), `docs/` (plans, context, bugs, index), `docs/index.md` (High-level index).
*   **Logging:** Nominally at `logs/` and `docs/console/logs/` but currently **empty**.

## Core Functionality Breakdown

1.  **Frontend (`src/`):** User/Admin UI. Manages agents, datastores, Discord connections. Initiates start/stop requests via `/manage-discord-worker`.
2.  **`manage-discord-worker` (Supabase Func):** Authenticates UI user, verifies agent ownership, calls `worker-manager` service, updates `agent_discord_connections.worker_status` in DB upon success.
3.  **`worker-manager` (Node Service on DO):** Listens on `http://165.22.172.98:8000`. Receives requests from Supabase functions. Uses PM2 API to start/stop `discord-worker` processes, passing config via env vars.
4.  **`discord-worker` (Node Service on DO):** Launched by `worker-manager`. Connects to Discord Gateway using agent's token. Listens for mentions. Updates own status via `update_worker_status` RPC. Calls `/chat` function for responses. Handles inactivity timeout.
5.  **`discord-interaction-handler` (Supabase Func):** Discord webhook endpoint. Verifies signature. Handles PING, autocomplete (`/activate`), and command execution (`/activate`). Decrypts bot token (using keys from `user_profiles` via `security.ts`). Calls `worker-manager` to start worker.
6.  **`chat` (Supabase Func):** Core LLM logic called by `discord-worker`. Fetches agent details. Performs RAG via `getVectorSearchResults` (querying Pinecone via `agent_datastores`). Executes MCP calls via `MCPManager` (using `mcp_configurations` and `mcp_servers` tables, fetching keys from Vault). Calls OpenAI API. Streams response.

## Database Overview (`supabase/migrations/`)

*   **Schema:** PostgreSQL managed by Supabase. Key tables: `users` (auth), `user_profiles`, `teams`, `team_members`, `user_team_memberships`, `agents`, `agent_discord_connections`, `datastores`, `agent_datastores`, `mcp_servers`, `mcp_configurations`, `chat_rooms`, `chat_room_members`, `chat_channels`, `chat_messages`, `workspaces`, `workspace_members`.
*   **RLS:** Heavily used on most tables. Policies defined in migrations. Verified as enabled for `agents` and `agent_discord_connections` in `README.md`, confirmed by migration files.
*   **Recent Activity:** Numerous recent migrations focus on implementing/refactoring chat features, renaming `chat_sessions` -> `chat_rooms`, introducing `workspaces`, `channels`, and adjusting related tables and RLS.
*   **Encryption:** Uses Supabase Vault (`getVaultAPIKey` in `/chat`) and a custom encryption utility (`../_shared/security.ts`, used in `/discord-interaction-handler`). Key generation functions/triggers exist in migrations.

## Current Feature Implementation Status (Chat Rooms / Workspaces)

*   **Status:** Actively being developed/refactored based on recent migrations.
*   **Components:** Tables `chat_rooms`, `chat_room_members`, `chat_channels`, `chat_messages`, `workspaces`, `workspace_members` created/modified. RLS policies applied. Older `chat_sessions` table dropped.
*   **WBS:** A WBS likely exists (mentioned in previous context doc at `docs/plans/chat_rooms/wbs_checklist.md`) but was not reviewed in this session. The exact state of backend/frontend implementation for this feature is unclear without reviewing the WBS or related code.

## Key Findings & Potential Issues

1.  **Missing Logs (Rule #2 Violation):** Log directories (`docs/console/logs/`, `logs/`) exist but contain no log files. Critical for debugging. **Needs immediate attention.**
2.  **Large Files (Philosophy #1 Violation):**
    *   `src/pages/AgentEditPage.tsx` (1326 lines)
    *   `src/pages/DatastoresPage.tsx` (664 lines)
    *   Require refactoring plans according to philosophy.
3.  **Discord Interaction Handler Bug:** Bug report (`docs/bugs/discord-interaction-handler.md`) exists but is marked **RESOLVED**. Monitor function logs if issues recur.
4.  **Frontend Build Error (`AuthContext.tsx`):** Mentioned in previous context (duplicate `isAdmin` variable). Status unverified in this session. Needs checking if frontend build/run fails.
5.  **Database Schema Complexity/Flux:** The significant number of recent migrations around chat/workspaces/teams suggests this area is complex and might be prone to bugs or require careful testing.

## Application Entry Points

*   **Web UI:** `src/main.tsx` (served by Vite).
*   **Supabase Functions:**
    *   `/discord-interaction-handler` (POST from Discord)
    *   `/manage-discord-worker` (POST from Frontend)
    *   `/chat` (POST from `discord-worker`)
*   **Worker Manager:** `http://165.22.172.98:8000` (GET `/`, POST `/start-worker`, POST `/stop-worker` - called by Supabase).

---
Generated by AI Assistant following `new_chat_protocol` at Wed 04/30/2025 8:49:32.76 