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
    *   [X] Ensure `workspace_id` (FK to `workspaces.id`) exists and is NOT NULL (replacing `room_id`). *(Migration `20250428190000...` or `20250428180438...` created)*
    *   [X] Review/Update RLS based on workspace membership. (`20250428180438...`)
*   [X] **SQL Helper Functions (Review/Update)**
    *   [X] `is_workspace_member` created. (`20250428180438...`)
    *   [X] `can_manage_workspace_members` created. (`20250428180438...`)
*   [X] **Apply All Migrations** (Completed up to initial point)

*   **Schema Correction & Sync (Completed via Migrations)**
    *   [X] ~~Manual SQL: Execute ALTER TABLE ... RENAME COLUMN ...~~ *(Done via migration `20250430162336...`)*
    *   [X] ~~Manual SQL: Execute DROP TABLE ...~~ *(Done via migration `20250430162336...`)*
    *   [X] ~~Verify Schema Manually~~ *(Implicitly verified by subsequent steps)*
    *   [X] ~~Repair Migration History: Run supabase migration repair ...~~ *(Handled during push/pull sequence)*
    *   [X] ~~Re-sync Local: Run supabase db pull ...~~ *(Completed)*
    *   [X] ~~Final Push Check: Run supabase db push ...~~ *(Completed)*
*   **Fix `chat_channels` RLS (Pending)**
    *   [x] Create Migration: `supabase migration new fix_chat_channels_rls`
    *   [x] Edit Migration: Drop incorrect policies, add new policies (SELECT: `is_workspace_member`, INSERT: `is_workspace_member`, UPDATE/DELETE: Owner check using `workspace_id`). *(Included function definition)*
    *   [x] Apply Migration: `supabase db push`
*   **Documentation Update (Pending)**
    *   [x] Update `database/README.md` to reflect the finalized schema (workspace tables, columns, dropped tables, corrected RLS).
    *   [x] Update main `README.md` (Database, Workflow sections).
*   **Table: `chat_messages` (Review & Update RLS - Post RLS Fix)**
    *   [ ] Verify `channel_id` (FK to `chat_channels`) is appropriate. *(Decision: Keep channels)*.
    *   [ ] Re-verify RLS policies check membership based on `workspace_id` derived from `channel_id`. (`20250428180438...` - Might need update after RLS fix).
*   **Table: `teams` (No Change)**
*   **Table: `team_members` (No Change)**

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
    *   [X] Create `src/hooks/useWorkspaceMembers.ts`.
    *   [X] Implement `fetchMembers(workspaceId)` (fetches agents, teams, users linked via `workspace_members`).
    *   [X] Implement `addAgentMember(workspaceId, agentId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addTeamMember(workspaceId, teamId, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `addUserMember(workspaceId, userEmail, role?)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeAgentMember(workspaceId, agentId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeTeamMember(workspaceId, teamId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `removeUserMember(workspaceId, userId)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Implement `updateMemberRole(workspaceId, memberType, memberId, role)` (check permissions via `can_manage_workspace_members`).
    *   [ ] Add standard loading/error states.
*   [ ] **Hook: `useChatMessages` (Update)**
    *   [ ] Ensure it uses `channelId` correctly.
    *   [ ] Implement fetching based on selected `channelId`.
    *   [ ] Add realtime subscription for messages in a channel.
    *   [ ] **Refactor:** Ensure all internal logic uses `workspace_id` where relevant (if needed for context/permissions).
*   [ ] **Hook: `useTeams` (No Change)**
    *   [ ] Remains for managing team definitions.
*   [ ] **Hook: `useTeamMembers` (No Change)**
    *   [ ] Remains for managing members *of a team*.
*   [ ] **Supabase Function: `/chat` (Update)**
    *   [ ] Update context fetching: Use `roomId` (which is `workspaceId`) to get workspace details.
    *   [ ] Fetch members from `workspace_members` based on `roomId`.
    *   [ ] Determine responding agent based on request or workspace logic (using `workspace_members`).
    *   [ ] If team context needed for the specific *responding agent*, fetch its `team_members` details separately.
    *   [ ] **Refactor:** Ensure all internal logic uses `workspace_id` and `workspace_members`.

## Phase 3: Frontend UI Refactoring (Post-Schema Fix)

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
*   [ ] **Component: `WorkspacePage.tsx` (Refactor `/workspaces/:roomId`) (Post-Schema Fix)**
    *   [X] Fetch/Display workspace members (using `workspace_members` table). *(Done - Needs Testing)*
    *   [ ] Fetch workspace details using `useWorkspaces(workspaceId)`.
    *   [ ] Display workspace name/details in header. *(Partially Done)*
    *   [ ] Implement channel selection/default channel logic.
    *   [ ] Implement message fetching based on selected channel (using `useChatMessages`).
    *   [X] Render message list (`ChatMessage`) and input (`WorkspaceChatInput`). *(Partially exists, Renamed from MessageInput)*
    *   [ ] Refactor `handleSubmit` to determine responding agent from `workspace_members` and pass `roomId` (`workspaceId`), `channelId`.
    *   [ ] Add UI element to navigate to `/workspaces/:roomId/settings`.
    *   [ ] **Refactor:** Ensure all references use `workspaceId` from `useParams`.
*   [ ] **Component: `WorkspaceSettingsPage.tsx` (NEW)**
    *   [ ] Create `src/pages/WorkspaceSettingsPage.tsx`.
    *   [ ] Use `useWorkspaces` for fetching/updating details.
*   [ ] **Component: `WorkspaceMemberManager.tsx` (NEW)**
    *   [ ] Create `src/components/workspaces/WorkspaceMemberManager.tsx`.
    *   [ ] Use `useWorkspaceMembers` hook for fetching/adding/removing/updating members.
    *   [ ] Implement UI for managing different member types (Agents, Teams, Users).
*   **Component: `WorkspaceMemberSidebar.tsx` (NEW - Right Sidebar)**
    *   [X] Modify `WorkspacePage.tsx` layout to include a right sidebar section.
    *   [X] Create `src/components/workspaces/WorkspaceMemberSidebar.tsx`.
    *   [X] Implement basic member list display (pass `workspaceMembers` prop from `WorkspacePage`).
    *   [X] Add placeholder UI for member invite input and button.
    *   [X] Integrate `WorkspaceMemberSidebar` into `WorkspacePage.tsx`.
    *   **Invite Functionality (Agent Name):**
        *   [X] Enhance `useAgents` Hook: Add state (`agentSummaries`) and function (`fetchAgentSummaries`) to fetch agent `id` and `name` list.
        *   [X] Fetch Agent Summaries: Call `fetchAgentSummaries` in `WorkspaceMemberSidebar` using the `useAgents` hook.
        *   [X] Implement Autocomplete UI: Add state/logic to filter agent summaries based on `@` input, display dropdown suggestions.
        *   [X] Handle Selection: Store the selected agent's ID from the dropdown.
        *   [X] Update Invite Logic: Modify `handleInvite` to use the selected agent ID when calling `addAgentMember`.
*   [X] **Component: `WorkspaceCard.tsx`**
    *   [X] Created `src/components/workspaces/WorkspaceCard.tsx`.
    *   [X] Styled consistently.
*   [ ] **Component: `TeamDetailsPage.tsx` (Refactor `/teams/:teamId`)**
    *   [ ] Remove any UI related to listing workspaces/chat rooms.
*   [X] **Sidebar/Layout Updates:**
    *   [X] `ChannelListSidebar` fetches channels based on `workspaceId`. *(Needs schema fix)*
    *   [ ] **Refactor:** Verify `useChatChannels` hook (used by sidebar) correctly uses `workspaceId` parameter after schema fix.
    *   [X] `Layout.tsx` conditionally renders `ChannelListSidebar`.
*   [X] **Layout Refactoring (Workspace Focus)**
    *   [x] Modify `Layout.tsx`: Conditionally hide main `Sidebar` based on workspace route (`/workspaces/:roomId/...`, excluding `/workspaces` and `/workspaces/new`).
    *   [x] Modify `WorkspacePage.tsx`: Ensure it renders `ChannelListSidebar` directly within its own structure.
    *   [x] Modify `ChannelListSidebar.tsx`: Make workspace title header (`<h2/>`) a `Link` navigating back to `/workspaces`.

## Phase 4: Testing & Refinement (Post-Schema Fix)

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