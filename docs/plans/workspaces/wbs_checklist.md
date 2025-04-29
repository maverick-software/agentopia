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
*   [ ] **Table: `chat_messages` (Review & Update)**
    *   [ ] Verify `channel_id` (FK to `chat_channels`) is appropriate or if messages should link directly to `workspace_id`. *(Assumption: Keep channels within workspaces)*.
    *   [ ] Migration: Update RLS policies to check based on membership in the relevant `workspace_id` (derived from `channel_id` -> `chat_channels` -> `workspace_id`).
*   [ ] **Table: `teams` (No Change)**
    *   [X] Remains for defining reusable groups of agents.
*   [ ] **Table: `team_members` (No Change)**
    *   [X] Remains for defining agent membership *within a Team*.
*   [X] **Table: `chat_channels` (Review)**
    *   [X] Ensure `workspace_id` (FK to `workspaces.id`) exists and is NOT NULL (replacing `room_id`). *(Migration created)*
    *   [ ] Review/Update RLS based on workspace membership.
*   [X] **SQL Helper Functions (Review/Update)**
    *   [X] `is_workspace_member` created (as `is_chat_room_member`, implicitly renamed). (`20250428180807_update_workspaces_rls.sql`)
    *   [X] `can_manage_workspace_members` created (as `can_manage_chat_room_members`, implicitly renamed). (`20250428180914_workspace_members_rls.sql`)
*   [X] **Apply All Migrations** (Completed up to this point)

## Phase 2: Backend & API Layer Refactoring

*   [ ] **Hook: `useWorkspaces` (NEW)**
    *   [ ] Create `src/hooks/useWorkspaces.ts`.
    *   [ ] Implement `fetchWorkspaces()` (fetches workspaces user owns or is a member of).
    *   [ ] Implement `fetchWorkspaceById(workspaceId)`.
    *   [ ] Implement `createWorkspace(name, description?)`.
    *   [ ] Implement `updateWorkspace(workspaceId, data)` (check permissions - owner only).
    *   [ ] Implement `deleteWorkspace(workspaceId)` (check permissions - owner only).
    *   [ ] Add standard loading/error states.
*   [ ] **Hook: `useWorkspaceMembers` (NEW)**
    *   [ ] Create `src/hooks/useWorkspaceMembers.ts`.
    *   [ ] Implement `fetchMembers(workspaceId)` (fetches agents, teams, users linked via `workspace_members`).
    *   [ ] Implement `addAgentMember(workspaceId, agentId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addTeamMember(workspaceId, teamId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addUserMember(workspaceId, userEmail, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeAgentMember(workspaceId, agentId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeTeamMember(workspaceId, teamId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeUserMember(workspaceId, userId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `updateMemberRole(workspaceId, memberType, memberId, role)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Add standard loading/error states.
*   [ ] **Hook: `useChatMessages` (Update)**
    *   [ ] Ensure it uses `channelId` correctly and fetches based on workspace context if needed. *(Likely minimal change if channel focus remains)*.
*   [ ] **Hook: `useTeams` (No Change)**
    *   [ ] Remains for managing team definitions.
*   [ ] **Hook: `useTeamMembers` (No Change)**
    *   [ ] Remains for managing members *of a team*.
*   [ ] **Supabase Function: `/chat` (Update)**
    *   [ ] Update context fetching: Use `roomId` (workspace ID) to get workspace details.
    *   [ ] Fetch members from `workspace_members` based on `roomId`.
    *   [ ] Determine responding agent based on request or workspace logic.
    *   [ ] If team context needed for the specific *responding agent*, fetch its `team_members` details separately.

## Phase 3: Frontend UI Refactoring

*   [X] **Routing (`routeConfig.tsx`, `lazyComponents.ts`)**
    *   [X] Add route `/workspaces` -> `WorkspacesListPage`. *(Done)*
    *   [X] Ensure `/workspaces/:roomId` -> `WorkspacePage`. *(Done)*
    *   [ ] Remove `/teams/:teamId` route if team details page is no longer needed, or update it to remove workspace list. *(Decision: Keep `/teams/:teamId` for team management, remove workspace list)*. *(Status: Pending - needs check)*
    *   [X] Add `WorkspacesListPage` to lazy loading. *(Done)*
    *   [X] Add route `/workspaces/new` -> `CreateWorkspacePage`. *(Done)*
    *   [X] Add `CreateWorkspacePage` to lazy loading. *(Done)*
    *   [ ] Add `/workspaces/:roomId/settings` route -> `WorkspaceSettingsPage`. *(Status: Pending)*
*   [X] **Component: `WorkspacesListPage.tsx`**
    *   [X] Create `src/pages/WorkspacesListPage.tsx`. *(Done)*
    *   [X] Use fetch logic to list accessible workspaces (owned + member). *(Done - Initial implementation)*
    *   [X] Implement UI for triggering `createWorkspace`. *(Done - Button links to `/workspaces/new`)*.
    *   [X] Link each workspace item to `/workspaces/:roomId`. *(Done - Handled by `WorkspaceCard`)*.
*   [X] **Component: `CreateWorkspacePage.tsx` (NEW)**
    *   [X] Create `src/pages/CreateWorkspacePage.tsx`. *(Done)*
    *   [X] Implement form and Supabase insert logic. *(Done)*
*   [ ] **Component: `WorkspacePage.tsx` (Refactor `/workspaces/:roomId`)**
    *   [ ] Fetch data using `useWorkspaces(workspaceId)`. *(Pending)*
    *   [ ] Display workspace name/details in header. *(Pending)*
    *   [ ] Use `useChatMessages(channelId)` (Need logic to select/load a default/current channel within the workspace). *(Pending)*
    *   [ ] Render message list and input. *(Partially exists)*
    *   [ ] Adapt `handleSubmit` to determine responding agent and pass `roomId`. *(Pending)*
    *   [ ] Add UI element to navigate to `/workspaces/:roomId/settings`. *(Pending)*
*   [ ] **Component: `WorkspaceSettingsPage.tsx` (NEW)**
    *   *(Not created yet)*
*   [ ] **Component: `WorkspaceMemberManager.tsx` (NEW)**
    *   *(Not created yet)*
*   [X] **Component: `WorkspaceCard.tsx` (NEW)**
    *   [X] Create `src/components/workspaces/WorkspaceCard.tsx`. *(Done)*
    *   [X] Refactor `WorkspaceCard.tsx` for consistency with `TeamCard.tsx`. *(Done)*
*   [ ] **Component: `TeamDetailsPage.tsx` (Refactor `/teams/:teamId`)**
    *   *(Not refactored yet)*
*   [X] **Sidebar/Layout Updates:**
    *   [ ] Refactor `RoomListSidebar` -> `WorkspaceListSidebar`? Or integrate workspace list elsewhere. *(Decision: Replaced with `ChannelListSidebar`)*
    *   [X] Refactor `ChannelListSidebar` to fetch channels based on the current `workspaceId`. *(Hook exists, needs error fix)*
    *   [X] Update `Layout.tsx` to conditionally render `ChannelListSidebar` only when `roomId` param exists. *(Done)*

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