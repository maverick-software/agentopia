# Discord-Style Workspaces & Channels Feature - WBS Checklist

**Implementation Plan:** See `docs/plans/chat_rooms/implementation_plan.md`

## Phase 1: Database Schema (Original `chat_rooms` structure - Completed)

*   [X] **Table: `chat_rooms`** (Original name)
    *   [X] Define schema & Create migration file. (`20250426070212_create_chat_rooms_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS & Helper (`is_room_member`). (`20250426070524_create_chat_rooms_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `user_team_memberships`**
    *   [X] Define schema & Create migration file. (`20250426070520_create_user_team_memberships_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS. (`20250426071659_create_user_team_memberships_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_room_members`** (Original name)
    *   [X] Define schema & Create migration file. (`20250426070344_create_chat_room_members_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS. (`20250426073133_create_chat_room_members_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_channels`**
    *   [X] Define schema & Create migration file. (`20250426073219_create_chat_channels_table.sql`)
    *   [X] Apply migration.
    *   [X] Implement RLS. (`20250426073304_create_chat_channels_rls.sql`)
    *   [X] Apply RLS migration.
*   [X] **Table: `chat_messages` (Modification & RLS Update)**
    *   [X] Create modification migration. (`20250426073336_modify_chat_messages_for_channels.sql`)
    *   [X] Apply modification migration.
    *   [X] Implement updated RLS. (`20250426080802_update_chat_messages_rls.sql`)
    *   [X] Apply updated RLS migration.
*   [X] **Table: `chat_sessions` (Deprecation)**
    *   [X] Create migration to drop `chat_sessions`. (`20250426080843_drop_chat_sessions_table.sql`)
    *   [X] Apply drop migration.
*   [X] **Schema Alignment (Post-Review)**
    *   [X] Create corrective migration (`20250426100407_align_schema_to_diagram.sql`).
    *   [X] Apply alignment migration.
    *   [X] Create corrective migration (`20250426101000_readd_active_column_to_agents.sql`).
    *   [X] Apply `agents.active` restoration migration.
    *   [X] Update `database/README.md` documentation.

## Phase 2: Backend & API Layer (Based on original `chat_rooms` schema)

*   [X] **API Helpers/Types:**
    *   [X] Define shared TypeScript interfaces (`ChatRoom`, `ChatChannel`, `ChatRoomMember`, `ChatMessage`) in `src/types/chat.ts`.
    *   [X] Define Supabase query function `get_user_chat_rooms`.
*   [X] **Hook: `useChatRooms`** *(Requires update to `useWorkspaces`)*
    *   [X] Create `src/hooks/useChatRooms.ts`.
    *   [X] Implement `fetchUserChatRooms()`.
    *   [X] Implement `createChatRoom(name)`.
    *   [X] Implement `fetchRoomDetails(roomId)`.
    *   [X] Add loading/error states.
*   [X] **Hook: `useRoomMembers`** *(Requires update to `useWorkspaceMembers`)*
    *   [X] Create `src/hooks/useRoomMembers.ts`.
    *   [X] Implement `fetchMembers(roomId)`.
    *   [X] Implement `addMember(roomId, type, memberId)`.
    *   [X] Implement `removeMember(roomId, type, memberId)`.
    *   [X] Add loading/error states.
*   [X] **Hook: `useChatChannels`** *(Requires update for `workspaceId`)*
    *   [X] Create `src/hooks/useChatChannels.ts`.
    *   [X] Implement `fetchChannelsForRoom(roomId)`.
    *   [X] Implement `createChannel(roomId, name, topic?)`.
    *   [X] Implement `updateChannel(channelId, { name?, topic? })`.
    *   [X] Implement `deleteChannel(channelId)`.
    *   [X] Add loading/error states.
*   [X] **Hook: `useChatMessages`** *(Requires RLS verification after rename)*
    *   [X] Update `fetchMessages` for `channelId`.
    *   [X] Update `createMessage` for `channelId`.
    *   [X] Update Realtime subscription for `channelId`.
    *   [X] Review metadata handling.
*   [X] **Supabase Edge Functions:**
    *   [X] Review if needed. *(Decision: Not required)*

## Phase 3: Agent Integration & Tools (Based on original `chat_rooms` schema)

*   [X] **Agent Context Injection (Runtime):** *(Requires update for `workspace_id` and `workspace_members`)*
    *   [X] Verify/Implement passing `current_room_id`, `current_channel_id`.
    *   [X] Verify/Implement providing `room_members` list.
*   [X] **Agent Tools (Backend):** *(Requires update for `workspace_id`)*
    *   [X] Implement `get_room_members(p_room_id uuid)`. (`20250426102945_...`)
    *   [X] Implement `list_room_channels(p_room_id uuid)`. (`20250426102945_...`)
    *   [X] Update `search_chat_history` tool function:
        *   [X] Require `channel_id` parameter.
        *   [X] Filter search results based on `channel_id`.
*   [X] **Agent Task Framework (Design):**
    *   [X] Define triggering mechanism.
    *   [X] Design task execution and result posting.

## Phase 4: Frontend UI (Based on original `chat_rooms` schema)

*   [X] **Core Layout:** *(May need updates for workspace context)*
    *   [X] Modify main app layout for sidebars.
*   [X] **Component: `RoomListSidebar.tsx`** *(Requires update to `WorkspaceListSidebar.tsx`)*
    *   [X] Use `useChatRooms` hook.
    *   [X] Render links to `/rooms/:roomId`.
    *   [X] Implement UI for `createChatRoom`.
*   [X] **Component: `RoomViewLayout.tsx`** *(Requires update to `WorkspaceViewLayout.tsx`)*
    *   [X] Layout for `/rooms/:roomId/*` routes.
    *   [X] Renders `ChannelListSidebar`.
    *   [X] Display Room Title/Settings icon placeholder.
*   [X] **Component: `ChannelListSidebar.tsx`** *(Requires update for `workspaceId`)*
    *   [X] Use `useParams` for `roomId`.
    *   [X] Use `useChatChannels` for current room.
    *   [X] Render links to `/rooms/:roomId/channels/:channelId`.
    *   [X] Implement UI for `createChannel`.
*   [X] **Component: `ChatChannelPage.tsx`** *(Requires update for `workspaceId` route)*
    *   [X] Target route: `/rooms/:roomId/channels/:channelId`.
    *   [X] Fetches messages using `useChatMessages`.
    *   [X] Renders `MessageList` and `MessageInput`.
    *   [X] Displays channel name/topic.
*   [X] **Component: `MessageList.tsx`**
    *   [X] Adapt/create message list component.
    *   [X] Ensure proper display of sender, timestamp, content.
    *   [X] Handle scrolling behavior.
    *   [ ] Implement pagination/infinite scroll. *(TODO added)*
*   [X] **Component: `MessageInput.tsx`** *(Requires update for workspace context)*
    *   [X] Adapt/create input component.
    *   [X] Ensure `createMessage` is called correctly.
    *   [-] Adapt mention logic for room context. *(Deferred)*
    *   [X] Pass `channelId` to `createMessage`.
*   [X] **Component: `RoomSettingsPage.tsx`** *(Requires update to `WorkspaceSettingsPage.tsx`)*
    *   [X] Target route: `/rooms/:roomId/settings`.
    *   [X] Contains UI placeholders for managing name, members (`RoomMemberManager`).
*   [X] **Component: `RoomMemberManager.tsx`** *(Requires update to `WorkspaceMemberManager.tsx`)*
    *   [X] Use `useParams` for `roomId`.
    *   [X] Use `useRoomMembers` hook.
    *   [X] Implement UI for adding members.
    *   [X] Implement UI for removing members.
*   [X] **Routing:** *(Requires update for `/workspaces/...` routes)*
    *   [X] Update `src/routing/routeConfig.tsx` for `/rooms/...` routes.
    *   [X] Ensure routes are protected.

## Phase 5: Testing & Refinement (Based on original `chat_rooms` schema)

*   [ ] **Functionality Testing:** *(Requires update for `workspace` tests)*
    *   [ ] Test room creation, viewing.
    *   [ ] Test channel creation, update, delete, viewing.
    *   [ ] Test adding/removing members.
    *   [ ] Test sending/receiving messages.
    *   [ ] Test loading historical messages.
*   [ ] **RLS Testing:** *(Requires update for `workspace` tests)*
    *   [ ] Verify non-members cannot access rooms/channels/messages.
    *   [ ] Verify non-owners cannot manage rooms/channels/members.
    *   [ ] Verify members can perform allowed actions.
*   [ ] **Agent Integration Testing:** *(Requires update for `workspace` tests)*
    *   [ ] Verify agents receive correct context (`room_id`, etc.).
    *   [ ] Test agent tool functionality (`get_room_members`, etc.).
*   [ ] **UI/UX Testing:** *(Requires update for `workspace` tests)*
    *   [ ] Test navigation flow between rooms and channels.
    *   [ ] Test responsiveness and layout.
    *   [ ] Review overall user experience.
*   [ ] **Refinement:**
    *   [ ] Address any bugs found during testing.
    *   [ ] Implement UI/UX improvements.
*   [ ] **Documentation:** *(Requires update for `workspace` terminology)*
    *   [ ] Update `README.md` for chat room/channel structure.
    *   [ ] Add documentation for chat features.

## Phase 6: Future Enhancements (Placeholders)

*   [ ] **Agent Task Execution (Implementation):** Build the framework designed in Phase 3.
*   [ ] **External Agent Integration:** Implement support for Webhooks/A2A Protocol.
*   [ ] **Advanced Chat Features:** Message threads, reactions, mentions, notifications, channel permissions.
*   [ ] **Refactor Auth Helpers:** Migrate from deprecated `@supabase/auth-helpers-react` to `@supabase/ssr`.
*   [ ] **Architectural Review:** Assess backend scalability and deployment model alignment (SaaS/On-Premise) based on initial usage and future plans.

## Phase 7: Workspace Refactor (Database Migration Complete, Code Updates Pending)

*   [X] **Consolidate Migrations:** Group individual renaming/RLS steps into a single migration (`20250428180438_remove_team_id_from_workspaces.sql`).
    *   [X] Rename `chat_rooms` table to `workspaces`.
    *   [X] Rename `room_id` columns to `workspace_id`.
    *   [X] Create `workspace_members` table.
    *   [X] Update RLS policies for `workspaces`, `workspace_members`, `chat_channels`, `chat_messages`.
    *   [X] Create helper functions `is_workspace_member` and `can_manage_workspace_members`.
*   [X] **Delete Redundant Migrations:**
    *   [X] Delete `supabase/migrations/20250428182540_rename_chat_rooms_to_workspaces.sql`.
    *   [X] Delete `supabase/migrations/20250428184532_rename_channel_room_id_to_workspace_id.sql`.
*   [ ] **Verification & Code Update:**
    *   [ ] Verify database schema changes reflect the consolidated migration (via Supabase UI or direct inspection).
    *   [ ] **Update Frontend Code:**
        *   [ ] Rename/update `src/types/chat.ts` (e.g., `ChatRoom` -> `Workspace`).
        *   [ ] Rename/update `src/hooks/useChatRooms.ts` -> `useWorkspaces.ts`.
        *   [ ] Rename/update `src/hooks/useRoomMembers.ts` -> `useWorkspaceMembers.ts`.
        *   [ ] Update `src/hooks/useChatChannels.ts` to use `workspaceId`.
        *   [ ] Rename/update UI Components (`RoomListSidebar` -> `WorkspaceListSidebar`, etc.).
        *   [ ] Update routing in `src/routing/` to use `/workspaces/...`.
        *   [ ] Search `src/` for hardcoded references to `chat_rooms` or `room_id`.
    *   [ ] **Update Backend Code:**
        *   [ ] Update Agent Context Injection (Phase 3) for `workspace_id`, `workspace_members`.
        *   [ ] Update Agent Tools (Phase 3) `get_room_members` -> `get_workspace_members`, etc.
        *   [ ] Verify/Update any relevant Supabase Functions (e.g., `get_user_chat_rooms` -> `get_user_workspaces`).
    *   [ ] **Testing:** Retest application functionality related to workspaces, channels, and messages (Phase 5 tests).
*   [ ] **Documentation Update:**
    *   [ ] Update `README.md` and any other relevant documentation (`docs/`) to reflect the schema changes (workspaces, workspace_members, etc.).