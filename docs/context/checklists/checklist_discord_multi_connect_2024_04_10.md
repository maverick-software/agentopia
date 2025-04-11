# WBS/Checklist: Discord Multi-Channel Connection Implementation (Server-Centric UI)

**Date Created:** 2024-04-10
**Last Updated:** 2024-04-10

**Feature:** Allow agents to connect to multiple Discord servers/channels simultaneously, using a server-first UI with channel management modals.

---

**Phase 1: AgentEdit Refactoring (Frontend State & Logic)**

*   [X] 1.1. Define `DiscordConnection` interface (`guildId`, `channelId`, optional names).
*   [X] 1.2. Modify `Agent` interface in `AgentEdit.tsx`: Replace `discord_channel` with `discord_connections: DiscordConnection[]`.
*   [X] 1.3. Update `formData` state initialization in `AgentEdit.tsx` for `discord_connections`.
*   [X] 1.4. Modify `fetchAgent` callback: Ensure fetched agent data correctly populates `formData.discord_connections` (initialize as empty array if null/undefined from backend).
*   [X] 1.5. Modify `handleSubmit` callback: Ensure `discord_connections` array is included in the data sent for update/insert.
*   [X] 1.6. Rename `handleDiscordDisconnect` to `handleDiscordDisconnectBot`. Update its logic to clear `formData.discord_connections` (and potentially trigger backend disconnect if needed).
*   [X] 1.7. Implement `handleAddDiscordChannel(connection: { guildId: string; channelId: string })`: Adds a new connection object to `formData.discord_connections`, preventing duplicates.
*   [X] 1.8. Implement `handleRemoveDiscordChannel(channelId: string)`: Removes a connection from `formData.discord_connections` based on `channelId`.
*   [ ] 1.9. **Implement `handleRemoveDiscordGuild(guildId: string)`**: Removes *all* connections associated with a given `guildId` from `formData.discord_connections`. (NEW STEP)
*   [ ] 1.10. Update props passed to `<DiscordConnect />` component: (NEW/MODIFIED STEP)
    *   Pass `isConnected={Boolean(formData.discord_bot_key)}`.
    *   Pass `connections={formData.discord_connections || []}`.
    *   Pass `onAddChannel={handleAddDiscordChannel}`.
    *   Pass `onRemoveChannel={handleRemoveDiscordChannel}`.
    *   Pass `onRemoveGuild={handleRemoveDiscordGuild}`. (NEW PROP)
    *   Pass `onDisconnectBot={handleDiscordDisconnectBot}`.
    *   (Remove temporary `onConnectSuccess` when backend is live).

**Phase 2: DiscordConnect Component Refactoring (Server-Centric UI & Modal)**

*   [ ] 2.1. Update `DiscordConnectProps`: Reflect new/modified props from Step 1.10 (`onRemoveGuild`).
*   [ ] 2.2. Adjust component's internal state:
    *   Remove `isAdding` state.
    *   Add state for modal management: `isModalOpen` (boolean), `modalGuildId` (string | null), `modalGuildName` (string | null).
    *   Keep state for dropdown selections (`selectedGuild`, `selectedChannel`) - needed for "Add Server" flow and within modal.
*   [ ] 2.3. Refactor UI Rendering (Main Component):
    *   [ ] 2.3.1. If `!isConnected`: Show bot token input and "Connect Bot" button.
    *   [ ] 2.3.2. If `isConnected`:
        *   [ ] 2.3.2.1. Group `connections` by `guildId`.
        *   [ ] 2.3.2.2. Display list of unique connected servers (Guilds). Show Guild Name (requires fetching names or storing them in `DiscordConnection`).
        *   [ ] 2.3.2.3. Next to each server, add a "Manage Channels" button (opens modal) and a "Remove Server" button (calls `onRemoveGuild(guildId)`).
        *   [ ] 2.3.2.4. Show an "Add Server Connection" button.
        *   [ ] 2.3.2.5. Keep the global "Disconnect Bot" button (e.g., in header).
*   [ ] 2.4. Implement "Add Server Connection" Flow:
    *   [ ] 2.4.1. Handler for "Add Server Connection" button click. Might show a dropdown of available servers (from `fetchBotGuilds`) not already in the `connections` list.
    *   [ ] 2.4.2. Logic upon selecting a server from the dropdown: Potentially automatically call `handleAddDiscordChannel` for a default channel (e.g., the first available one) OR open the "Manage Channels" modal for the newly added server immediately.
*   [ ] 2.5. Implement Modal Component (`DiscordChannelModal` or similar):
    *   [ ] 2.5.1. Create a new component or render modal JSX conditionally within `DiscordConnect`.
    *   [ ] 2.5.2. Modal accepts `isOpen`, `onClose`, `guildId`, `guildName`, `allGuildChannels` (channels available for this guild from `fetchBotGuilds`), `connectedChannelsForGuild` (subset of `connections` prop), `onAddChannel`, `onRemoveChannel`.
    *   [ ] 2.5.3. Modal UI:
        *   Displays `guildName`.
        *   Lists `connectedChannelsForGuild`, each with a "Remove" (X) button calling `onRemoveChannel(channelId)`.
        *   Provides an "Add Channel" section (e.g., a dropdown) showing channels from `allGuildChannels` that are *not* already in `connectedChannelsForGuild`.
        *   Selecting a channel from dropdown calls `onAddChannel`.
*   [ ] 2.6. Update Event Handlers:
    *   [ ] 2.6.1. `fetchBotGuilds`: No major change needed (still fetches all available guilds/channels for the bot). **Continue using MOCK DATA.**
    *   [ ] 2.6.2. `handleConnect`: On success, still call `fetchBotGuilds`. (Remove temporary `onConnectSuccess` later).
    *   [ ] 2.6.3. Create handler `handleOpenChannelModal(guildId, guildName)`.
    *   [ ] 2.6.4. Update `handleChannelSelect` (or create new handler for modal) to call `onAddChannel`.
    *   [ ] 2.6.5. `handleDisconnectBot`: No major change.
*   [ ] 2.7. Data Fetching/Display for Names: Decide if `guildName`/`channelName` should be stored in `AgentEdit`'s `connections` state (updated via `onAddChannel`) or fetched dynamically in `DiscordConnect` when needed (requires `fetchBotGuilds` data to be available). Storing is likely simpler for display.

**Phase 3: Backend & Database (Implementation Details)**

*   [ ] 3.1. Implement Supabase Edge Function changes:
    *   [ ] 3.1.1. **`discord-connect` (POST):**
        *   Receive `{ agentId, botToken }`.
        *   Validate `botToken` via Discord API (`GET /users/@me`). Return 4xx on failure.
        *   Encrypt `botToken` using server-side secret key (from env vars).
        *   Update `agents` table: set `discord_bot_token_encrypted` for `agentId`.
        *   Return 200 OK.
    *   [ ] 3.1.2. **`discord-disconnect` (POST):**
        *   Receive `{ agentId }`.
        *   Update `agents` table: set `discord_bot_token_encrypted = NULL` for `agentId`.
        *   Delete rows from `agent_discord_connections` where `agent_id = agentId`.
        *   Return 200 OK.
    *   [ ] 3.1.3. **`discord-get-bot-guilds` (GET):**
        *   Receive `agentId` (query param).
        *   Fetch `discord_bot_token_encrypted` for `agentId`.
        *   If no token, return 404 or `[]`.
        *   Decrypt token using server-side secret key.
        *   Call Discord API `GET /users/@me/guilds` with decrypted token.
        *   (Optional) For each guild, call `GET /guilds/{guild.id}/channels`.
        *   Filter/Format channels (e.g., text channels).
        *   Return `DiscordGuild[]` structure: `[{ id, name, channels: [{ id, name }] }]`.
*   [ ] 3.2. Implement Database Schema changes:
    *   [ ] 3.2.1. **Modify `agents` table:** Add `discord_bot_token_encrypted` (text/bytea, nullable).
    *   [ ] 3.2.2. **Create `agent_discord_connections` table:**
        *   `id` (uuid, pk)
        *   `agent_id` (uuid, fk -> agents.id, on delete cascade)
        *   `guild_id` (text)
        *   `channel_id` (text)
        *   `created_at` (timestamptz)
        *   Add unique constraint on (`agent_id`, `channel_id`).
        *   Add index on `agent_id`.
*   [ ] 3.3. **Update `AgentEdit.tsx` `handleSubmit`:** (NEW STEP)
    *   [ ] 3.3.1. After successful agent update/insert:
        *   Delete existing rows from `agent_discord_connections` for the `agent_id`.
        *   If `formData.discord_connections` is not empty, insert new rows into `agent_discord_connections` based on the array content.

**Phase 4: Testing & Refinement**

*   [ ] 4.1. Test frontend logic thoroughly using mock data and new UI.
*   [ ] 4.2. Implement Backend & DB changes (Phase 3).
*   [ ] 4.3. Test end-to-end flow: Bot connect/disconnect, Add/Remove servers, Add/Remove channels via modal, Persistence.
*   [ ] 4.4. Refine UI/UX (especially modal interactions).
*   [ ] 4.5. Update documentation (`@documentation.mdc`).

--- 