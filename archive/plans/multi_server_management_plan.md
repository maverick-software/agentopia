# Plan: Multi-Server Management, RLS, Logging & Cleanup

**Date:** 2025-04-17 (Updated: [Add Current Date Here])

## Brief

**Goal:** First, ensure foundational stability by re-enabling Row Level Security (RLS), establishing robust logging, and cleaning up temporary code. Then, refactor the Discord connection management to allow users to enable/disable the agent on multiple servers simultaneously via a modal, instead of selecting a single server. Remove the now-redundant channel selection logic entirely. Add functionality to generate a correct Discord bot invite link for the user.

**Scope:** This involves reviewing and implementing RLS policies, setting up a logging framework, removing diagnostic code, modifying the database schema (`agent_discord_connections`), creating new backend functions (fetching/updating guilds, RLS checks), refactoring frontend components (`AgentEdit.tsx`, `DiscordConnect.tsx`), creating a new modal component (`GuildSelectionModal.tsx`), and implementing the invite link generation.

---

## Checklist

**Phase 1: RLS Re-enablement & Verification**
- [ ] Review current RLS policies for `agent_discord_connections` and `agents`.
- [ ] Analyze RLS requirements (users own agents, workers update status via RPC). Document required policies.
- [ ] Draft RLS policies based on requirements and Supabase best practices.
- [ ] **Backup:** Document current RLS state/policies before modification.
- [ ] Implement/Re-enable RLS policies in Supabase dashboard or via migration.
- [ ] Test RLS (RPC function `update_worker_status` access, user access to their own agents, UI functionality).
- [ ] Test agent deactivation flow from UI to ensure it still works with RLS.

**Phase 2: Establish Logging**
- [ ] Create `./logs/` directory if it doesn't exist.
- [ ] Choose and install a logging library (e.g., Winston, Pino) for `worker-manager` and `discord-worker`. Add to `package.json` in respective service directories.
- [ ] Plan logging structure (levels, formats, file rotation/pruning - e.g., 30-day limit per `cleanup_protocol`).
- [ ] **Backup:** Backup `services/worker-manager/` and `services/discord-worker/` directories.
- [ ] Implement logging framework initialization in `worker-manager` entry point (`src/manager.ts`).
- [ ] Implement logging framework initialization in `discord-worker` entry point (`src/worker.ts`).
- [ ] Replace critical `console.log` statements with logger calls (info, error, warn, debug levels). Focus on startup, shutdown, API calls, PM2 interactions, errors.
- [ ] Test logging output generation and rotation/pruning mechanism.

**Phase 3: Code Cleanup**
- [ ] Use `grep` or IDE search to identify remaining temporary diagnostic logs (`console.log`, `console.debug`, etc.) in `services/` and `supabase/functions/`.
- [ ] Identify potentially unused/redundant files/scripts (per `cleanup_protocol`). Requires careful review.
- [ ] **Backup:** Backup modified files/directories.
- [ ] Remove identified temporary logs.
- [ ] Review/remove/archive identified unused files (move to a temporary `archive` folder or flag in `docs/cleanup_review.md` if unsure, per protocol).
- [ ] Document significant removals/changes in `docs/cleanup_log.md` (per `cleanup_protocol`).

**Phase 4: Database Schema for Multi-Server**
- [ ] Create new migration file (`<timestamp>_multi_guild_connections.sql`).
- [ ] Modify `agent_discord_connections` table schema in migration:
    - [ ] Add `is_enabled` column (BOOLEAN NOT NULL DEFAULT true).
    - [ ] Drop existing primary key constraint (if named, e.g., `agent_discord_connections_pkey`).
    - [ ] Add composite primary key `(agent_id, guild_id)`.
    - [ ] *Self-Correction:* Ensure `discord_app_id`, `discord_public_key`, `inactivity_timeout_minutes` columns remain, as they likely relate to the connection instance.
- [x] Apply migration (`supabase db push`).

**Phase 5: Backend Multi-Server Logic (Supabase Functions)**
- [ ] **`discord-get-bot-guilds` Function:** (Confirm completed in previous plan) Ensure function only returns list of guilds bot is in (`id`, `name`).
- [ ] **Create `get-enabled-guilds` Function:**
    - [ ] Create new function directory `supabase/functions/get-enabled-guilds`.
    - [ ] Implement function (`index.ts`) to:
        - [ ] Accept `agentId` via query param or body.
        - [ ] Query `agent_discord_connections`.
        - [ ] Select `guild_id`, `is_enabled`.
        - [ ] Filter by `agent_id`.
        - [ ] Return array `[{ guild_id: string, is_enabled: boolean }]`.
- [ ] **Create `update-enabled-guilds` Function:**
    - [ ] Create new function directory `supabase/functions/update-enabled-guilds`.
    - [ ] Implement function (`index.ts`) to:
        - [ ] Accept `agentId` and `enabledGuilds: [{ guild_id: string, is_enabled: boolean }]` in request body.
        - [ ] For each item in `enabledGuilds`:
            - [ ] Perform `upsert` on `agent_discord_connections` using `(agent_id, guild_id)` as conflict target.
            - [ ] Set `is_enabled` value from input.
            - [ ] *Self-Correction:* Ensure `discord_app_id`, `discord_public_key`, `inactivity_timeout_minutes` are also set during upsert (fetch from existing record or agent details if necessary on insert). This needs careful handling to avoid overwriting valid data or leaving new rows incomplete. *Alternative:* Maybe these should move to the `agents` table if they are truly agent-wide? *Decision:* Keep them on `agent_discord_connections` for now, but the upsert must handle them. Fetch existing values first? Or require them in payload? Require in payload from frontend seems safer.
        - [ ] Return success/error status.

**Phase 6: Frontend Multi-Server (`AgentEdit.tsx`)**
- [ ] **State Management:**
    - [ ] Remove any remaining state related to single `guild_id` selection in `discordConnectionData`.
    - [ ] Add state: `allGuilds: {id: string, name: string}[]`.
    - [ ] Add state: `enabledGuilds: {guild_id: string, is_enabled: boolean}[]`.
    - [ ] Add state: `isGuildModalOpen: boolean`.
    - [ ] Add state: `isGeneratingInvite: boolean`.
- [ ] **Data Fetching:**
    - [ ] Fetch guild list using `discord-get-bot-guilds` when credentials (`discord_app_id`, `discord_public_key`) are available. Store in `allGuilds`.
    - [ ] Fetch enabled status using `get-enabled-guilds` when `agentId` is available. Store in `enabledGuilds`.
- [ ] **Handlers:**
    - [ ] Create `handleOpenGuildModal`.
    - [ ] Create `handleCloseGuildModal`.
    - [ ] Create `handleSaveEnabledGuilds` (calls `update-enabled-guilds` function, updates `enabledGuilds` state).
    - [ ] Create `handleGenerateInviteLink`.
        - [ ] Get `discord_app_id` from state.
        - [ ] Define necessary permissions integer (e.g., 8 for Administrator, or calculate specific needed ones).
        - [ ] Define scopes (`bot applications.commands`).
        - [ ] Construct URL: `https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=${permissions}&scope=bot%20applications.commands`.
        - [ ] Set `isGeneratingInvite` state to true.
        - [ ] Open URL in new tab (`window.open(url, '_blank')`).
        - [ ] Set `isGeneratingInvite` state to false (or use timeout/callback).
    - [ ] Modify `handleActivateAgent` / `handleDeactivateAgent`: Remove dependency on single `guild_id`. Potentially add check if *any* guild is enabled before activation? (Consider UX).
    - [ ] Update activation button `disabled` logic: Remove `!connection.guild_id` check. Add check for missing credentials (`!connection.discord_app_id` or `!connection.discord_public_key`).
- [ ] **Render/Props:**
    - [ ] Pass `handleOpenGuildModal` as `onManageServers` to `<DiscordConnect>`.
    - [ ] Pass `handleGenerateInviteLink` as `onGenerateInviteLink` to `<DiscordConnect>`.
    - [ ] Pass `connection.discord_app_id` to `<DiscordConnect>`.
    - [ ] Render `<GuildSelectionModal>` conditionally based on `isGuildModalOpen`.
    - [ ] Pass necessary props (`allGuilds`, `enabledGuilds`, handlers) to `<GuildSelectionModal>`.

**Phase 7: Frontend Multi-Server (`DiscordConnect.tsx`)**
- [ ] **Props:**
    - [ ] Remove `guilds` prop.
    - [ ] Remove `onSelectServer` prop.
    - [ ] Add `disc_app_id?: string` prop.
    - [ ] Add `onManageServers: () => void` prop.
    - [ ] Add `onGenerateInviteLink: () => void` prop.
    - [ ] Add `isGeneratingInvite?: boolean;` prop.
- [ ] **Render:**
    - [ ] Remove "Selected Server" `<label>` and `<select>` elements.
    - [ ] Add "Manage Servers" `<button>` calling `onManageServers`.
    - [ ] Add "Generate Invite Link" `<button>` calling `onGenerateInviteLink`. It should be disabled if `discord_app_id` is missing or invite generation is in progress (parent state).
    - [ ] Modify "Activate Agent" `<button>`: Remove `!connection.guild_id` from `disabled` condition. Add `!discord_app_id`. Update `title` attribute text.

**Phase 8: New Component (`src/components/GuildSelectionModal.tsx`)**
- [ ] Create new file `src/components/GuildSelectionModal.tsx`.
- [ ] Define `GuildSelectionModalProps` (e.g., `isOpen`, `onClose`, `onSave`, `allGuilds`, `enabledGuilds`, `loading`, `isSaving`).
- [ ] Implement component logic:
    - [ ] Use `useState` for local `enabledState: Record<string, boolean>`.
    - [ ] Use `useEffect` to initialize/reset `enabledState` when `allGuilds` or `enabledGuilds` props change. Merge the lists, defaulting new guilds found via API to `true`.
    - [ ] Create `handleToggle(guildId: string)` to update `enabledState`.
    - [ ] Create `handleSave` to format `enabledState` into the array structure expected by `onSave` and call `onSave`.
- [ ] Implement component render:
    - [ ] Basic modal structure (background overlay, content card).
    - [ ] Title ("Manage Enabled Servers").
    - [ ] Loading indicator if `loading`.
    - [ ] List/map over `allGuilds`. For each guild:
        - [ ] Display guild name (`guild.name`).
        - [ ] Display checkbox/toggle switch reflecting `enabledState[guild.id]`.
        - [ ] Attach `handleToggle(guild.id)` to the toggle's change event.
    - [ ] "Save" button (calls `handleSave`).
    - [ ] "Cancel" button (calls `onClose`).

**Phase 9: Testing & Verification** (Consolidated)
- [ ] **RLS Tests:**
    - [ ] Verify non-owners cannot view/edit other users' agents via UI or direct API calls.
    - [ ] Verify `update_worker_status` RPC function can be called successfully by worker processes (even with anon key if applicable).
    - [ ] Verify agent activation/deactivation flow functions correctly with RLS enabled.
- [ ] **Logging Tests:**
    - [ ] Verify log files are created in `./logs/`.
    - [ ] Verify logs capture startup, shutdown, errors, key events in `worker-manager` and `discord-worker`.
    - [ ] Verify log rotation/pruning works as configured.
- [ ] **Cleanup Tests:**
    - [ ] Verify temporary `console.log`s are removed.
    - [ ] Verify application still functions correctly after potential file removals.
- [ ] **Multi-Server DB/Backend Tests:**
    - [ ] Verify database migration applied correctly (`is_enabled` column, composite PK).
    - [ ] Test `get-enabled-guilds` function returns correct data.
    - [ ] Test `update-enabled-guilds` function correctly upserts `is_enabled` status and other fields.
- [ ] **Multi-Server Frontend/UI Tests:**
    - [ ] Test modal opening/closing.
    - [ ] Test guild list fetching/display in modal.
    - [ ] Test enabling/disabling toggles update modal state.
    - [ ] Test saving changes updates DB and persists after refresh/reopen.
    - [ ] Test default enablement for newly joined servers (bot joins server, refresh modal, new server shows enabled).
    - [ ] Test "Generate Invite Link" button generates correct URL and handles loading state.
    - [ ] Test "Activate Agent" button enablement logic (requires credentials, not specific guilds).
- [ ] **End-to-End Flow Tests:**
    - [ ] Test activating an agent enables it across *all* servers marked `is_enabled: true`.
    - [ ] Test deactivating an agent stops workers associated with it.
    - [ ] Test mentioning the agent in an enabled server triggers a response.
    - [ ] Test mentioning the agent in a *disabled* server does *not* trigger a response (or verify worker doesn't run for that agent if disabled everywhere).
- [ ] **General:**
    - [ ] Check browser console and Supabase function logs for errors throughout testing.

---

## Work Breakdown Structure (WBS)

*(Note: WBS items marked with '*' depend on decisions made during implementation, e.g., how exactly to handle data for upserts)*
*(Note: Supabase database types for frontend usage are generated into `src/types/database.types.ts`. See README Development section for generation command.)*

**Phase 1: RLS Re-enablement & Verification WBS**
*   WBS 1.1: [x] Review current RLS policies for `agent_discord_connections` and `agents` in Supabase Studio.
*   WBS 1.2: [x] Define RLS Requirements:
    *   Users can SELECT/INSERT/UPDATE/DELETE their own `agents`.
    *   Users can SELECT/INSERT/UPDATE/DELETE their own `agent_discord_connections` (via agent ownership).
    *   Workers (using specific role or function) can UPDATE `worker_status` via `update_worker_status` RPC.
*   WBS 1.3: [x] Draft SQL for RLS policies (e.g., `CREATE POLICY "Users can manage own agents" ON agents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`).
*   WBS 1.4: [x] Document current RLS state (screenshots or export policies).
*   WBS 1.5: [x] Apply RLS policies via Supabase SQL editor or create/apply a new migration file.
*   WBS 1.6: Test: Attempt UI actions as different users. Call RPC function simulate worker.
*   WBS 1.7: Test: Click Deactivate button in UI, verify worker stops and DB status updates.

**Phase 2: Establish Logging WBS**
*   WBS 2.1: Run `mkdir ./logs` in terminal if directory doesn't exist. Add `./logs/` to `.gitignore`.
*   WBS 2.2: `cd services/worker-manager && npm install winston winston-daily-rotate-file` (or chosen library). Repeat for `services/discord-worker`.
*   WBS 2.3: Define logger configuration (e.g., `dailyRotateFile` transport settings, log format).
*   WBS 2.4: Backup `services/worker-manager/src` and `services/discord-worker/src`.
*   WBS 2.5: Create `logger.ts` in `worker-manager/src`, configure and export logger instance. Import and use in `manager.ts`.
*   WBS 2.6: Create `logger.ts` in `discord-worker/src`, configure and export logger instance. Import and use in `worker.ts`.
*   WBS 2.7: Replace key `console.log`s (startup, errors, API calls, PM2 events) with `logger.info()`, `logger.error()`, etc.
*   WBS 2.8: Run services, trigger events, check `./logs/` for files and content. Wait >24h or manually manipulate time to test rotation if configured.
*   WBS 2.9: Add note about logging setup in `README.md` Development/Deployment sections.

**Phase 3: Code Cleanup WBS**
*   WBS 3.1: Use `grep -r 'console\.log' services/ supabase/functions/` or IDE search.
*   WBS 3.2: Manually review file tree for obviously old/unused test scripts or components.
*   WBS 3.3: Backup any files intended for modification/deletion.
*   WBS 3.4: Delete identified temporary `console.log` lines.
*   WBS 3.5: Move suspect files to `./archive/` or list in `./docs/cleanup_review.md`.
*   WBS 3.6: Run application, perform core actions (login, edit, activate, deactivate).
*   WBS 3.7: Create/Update `./docs/cleanup_log.md` with summary of removals.

**Phase 4: Database Schema WBS**
*   WBS 4.1: Open terminal.
*   WBS 4.2: Run `supabase migration new multi_guild_connections`.
*   WBS 4.3: Verify file creation in `supabase/migrations`.
*   WBS 4.4: Open new migration SQL file.
*   WBS 4.5: Write SQL: `ALTER TABLE public.agent_discord_connections ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT true;`
*   WBS 4.6: Write SQL: Identify existing primary key constraint name (e.g., using Supabase Studio).
*   WBS 4.7: Write SQL: `ALTER TABLE public.agent_discord_connections DROP CONSTRAINT IF EXISTS <pkey_constraint_name>;` (replace placeholder).
*   WBS 4.8: Write SQL: `ALTER TABLE public.agent_discord_connections ADD PRIMARY KEY (agent_id, guild_id);`
*   WBS 4.9: Review migration SQL for correctness.
*   WBS 4.10: Save SQL file.
*   WBS 4.11: Run `supabase db push` in terminal.
*   WBS 4.12: Monitor output for success/errors.
*   WBS 4.13: Verify schema changes in Supabase Studio (new column, primary key).

**Phase 5: Backend Multi-Server Logic WBS**
*   WBS 5.1: Review `supabase/functions/discord-get-bot-guilds/index.ts`.
*   WBS 5.2: Confirm it only returns `[{ id: string, name: string }]`.
*   WBS 5.3: Create folder `supabase/functions/get-enabled-guilds`.
*   WBS 5.4: Create `index.ts` inside the new folder.
*   WBS 5.5: Add standard Deno server setup, CORS, Supabase client creation (use Service Role Key or verify user).
*   WBS 5.6: Parse `agentId` from request (query param or body).
*   WBS 5.7: Implement Supabase query: `select('guild_id, is_enabled').eq('agent_id', agentId)`.
*   WBS 5.8: Format data as `[{ guild_id, is_enabled }]`.
*   WBS 5.9: Return formatted data as JSON with 200 status.
*   WBS 5.10: Add error handling (400/500 responses).
*   WBS 5.11: Create folder `supabase/functions/update-enabled-guilds`.
*   WBS 5.12: Create `index.ts` inside the new folder.
*   WBS 5.13: Add standard Deno server setup, CORS, Supabase client creation (Service Role Key needed for upsert).
*   WBS 5.14: Parse `agentId` and `enabledGuilds` array from request body. Validate input.
*   WBS 5.15: *Decision:* How to handle `discord_app_id`, `public_key`, `timeout` during upsert? (Chosen: Option A - Frontend will send current values).
*   WBS 5.16: Loop through `enabledGuilds` array.
*   WBS 5.17: Inside loop, construct data object for upsert (including `agent_id`, `guild_id`, `is_enabled`, and other required fields based on WBS 5.15).
*   WBS 5.18: Perform Supabase `upsert` call with `(agent_id, guild_id)` as `onConflict`.
*   WBS 5.19: Handle potential errors during the loop/upsert.
*   WBS 5.20: Return 200 on success, appropriate error code on failure.

**Phase 6: Frontend (`AgentEdit.tsx`) WBS**
*   WBS 6.1: Open `AgentEdit.tsx`.
*   WBS 6.2: Search for `guild_id` within `discordConnectionData` state initialization/updates and remove if still present.
*   WBS 6.3: Add `useState< {id: string, name: string}[] >([])` for `allGuilds`.
*   WBS 6.4: Add `useState< {guild_id: string, is_enabled: boolean}[] >([])` for `enabledGuilds`.
*   WBS 6.5: Add `useState<boolean>(false)` for `isGuildModalOpen`.
*   WBS 6.6: Add `useState<boolean>(false)` for `isGeneratingInvite`.
*   WBS 6.7: Modify `useEffect` (or create new) that depends on `discordConnectionData.discord_app_id` / `discordConnectionData.discord_public_key`.
*   WBS 6.8: Inside effect, if credentials exist, call `discord-get-bot-guilds` function using `fetch` or Supabase client `invoke`.
*   WBS 6.9: Update `allGuilds` state with the result. Add loading/error handling.
*   WBS 6.10: Modify `useEffect` that depends on `agentId`.
*   WBS 6.11: Inside effect, if `agentId` exists, call `get-enabled-guilds` function.
*   WBS 6.12: Update `enabledGuilds` state with the result. Add loading/error handling.
*   WBS 6.13: Create `handleOpenGuildModal = () => setIsGuildModalOpen(true);`.
*   WBS 6.14: Create `handleCloseGuildModal = () => setIsGuildModalOpen(false);`.
*   WBS 6.15: Create `handleSaveEnabledGuilds = async (updatedEnabledList) => { ... }`.
    *   WBS 6.15.1: Set loading state.
    *   WBS 6.15.2: Call `update-enabled-guilds` function via `invoke` with `agentId`, `updatedEnabledList`, and necessary connection fields (`discord_app_id`, etc.).
    *   WBS 6.15.3: Update `enabledGuilds` state on success.
    *   WBS 6.15.4: Close modal (`handleCloseGuildModal`).
    *   WBS 6.15.5: Handle errors, unset loading state.
*   WBS 6.16: Create `handleGenerateInviteLink = () => { ... }`.
    *   WBS 6.16.1: Get `discord_app_id` from state. Return if missing.
    *   WBS 6.16.2: Define permissions integer (e.g., 8).
    *   WBS 6.16.3: Define scopes (`bot applications.commands`).
    *   WBS 6.16.4: Construct URL.
    *   WBS 6.16.5: Set `isGeneratingInvite(true)`.
    *   WBS 6.16.6: `window.open(url, '_blank')`.
    *   WBS 6.16.7: Set `isGeneratingInvite(false)`.
*   WBS 6.17: Review `handleActivateAgent`/`handleDeactivateAgent`, remove `guild_id` checks.
*   WBS 6.18: Review Activate button `disabled` logic in the JSX passed to `DiscordConnect`. Remove `!connection.guild_id`. Add `!discordConnectionData.discord_app_id` or `!discordConnectionData.discord_public_key`.
*   WBS 6.19: Locate `<DiscordConnect>` usage.
*   WBS 6.20: Add `onManageServers={handleOpenGuildModal}` prop.
*   WBS 6.21: Add `onGenerateInviteLink={handleGenerateInviteLink}` prop.
*   WBS 6.22: Add `discord_app_id={discordConnectionData.discord_app_id}` prop.
*   WBS 6.23: Add `<GuildSelectionModal ... />` component render, conditionally shown via `isGuildModalOpen`.
*   WBS 6.24: Pass required props to modal: `isOpen`, `onClose`, `onSave={handleSaveEnabledGuilds}`, `allGuilds`, `enabledGuilds`, `loading`, `isSaving`.

**Phase 7: Frontend (`DiscordConnect.tsx`) WBS**
*   WBS 7.1: Open `DiscordConnect.tsx`.
*   WBS 7.2: Remove `guilds` from props interface and destructuring.
*   WBS 7.3: Remove `onSelectServer` from props interface and destructuring.
*   WBS 7.4: Add `disc_app_id?: string;` to props interface.
*   WBS 7.5: Add `onManageServers: () => void;` to props interface.
*   WBS 7.6: Add `onGenerateInviteLink: () => void;` to props interface.
*   WBS 7.7: Add `isGeneratingInvite?: boolean;` to props interface (or get from parent context).
*   WBS 7.8: Add new props to function destructuring.
*   WBS 7.9: Delete the `<label>` and `<select>` for "Selected Server".
*   WBS 7.10: Add `<button onClick={onManageServers} ...>Manage Servers</button>`.
*   WBS 7.11: Add `<button onClick={onGenerateInviteLink} disabled={!discord_app_id || isGeneratingInvite} ...>Generate Invite Link</button>`.
*   WBS 7.12: Find "Activate Agent" `<button>`. Remove `!connection.guild_id` from `disabled={...}`. Add `!discord_app_id`. Update `title` attribute text.

**Phase 8: New Component (`GuildSelectionModal.tsx`) WBS**
*   WBS 8.1: Create file `src/components/GuildSelectionModal.tsx`.
*   WBS 8.2: Define `GuildSelectionModalProps` interface with `isOpen`, `onClose`, `onSave: (enabledList: {guild_id: string, is_enabled: boolean}[]) => void`, `allGuilds: {id: string, name: string}[]`, `enabledGuilds: {guild_id: string, is_enabled: boolean}[]`, `loading: boolean`, `isSaving: boolean`.
*   WBS 8.3: Add `useState<Record<string, boolean>>({})` for `enabledState`.
*   WBS 8.4: Add `useEffect` hook watching `allGuilds`, `enabledGuilds`, `isOpen`.
*   WBS 8.5: Inside effect, if `isOpen` is true, merge `allGuilds` and `enabledGuilds` to initialize `enabledState`. Default guilds from `allGuilds` not present in `enabledGuilds` to `true`.
*   WBS 8.6: Create `handleToggle = (guildId) => setEnabledState(prev => ({ ...prev, [guildId]: !prev[guildId] }));`.
*   WBS 8.7: Create `handleSave = () => { ... }`.
    *   WBS 8.7.1: Convert `enabledState` (Record) back to array `[{ guild_id, is_enabled }]`.
    *   WBS 8.7.2: Call `props.onSave(...)` with the array.
*   WBS 8.8: Render modal structure (overlay, card) only if `isOpen`.
*   WBS 8.9: Add Title.
*   WBS 8.10: Add Loading state display.
*   WBS 8.11: Render list using `allGuilds.map(guild => ...)`.
*   WBS 8.12: Inside map, display `guild.name`.
*   WBS 8.13: Inside map, render checkbox/toggle (`<input type="checkbox">` or similar).
*   WBS 8.14: Set checkbox `checked` status based on `enabledState[guild.id]`.
*   WBS 8.15: Set checkbox `onChange={() => handleToggle(guild.id)}`.
*   WBS 8.16: Render "Save" button (`onClick={handleSave}`, `disabled={isSaving}`).
*   WBS 8.17: Render "Cancel" button (`onClick={props.onClose}`).

**Phase 9: Testing & Verification WBS**
*   WBS 9.1: Start dev environment (`npm run dev`, `supabase start`, `supabase functions serve`, services).
*   WBS 9.2: **RLS:** Login as user A, create agent. Login as user B, try to view/edit agent A. Check Supabase RLS policies applied. Simulate worker call to RPC. Test Deactivate button.
*   WBS 9.3: **Logging:** Check `./logs/` for files. Trigger errors/actions, check logs. Check rotation after time passes.
*   WBS 9.4: **Cleanup:** Verify no `console.log`s remain via search. Run app. Check `docs/cleanup_log.md`.
*   WBS 9.5: **DB/Backend:** Check `agent_discord_connections` schema. Call `get-enabled-guilds`, `update-enabled-guilds` (e.g., via curl or browser dev tools) and verify results/DB changes.
*   WBS 9.6: **Frontend/UI:** Open modal, check guilds load. Toggle switches. Save changes, check DB & reopen modal. Add bot to new server, refresh modal. Generate invite link, check URL. Check activate button enablement.
*   WBS 9.7: **E2E:** Activate agent. Mention in enabled server -> response. Mention in disabled server -> no response. Deactivate agent.
*   WBS 9.8: **General:** Monitor browser console, network tab, Supabase function logs, service logs (`./logs/`) for errors throughout.