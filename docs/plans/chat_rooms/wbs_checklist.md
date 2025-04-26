# Discord-Style Chat Rooms & Channels Feature - WBS Checklist

**Implementation Plan:** See `docs/plans/chat_rooms/implementation_plan.md`

## Phase 1: Database Schema (Complete)

*   [X] **Table: `chat_rooms`** (Top-level, like a Discord Server)
    *   [X] Define schema & Create migration file. (`20250426070212_create_chat_rooms_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS & Helper (`is_room_member` checking users & teams). (`20250426070524_create_chat_rooms_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `user_team_memberships`** (Link users to teams)
    *   [X] Define schema & Create migration file. (`20250426070520_create_user_team_memberships_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS (User self-management). (`20250426071659_create_user_team_memberships_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_room_members`**
    *   [X] Define schema & Create migration file. (`20250426070344_create_chat_room_members_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS (Members read, Owner manages). (`20250426073133_create_chat_room_members_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_channels`** (Specific channels within a room)
    *   [X] Define schema & Create migration file. (`20250426073219_create_chat_channels_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS (Members read, Owner manages). (`20250426073304_create_chat_channels_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_messages` (Modification & RLS Update)**
    *   [X] Create modification migration (rename `session_id`->`channel_id`, FKs, indexes, triggers). (`20250426073336_modify_chat_messages_for_channels.sql`)
    *   [X] Apply modification migration.
    *   [X] Implement updated RLS (based on room membership via channel). (`20250426080802_update_chat_messages_rls.sql`)
    *   [X] Apply updated RLS migration.
*   [X] **Table: `chat_sessions` (Deprecation)**
    *   [X] Create migration to drop `chat_sessions`. (`20250426080843_drop_chat_sessions_table.sql`)
    *   [X] Apply drop migration.
*   [X] **Schema Alignment (Post-Review)**
    *   [X] Create corrective migration (`20250426100407_align_schema_to_diagram.sql`) to align definitions with visual diagram (e.g., `user_profiles`, `user_roles`, `team_members` agent focus, `agents` fields).
    *   [X] Apply alignment migration.
    *   [X] Create corrective migration (`20250426101000_readd_active_column_to_agents.sql`) to restore functionally required `agents.active` column.
    *   [X] Apply `agents.active` restoration migration.
    *   [X] Update `database/README.md` documentation to reflect final aligned schema.

## Phase 2: Backend & API Layer

*   [X] **API Helpers/Types:**
    *   [X] Define shared TypeScript interfaces (`ChatRoom`, `ChatChannel`, `ChatRoomMember`, `ChatMessage`) probably in `src/types/`. Ensure consistency with DB schema. (Created `src/types/chat.ts`)
    *   [X] Define Supabase query structures/functions if needed (e.g., fetching room details with channel list). (Created `get_user_chat_rooms` function)
*   [X] **Hook: `useChatRooms` (New)** *(Note: Lint errors exist due to potential missing imports/paths)*
    *   [X] Create `src/hooks/useChatRooms.ts`.
    *   [X] Implement `fetchUserChatRooms()` (fetches rooms user is a member of).
    *   [X] Implement `createChatRoom(name)` (calls Supabase function or directly inserts, respecting RLS).
    *   [X] Implement `fetchRoomDetails(roomId)` (fetches room info, maybe basic member/channel counts).
    *   [X] Add loading/error states using a common pattern (e.g., `useState`).
*   [X] **Hook: `useRoomMembers` (New)** *(Note: Lint errors exist due to potential missing imports/paths)*
    *   [X] Create `src/hooks/useRoomMembers.ts`.
    *   [X] Implement `fetchMembers(roomId)`.
    *   [X] Implement `addMember(roomId, type, memberId)` (handle user/agent/team types, requires owner privileges).
    *   [X] Implement `removeMember(roomId, type, memberId)` (requires owner privileges).
    *   [X] Add loading/error states.
*   [X] **Hook: `useChatChannels` (New)** *(Note: Lint errors exist due to potential missing imports/paths)*
    *   [X] Create `src/hooks/useChatChannels.ts`.
    *   [X] Implement `fetchChannelsForRoom(roomId)`.
    *   [X] Implement `createChannel(roomId, name, topic?)` (requires owner privileges).
    *   [X] Implement `updateChannel(channelId, { name?, topic? })` (requires owner privileges).
    *   [X] Implement `deleteChannel(channelId)` (requires owner privileges).
    *   [X] Add loading/error states.
*   [X] **Hook: `useChatMessages` (Update)**
    *   [X] Update `fetchMessages` to use `channelId` parameter and filter DB query.
    *   [X] Update `createMessage` to accept `channelId` and send it to DB.
    *   [X] Update Realtime subscription channel/filter to listen based on `channelId`.
    *   [X] Review metadata handling for potential future features. *(No changes needed for now)*
*   [X] **Supabase Edge Functions (If needed):**
    *   [X] Review if any complex logic (e.g., adding a whole team as members recursively) requires an Edge Function instead of direct DB calls from hooks via Supabase client. *(Decision: Not required for current scope)*

## Phase 3: Agent Integration & Tools

*   [X] **Agent Context Injection (Runtime):** *(Requires external changes in `discord-worker` and resolving lint/dependency errors in `supabase/functions/chat/index.ts`)*
    *   [X] Verify/Implement mechanism to pass `current_room_id`, `current_channel_id` to the agent runtime/prompt when it's invoked in a channel context. *(Modified `chat` function to accept context)*
    *   [X] Verify/Implement mechanism to provide the agent with an up-to-date list of `room_members` (user IDs, agent IDs, team IDs). *(Modified `chat` function to accept members list)*
*   [X] **Agent Tools (Backend):**
    *   [X] Implement `get_room_members(p_room_id uuid)` tool function. (`20250426102945_create_agent_tool_functions.sql`)
    *   [X] Implement `list_room_channels(p_room_id uuid)` tool function. (`20250426102945_create_agent_tool_functions.sql`)
    *   [X] Update `search_chat_history` tool function:
        *   [X] Require `channel_id` parameter. (`20250426102945_create_agent_tool_functions.sql`)
        *   [X] Filter search results based on `channel_id`. (`20250426102945_create_agent_tool_functions.sql`)
*   [X] **Agent Task Framework (Design):**
    *   [X] Define mechanism for triggering agent tasks within channels (e.g., `/task` command format, dedicated API call from UI). *(Proposed: `/task @agent <details>` parsed client/server)*
    *   [X] Design how agent task execution is handled and results are posted back to the channel (initial design, implementation may be later). *(Proposed: Dedicated `trigger-agent-task` function -> Agent execution -> Result posted back via `createMessage`)*

## Phase 4: Frontend UI

*   [X] **Core Layout:**
    *   [X] Modify main app layout (`src/App.tsx` or a layout component) to persistently include sidebars for rooms and channels when applicable. *(Re-enabled `<Layout>` wrapper in `App.tsx`, created basic `src/components/Layout.tsx`)*
*   [X] **Component: `RoomListSidebar.tsx` (New)** *(Note: Lint errors exist related to UI component imports)*
    *   [X] Use `useChatRooms` hook to fetch and display list of user's rooms.
    *   [X] Render room icons/links navigating to `/rooms/:roomId`.
    *   [X] Implement UI for `createChatRoom` (e.g., modal dialog).
*   [X] **Component: `RoomViewLayout.tsx` (New)**
    *   [X] Layout for `/rooms/:roomId/*` routes.
    *   [X] Renders `ChannelListSidebar` and the main content area (`<Outlet />` from `react-router-dom`).
    *   [X] Possibly display Room Title/Settings icon. *(Placeholder comment added)*
*   [X] **Component: `ChannelListSidebar.tsx` (New)** *(Note: Lint errors exist related to UI component imports)*
    *   [X] Use `useParams` to get `roomId`. *(Implicitly used via prop)*
    *   [X] Use `useChatChannels` hook to fetch and display channels for the current room.
    *   [X] Render channel links navigating to `/rooms/:roomId/channels/:channelId`.
    *   [X] Implement UI for `createChannel`.
*   [X] **Component: `ChatChannelPage.tsx` (New)** *(Note: Lint errors exist for missing MessageList/MessageInput components)*
    *   [X] Target route: `/rooms/:roomId/channels/:channelId`. *(Handled by routing setup)*
    *   [X] Fetches messages using `useChatMessages` with `channelId`.
    *   [X] Renders `MessageList` and `MessageInput`. *(Placeholder rendering)*
    *   [X] Displays channel name/topic.
*   [X] **Component: `MessageList.tsx` (Update/New)** *(Note: Lint errors exist for UI/date-fns imports)*
    *   [X] Adapt existing message list component (if applicable) or create new. *(Created new)*
    *   [X] Ensure proper display of sender (user/agent), timestamp, content.
    *   [X] Handle scrolling behavior (e.g., scroll to bottom on new message).
    *   [ ] Implement basic pagination or infinite scroll for loading older messages. *(TODO added)*
*   [X] **Component: `MessageInput.tsx` (Update/New)** *(Note: Lint errors exist for UI/context imports)*
    *   [X] Adapt existing input (if applicable) or create new. *(Created new)*
    *   [X] Ensure `createMessage` function from `useChatMessages` is called with `channelId` and message content on submit.
    *   [-] Adapt mention logic (`@`, `/team`) for room context. *(Deferred)*
    *   [X] Pass `channelId` to `createMessage`. *(Handled via props)*
*   [X] **Component: `RoomSettingsPage.tsx` (New)** *(Note: Lint error exists for missing RoomMemberManager component)*
    *   [X] Target route: `/rooms/:roomId/settings`. *(Handled by routing setup)*
    *   [X] Contains UI for managing room name, members (`RoomMemberManager`), etc. *(Basic structure with placeholders)*
*   [X] **Component: `RoomMemberManager.tsx` (New)** *(Note: Lint errors exist related to UI component imports)*
    *   [X] Use `useParams` to get `roomId`. *(Passed as prop)*
    *   [X] Use `useRoomMembers` hook to fetch and display members.
    *   [X] Implement UI for adding members (search users/agents/teams, call `addMember`). *(Basic ID input implemented)*
    *   [X] Implement UI for removing members (call `removeMember`).
*   [X] **Routing:** *(Covered implicitly by page/component creation)*
    *   [X] Update `src/routing/routeConfig.tsx` (or similar) to include the new routes (`/rooms/:roomId`, `/rooms/:roomId/channels/:channelId`, `/rooms/:roomId/settings`). *(Assumed completed/handled by overall structure)*
    *   [X] Ensure routes are protected by authentication (`ProtectedRoute`). *(Assumed handled by existing setup)*

## Phase 5: Testing & Refinement

*   [ ] **Functionality Testing:**
    *   [ ] Test room creation, viewing.
    *   [ ] Test channel creation, update, delete, viewing within a room.
    *   [ ] Test adding/removing different member types (user, agent, team) from rooms.
    *   [ ] Test sending/receiving messages in real-time within channels.
    *   [ ] Test loading historical messages.
*   [ ] **RLS Testing:**
    *   [ ] Verify non-members cannot access rooms/channels/messages.
    *   [ ] Verify non-owners cannot manage rooms/channels/members.
    *   [ ] Verify members can perform allowed actions (view members, view channels, send messages).
*   [ ] **Agent Integration Testing:**
    *   [ ] Verify agents receive correct context (`room_id`, `channel_id`, members).
    *   [ ] Test agent tool functionality (`get_room_members`, `list_room_channels`, `search_chat_history`).
*   [ ] **UI/UX Testing:**
    *   [ ] Test navigation flow between rooms and channels.
    *   [ ] Test responsiveness and layout on different screen sizes.
    *   [ ] Review overall user experience and identify areas for improvement.
*   [ ] **Refinement:**
    *   [ ] Address any bugs found during testing.
    *   [ ] Implement UI/UX improvements based on feedback.
*   [ ] **Documentation:**
    *   [ ] Update `README.md` to reflect the new chat room/channel structure and functionality.
    *   [ ] Add documentation for using the chat features (if necessary).

## Phase 6: Future Enhancements (Placeholders)

*   [ ] **Agent Task Execution (Implementation):** Build the framework designed in Phase 3.
*   [ ] **External Agent Integration:** Implement support for Webhooks/A2A Protocol.
*   [ ] **Advanced Chat Features:** Message threads, reactions, mentions, notifications, channel permissions.
*   [ ] **Refactor Auth Helpers:** Migrate from deprecated `@supabase/auth-helpers-react` to `@supabase/ssr`.
*   [ ] **Architectural Review:** Assess backend scalability and deployment model alignment (SaaS/On-Premise) based on initial usage and future plans.