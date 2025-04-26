# Discord-Style Chat Rooms & Channels Feature - WBS Checklist

## Phase 1: Database Schema

*   [X] **Table: `chat_rooms`** (Top-level, like a Discord Server)
    *   [X] Define schema: `id` (uuid, pk), `name` (text, not null), `owner_user_id` (uuid, fk->auth.users, not null), `created_at` (timestamptz). (Covered by migration)
    *   [X] Create migration file. (`20250426070212_create_chat_rooms_table.sql`)
    *   [X] Apply migration.
    *   [ ] Implement RLS: Owner has full access; members (via `chat_room_members`) can read room info. Create helper function `is_room_member(room_id, user_id)`. **(Function needs to check direct user membership AND team membership via `user_team_memberships`)**
    *   [ ] Apply RLS migration. (`20250426070524_create_chat_rooms_rls.sql` - **Requires correction**)
*   [ ] **Table: `user_team_memberships`** (New table to link users to teams)
    *   [ ] Define schema: `id` (uuid, pk), `user_id` (uuid, fk->auth.users, not null), `team_id` (uuid, fk->teams, not null), `joined_at` (timestamptz).
    *   [ ] Add unique constraint on (`user_id`, `team_id`).
    *   [ ] Create migration file.
    *   [ ] Apply migration.
    *   [ ] Implement RLS: Users can see own memberships; potentially team owners can manage?
    *   [ ] Apply RLS migration.
*   [X] **Table: `chat_room_members`**
    *   [X] Define schema: `id` (uuid, pk), `room_id` (uuid, fk->chat_rooms, not null), `member_type` (text, check('user', 'agent', 'team')), `member_id` (uuid, not null), `added_at` (timestamptz). *(Add `role` later if needed)*. (Covered by migration)
    *   [X] Add unique constraint on (`room_id`, `member_type`, `member_id`). (Covered by migration)
    *   [X] Create migration file. (`20250426070344_create_chat_room_members_table.sql`)
    *   [X] Apply migration.
    *   [ ] Implement RLS: Members can read other members of the same room; owner/admins can add/remove. Use `is_room_member` helper.
    *   [ ] Apply RLS migration.
*   [ ] **Table: `chat_channels`** (Specific channels within a room)
    *   [ ] Define schema: `id` (uuid, pk), `room_id` (uuid, fk->chat_rooms, not null), `name` (text, not null), `topic` (text), `created_at` (timestamptz), `last_message_at` (timestamptz).
    *   [ ] Create migration file.
    *   [ ] Apply migration.
    *   [ ] Implement RLS: Room members can read/list channels in their room. *(Channel-specific permissions can be added later)*. Use `is_room_member`.
    *   [ ] Apply RLS migration.
*   [X] **Table: `chat_messages` (Modification)**
    *   [X] Create migration to: (`20250426073336_modify_chat_messages_for_channels.sql`)
        *   [X] Rename `session_id` to `channel_id`.
        *   [X] Update foreign key constraint to reference `chat_channels(id)`.
        *   [X] Update index on `channel_id` and `created_at`.
        *   [X] Update trigger function `update_session_last_message_at` to `update_channel_last_message_at`.
        *   [X] Update trigger `trigger_update_session_last_message_at` to `trigger_update_channel_last_message_at`.
    *   [X] Apply migration (including fixes for dependencies).
    *   [ ] Update RLS: Read/write access requires membership in the parent room (`chat_channels` -> `chat_rooms`). Create/use helper `get_team_id_for_channel(channel_id)`.
    *   [ ] Apply updated RLS migration.
*   [ ] **Table: `chat_sessions` / `chat_room_participants` / `chat_servers` (Deprecation)**
    *   [ ] Create migration to drop the old `chat_sessions` table.
    *   [ ] Create migration to drop the old `chat_servers` and `chat_server_members` tables (if created).
    *   [ ] Apply drop migrations.

## Phase 2: Backend & API Layer

*   [ ] **Hook: `useChatRooms` (New)**
    *   [ ] Create `src/hooks/useChatRooms.ts`.
    *   [ ] Define `ChatRoom` interface.
    *   [ ] Implement `fetchUserChatRooms()`.
    *   [ ] Implement `createChatRoom(name)`.
    *   [ ] Implement `fetchRoomDetails(roomId)`.
    *   [ ] Add loading/error states.
*   [ ] **Hook: `useRoomMembers` (New)**
    *   [ ] Create `src/hooks/useRoomMembers.ts`.
    *   [ ] Define `ChatRoomMember` interface.
    *   [ ] Implement `fetchMembers(roomId)`.
    *   [ ] Implement `addMember(roomId, type, memberId)`. Handle `/team` expansion logic.
    *   [ ] Implement `removeMember(roomId, type, memberId)`.
    *   [ ] Add loading/error states.
*   [ ] **Hook: `useChatChannels` (New/Update)**
    *   [ ] Create/Update hook (e.g., `src/hooks/useChatChannels.ts`).
    *   [ ] Define `ChatChannel` interface.
    *   [ ] Implement `fetchChannelsForRoom(roomId)`.
    *   [ ] Implement `createChannel(roomId, name, topic?)`.
    *   [ ] Add loading/error states.
*   [ ] **Hook: `useChatMessages` (Update)**
    *   [ ] Ensure functions use `channelId`.
    *   [ ] Update queries to filter by `channel_id`.
    *   [ ] Update Realtime subscription channel/filter to use `channelId`.
    *   [ ] Review metadata for mentions (`@agent`, `/team [team_id]`).
*   [ ] **Agent Context Injection (Backend/Runtime)**
    *   [ ] Inject `current_room_id`, `current_channel_id`, list of `room_members`.
*   [ ] **Agent Tools (Backend)**
    *   [ ] Create `get_room_members(room_id)` tool.
    *   [ ] Create `list_room_channels(room_id)` tool.
    *   [ ] Update `search_chat_history` to require `channel_id` (and optionally `room_id`) for filtering.

## Phase 3: Frontend UI

*   [ ] **Main Layout Update:**
    *   [ ] Integrate a `RoomListSidebar` component persistently on the left.
*   [ ] **Component: `RoomListSidebar.tsx` (New)**
    *   [ ] Uses `useChatRooms` to list rooms.
    *   [ ] Renders room links (e.g., icons/initials) navigating to `/rooms/:roomId`.
    *   [ ] Includes "Create Room" functionality.
*   [ ] **Component: `RoomViewLayout.tsx` (New)**
    *   [ ] Main layout for when a room is selected (`/rooms/:roomId/*`).
    *   [ ] Renders `ChannelListSidebar` and the main content area (`Outlet`).
*   [ ] **Component: `ChannelListSidebar.tsx` (New)**
    *   [ ] Fetches and lists channels for the current `roomId` using `useChatChannels`.
    *   [ ] Renders channel links navigating to `/rooms/:roomId/channels/:channelId`.
    *   [ ] Includes "Create Channel" functionality.
*   [ ] **Component: `ChatChannelPage.tsx` (New)**
    *   [ ] Target route: `/rooms/:roomId/channels/:channelId`.
    *   [ ] Fetches messages using `useChatMessages` with `channelId`.
    *   [ ] Renders `MessageList` and `MessageInput`.
    *   [ ] Displays channel name/topic.
*   [ ] **Component: `MessageList.tsx` (Update)**
    *   [ ] Review styling/layout.
    *   [ ] Implement infinite scroll/pagination.
*   [ ] **Component: `MessageInput.tsx` (Update)**
    *   [ ] Adapt mention logic (`@`, `/team`) for room context.
    *   [ ] Pass `channelId` to `createMessage`.
*   [ ] **Component: `RoomSettingsPage.tsx` (New)**
    *   [ ] Route like `/rooms/:roomId/settings`.
    *   [ ] Contains UI for managing room name, members (`RoomMemberManager`), etc.
*   [ ] **Component: `RoomMemberManager.tsx` (New)**
    *   [ ] UI to list/add/remove room members (users, agents, teams) using `useRoomMembers`.

## Phase 4: Testing & Refinement

*   [ ] Test room creation, joining, leaving.
*   [ ] Test channel creation within a room.
*   [ ] Test adding/removing members from a room.
*   [ ] Test chat within channels, including real-time updates.
*   [ ] Test `@` and `/team` mentions.
*   [ ] Test agent context and tools within the room/channel structure.
*   [ ] Thoroughly test RLS policies.
*   [ ] Refine UI/UX based on testing.
*   [ ] Update documentation (`README.md`, etc.) to reflect the new chat room/channel structure. 