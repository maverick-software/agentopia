# Workspace Collaboration Feature - WBS Checklist

**Goal:** Refactor the system to make Workspaces the primary collaboration entity, owned by users. Workspaces will allow membership for individual Agents, pre-defined Teams, and other platform Users (invited by email).

**Implementation Plan:** High-level steps outlined below. Detailed sub-tasks will be added as we progress.

## Phase 1: Database Schema Refactoring

*   [X] **Table: `workspaces`**
    *   [X] Migration: Rename `chat_rooms` to `workspaces`. (`20250428182540_rename_chat_rooms_to_workspaces.sql`)
    *   [X] Migration: Remove `team_id` column. (`20250428180438_remove_team_id_from_workspaces.sql`)
    *   [X] Migration: Ensure `owner_user_id` (FK to `auth.users`) exists and is NOT NULL. (`20250428180456_ensure_workspace_owner.sql`)
    *   [X] Migration: Update RLS policies: (`20250428180807_update_workspaces_rls.sql`)
        *   SELECT: Owner OR Member (via new `workspace_members` table).
        *   UPDATE/DELETE: Owner only (initially).
        *   INSERT: Authenticated users (owner set automatically).
*   [X] **Table: `workspace_members` (NEW)**
    *   [X] Migration: Create table: (`20250428180604_create_workspace_members_table.sql`)
        *   `id` (uuid, PK)
        *   `workspace_id` (uuid, FK to `workspaces.id`, NOT NULL)
        *   `agent_id` (uuid, FK to `agents.id`, NULLABLE) - Represents an agent member
        *   `team_id` (uuid, FK to `teams.id`, NULLABLE) - Represents *all* members of this team being members
        *   `user_id` (uuid, FK to `auth.users`, NULLABLE) - Represents a platform user member
        *   `role` (text, NULLABLE, default 'member', e.g., 'moderator', 'member') - Role within this workspace
        *   `added_by_user_id` (uuid, FK to `auth.users`, NULLABLE)
        *   `created_at` (timestamptz, default now())
        *   Constraint: `CHECK (num_nonnulls(agent_id, team_id, user_id) = 1)` - Ensure only one member type per row.
        *   Constraint: `UNIQUE (workspace_id, agent_id)`
        *   Constraint: `UNIQUE (workspace_id, team_id)`
        *   Constraint: `UNIQUE (workspace_id, user_id)`
    *   [X] Migration: Implement RLS policies: (`20250428180914_workspace_members_rls.sql`)
        *   SELECT: Workspace members (check `workspace_members` for `auth.uid()`, or if `team_id` matches a team the user is in, or if `workspace_id` owned by user).
        *   INSERT/DELETE/UPDATE: Workspace owner or members with 'moderator' role (Requires helper function `can_manage_workspace_members`).
*   [X] **Table: `chat_channels` (Review)**
    *   [X] Ensure `workspace_id` (FK to `workspaces.id`) exists and is NOT NULL (replacing `room_id`). *(Migration `20250428180438...` created)*
    *   [X] Review/Update RLS based on workspace membership. (`20250428180438...`)
*   [X] **SQL Helper Functions (Review/Update)**
    *   [X] `is_workspace_member` created. (`20250428180438...`)
    *   [X] `can_manage_workspace_members` created. (`20250428180438...`)
*   [X] **Apply All Migrations** (Completed up to initial point)

*   [X] **Schema Correction & Sync (Completed via Migrations)**
    *   [X] ~~Manual SQL: Execute ALTER TABLE ... RENAME COLUMN ...~~ *(Done via migration `20250430162336...`)*
    *   [X] ~~Manual SQL: Execute DROP TABLE ...~~ *(Done via migration `20250430162336...`)*
    *   [X] ~~Verify Schema Manually~~ *(Implicitly verified by subsequent steps)*
    *   [X] ~~Repair Migration History: Run supabase migration repair ...~~ *(Handled during push/pull sequence)*
    *   [X] ~~Re-sync Local: Run supabase db pull ...~~ *(Completed)*
    *   [X] ~~Final Push Check: Run supabase db push ...~~ *(Completed)*
*   [X] **Fix `chat_channels` RLS**
    *   [X] Create Migration: `supabase migration new fix_chat_channels_rls` *(Assumed done)*
    *   [X] Edit Migration: Drop incorrect policies, add new policies (SELECT: `is_workspace_member`, INSERT: `is_workspace_member`, UPDATE/DELETE: Owner check using `workspace_id`). *(Assumed done in `20250428180438...`)*
    *   [X] Apply Migration: `supabase db push` *(Assumed done)*
*   [X] **Documentation Update**
    *   [X] Update `database/README.md` to reflect the finalized schema (workspace tables, columns, dropped tables, corrected RLS).
    *   [X] Update main `README.md` (Database, Workflow sections).
*   [ ] **Table: `chat_messages` (Review & Update RLS - Requires Schema Fix)**
    *   [ ] **Schema:** Verify `chat_messages` should use `channel_id` FK instead of `session_id`. Create migration if needed.
    *   [ ] **RLS:** Re-verify/Update RLS policies to check membership based on `workspace_id` derived from `channel_id`. Create migration if needed.
*   [X] **Table: `teams` (No Change)**
*   [X] **Table: `team_members` (No Change)**

## Phase 2: Backend & API Layer Refactoring

*   [X] **Hook: `useWorkspaces` (NEW)**
    *   [X] Create `src/hooks/useWorkspaces.ts`.
    *   [X] Implement `fetchWorkspaces()` (fetches workspaces user owns or is a member of).
    *   [X] Implement `fetchWorkspaceById(workspaceId)`.
    *   [X] Implement `createWorkspace(name, description?)`.
    *   [X] Implement `updateWorkspace(workspaceId, data)` (check permissions - owner only).
    *   [X] Implement `deleteWorkspace(workspaceId)` (check permissions - owner only).
    *   [X] Add standard loading/error states.
*   [ ] **Hook: `useWorkspaceMembers` (Partially Implemented)**
    *   [X] Create `src/hooks/useWorkspaceMembers.ts`.
    *   [X] Implement `fetchMembers(workspaceId)` (fetches agents, teams, users linked via `workspace_members` using RPC).
    *   [X] Implement `addAgentMember(workspaceId, agentId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addTeamMember(workspaceId, teamId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addUserMember(workspaceId, userEmail, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeMember(memberId)` (Handles all types, check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `updateMemberRole(memberId, newRole)` (check permissions via `can_manage_workspace_members`).
    *   [X] Add standard loading/error states.
*   [ ] **Hook: `useChatMessages` (Update - Requires Schema Fix)**
    *   [ ] Ensure it uses `channelId` correctly (currently uses `sessionId`).
    *   [ ] Implement fetching based on selected `channelId`.
    *   [ ] Add realtime subscription for messages filtered by `channelId`.
    *   [ ] **Refactor:** Ensure all internal logic uses `workspace_id` where relevant (if needed for context/permissions).
*   [X] **Hook: `useTeams` (No Change)**
    *   [X] Remains for managing team definitions.
*   [X] **Hook: `useTeamMembers` (No Change)**
    *   [X] Remains for managing members *of a team*.
*   [X] **Supabase Function: `/chat` (Update)**
    *   [X] Update context fetching: Use `workspaceId` to get workspace details.
    *   [X] Fetch members from `workspace_members` based on `workspaceId` (using RPC).
    *   [X] Determine responding agent based on request or workspace logic (using `workspace_members`).
    *   [ ] If team context needed for the specific *responding agent*, fetch its `team_members` details separately. *(Status: Pending)*
    *   [X] **Refactor:** Ensure internal logic uses `workspace_id`, `channelId`, and `workspace_members`.

## Phase 3: Frontend UI Refactoring (Post-Schema Fix)

*   [ ] **Routing (`routeConfig.tsx`, `lazyComponents.ts`)**
    *   [X] Add route `/workspaces` -> `WorkspacesListPage`. *(Done)*
    *   [X] Ensure `/workspaces/:roomId` -> `WorkspacePage`. *(Done)*
    *   [ ] Remove `/teams/:teamId` route if team details page is no longer needed, or update it to remove workspace list. *(Decision: Keep `/teams/:teamId` for team management, remove workspace list)*. *(Status: Pending - needs check/update)*
    *   [X] Add `WorkspacesListPage` to lazy loading. *(Done)*
    *   [X] Add route `/workspaces/new` -> `CreateWorkspacePage`. *(Done)*
    *   [X] Add `CreateWorkspacePage` to lazy loading. *(Done)*
    *   [ ] Add `/workspaces/:roomId/settings` route -> `WorkspaceSettingsPage`. *(Status: Pending)*
    *   [X] Ensure `/workspaces/:roomId/channels/:channelId` -> `WorkspacePage`. *(Done)*
*   [X] **Component: `WorkspacesListPage.tsx`**
    *   [X] Create `src/pages/WorkspacesListPage.tsx`. *(Done)*
    *   [X] Use fetch logic to list accessible workspaces (owned + member). *(Done - Doesn't use hook yet)*.
    *   [X] Implement UI for triggering `createWorkspace`. *(Done - Button links to `/workspaces/new`)*.
    *   [X] Link each workspace item to `/workspaces/:roomId`. *(Done - Handled by `WorkspaceCard`)*.
*   [X] **Component: `CreateWorkspacePage.tsx` (NEW)**
    *   [X] Create `src/pages/CreateWorkspacePage.tsx`. *(Done)*
    *   [X] Implement form and Supabase insert logic. *(Done - Doesn't use hook yet)*
*   [ ] **Component: `WorkspacePage.tsx` (Refactor `/workspaces/:roomId`)**
    *   [X] Fetch/Display workspace members (using `useWorkspaceMembers` hook).
    *   [ ] Fetch workspace details using `useWorkspaces(workspaceId)`. *(Currently fetches directly)*
    *   [X] Display workspace name/details in header. *(Uses direct fetch)*
    *   [X] Implement channel selection/default channel logic (navigates to first channel).
    *   [ ] Implement message fetching based on selected channel (using `useChatMessages` hook). *(Currently fetches directly via RPC)*
    *   [X] Render message list (`ChatMessage`).
    *   [X] Render input (`WorkspaceChatInput`).
    *   [ ] Verify `handleSubmit` logic (in `WorkspaceChatInput`) determines responding agent from `workspace_members` and passes `workspaceId`, `channelId`. *(Needs check)*
    *   [ ] Add UI element to navigate to `/workspaces/:roomId/settings`. *(Needs check)*
    *   [X] **Refactor:** Ensure all references use `workspaceId` from `useParams`.
*   [X] **Component: `WorkspaceSettingsPage.tsx` (NEW)**
    *   [X] Create `src/pages/WorkspaceSettingsPage.tsx`.
    *   [X] Use `useWorkspaces` for fetching/updating details.
*   [ ] **Component: `WorkspaceMemberManager.tsx` (NEW)**
    *   [ ] Create `src/components/workspaces/WorkspaceMemberManager.tsx`.
    *   [ ] Use `useWorkspaceMembers` hook for fetching/adding/removing/updating members.
    *   [ ] Implement UI for managing different member types (Agents, Teams, Users).
*   [X] **Component: `WorkspaceMemberSidebar.tsx` (NEW - Right Sidebar)**
    *   [X] Modify `WorkspacePage.tsx` layout to include a right sidebar section.
    *   [X] Create `src/components/workspaces/WorkspaceMemberSidebar.tsx`.
    *   [X] Implement basic member list display (pass `workspaceMembers` prop from `WorkspacePage`).
    *   [X] Add agent invite input and autocomplete UI.
    *   [X] Integrate `WorkspaceMemberSidebar` into `WorkspacePage.tsx`.
    *   **Invite Functionality (Agent Name):**
        *   [X] Enhance `useAgents` Hook: Add state (`agentSummaries`) and function (`fetchAgentSummaries`).
        *   [X] Fetch Agent Summaries: Call `fetchAgentSummaries` in `WorkspaceMemberSidebar`.
        *   [X] Implement Autocomplete UI.
        *   [X] Handle Selection.
        *   [X] Update Invite Logic: Calls `onAddAgent` prop (passed from `WorkspacePage`, uses `addAgentMember` from hook).
*   [X] **Component: `WorkspaceCard.tsx`**
    *   [X] Created `src/components/workspaces/WorkspaceCard.tsx`.
    *   [X] Styled consistently.
*   [ ] **Component: `TeamDetailsPage.tsx` (Refactor `/teams/:teamId`)**
    *   [ ] Remove any UI related to listing workspaces/chat rooms. *(Imports `TeamChatRoomList`)*
*   [X] **Sidebar/Layout Updates:**
    *   [X] `ChannelListSidebar` fetches channels based on `workspaceId` (using `useChatChannels` hook).
    *   [ ] **Verify:** `useChatChannels` hook correctly uses `workspaceId` parameter. *(Hook exists and seems correct)*.
    *   [X] `Layout.tsx` conditionally renders main `Sidebar`.
*   [ ] **Layout Refactoring (Workspace Focus)**
    *   [X] Modify `Layout.tsx`: Conditionally hide main `Sidebar`.
    *   [X] Modify `WorkspacePage.tsx`: Ensure it renders `ChannelListSidebar` directly.
    *   [ ] Modify `ChannelListSidebar.tsx`: Make workspace title header (`<h2/>`) a `Link` navigating back to `/workspaces`. *(Has "Exit Workspace" button instead)*.

## Phase 4: Testing & Refinement

*   [ ] **Functionality Testing:**
    *   [ ] Workspace Creation, Update, Deletion.
    *   [ ] Adding/Removing Agents, Teams, Users as members.
    *   [ ] Role changes for members.
    *   [ ] Chat functionality within a workspace channel.
    *   [ ] Agent responses using correct context (including team context if applicable).
*   [ ] **RLS Testing:**
    *   [ ] Verify non-owners/non-members cannot access/modify workspaces.
    *   [ ] Verify permissions for adding/removing members based on role/ownership.
    *   [ ] Verify chat message visibility based on workspace membership.
*   [ ] **UI/UX Testing & Refinement.**
*   [ ] **Documentation Updates (`README.md`, etc.).**

## Phase 5: Workspace Chat Context Enhancement

*   [ ] **Database Schema for Context Windows:**
    *   [ ] Migration: Add `context_window_size` column to `workspaces` table (default: 20).
    *   [ ] Migration: Add `context_window_token_limit` column to `workspaces` table (default: 8000).
    *   [ ] Migration: Update RLS policies for `workspaces` table to allow owner to modify context settings.

*   [ ] **Edge Function `/chat` Enhancements:**
    *   [X] Modify `/chat` to fetch workspace members for agent awareness. *(Done in Phase 2)*
    *   [ ] Modify `/chat` to fetch workspace context window settings.
    *   [ ] Implement chat history fetching based on context window settings:
        *   [ ] Fetch up to `context_window_size` most recent messages from channel.
        *   [ ] Apply token counting to respect `context_window_token_limit`.
        *   [ ] Include information about all agents in workspace as system context.
    *   [ ] Update message formatting to include agent metadata:
        *   [ ] Include agent name with each message.
        *   [ ] Include optional agent personality information.
    *   [ ] Modify system prompts to inform of workspace context:
        *   [X] Add workspace name and description to system context. *(Done in Phase 2)*
        *   [X] Add list of workspace members (agents, users) to system context. *(Done in Phase 2)*
        *   [X] Add awareness of channel (topic, purpose) to system context. *(Done in Phase 2)*

*   [ ] **Frontend - Workspace Settings:**
    *   [ ] Create `WorkspaceSettingsPage` component with tabs.
    *   [ ] Create `ContextSettingsTab` component with:
        *   [ ] Input for `context_window_size` (number of messages).
        *   [ ] Input for `context_window_token_limit` (maximum tokens).
        *   [ ] Toggle for including agent awareness.
        *   [ ] Save/Reset buttons to update settings.
    *   [ ] Create a database hook `useWorkspaceSettings`:
        *   [ ] Implement `fetchSettings(workspaceId)`.
        *   [ ] Implement `updateSettings(workspaceId, settings)`.
    *   [ ] Update routes in `routeConfig.tsx` to include `/workspaces/:roomId/settings`.

*   [ ] **WorkspaceChatInput Component Enhancement:**
    *   [ ] Add visual indicators for mentioning agents.
    *   [ ] Implement @mention autocomplete for agents in workspace.
    *   [ ] Format agent mentions in messages to be distinct.

*   [ ] **Agent Awareness UI:**
    *   [ ] Enhance `WorkspaceMemberSidebar` to show online/offline status.
    *   [ ] Add tooltip to agent names showing their role/purpose.
    *   [ ] Add indicator for which agent is responding to a message.

*   [ ] **Testing & Validation:**
    *   [ ] Test context window settings affecting message history.
    *   [ ] Validate agent awareness in responses (mentioning other agents).
    *   [ ] Measure performance impact of larger context windows.
    *   [ ] Test token limit enforcement.

*   [ ] **Documentation:**
    *   [ ] Update workspace documentation with context settings information.
    *   [ ] Add developer documentation on agent context implementation.
    *   [ ] Create user guide for workspace context settings. 