# Project Management Feature - WBS Checklist

**Goal:** Implement a comprehensive project management system similar to Asana/ClickUp, integrated with Agent capabilities.
**Plan:** `docs/plans/projects/project_management_plan.md`

---

## Phase 1: Database Schema & Core Backend

*   **Table: `projects`**
    *   [ ] Migration: Create `projects` table (`id`, `name`, `description`, `owner_user_id` FK to `auth.users`, `coordinator_agent_id` FK to `agents`, `created_at`).
    *   [ ] Migration: Add RLS policies (Owner can CRUD, Members can SELECT based on `project_members`).
*   **Table: `project_stages`**
    *   [ ] Migration: Create `project_stages` table (`id`, `project_id` FK to `projects`, `name`, `order` integer, `created_at`).
    *   [ ] Migration: Add RLS policies (Project members can SELECT, Project Admins/Owner can CRUD).
    *   [ ] Migration: Add unique constraint on (`project_id`, `order`).
    *   [ ] Migration: Add unique constraint on (`project_id`, `name`).
*   **Table: `project_tasks`**
    *   [ ] Migration: Create `project_tasks` table (`id`, `project_id` FK to `projects`, `stage_id` FK to `project_stages`, `title`, `description`, `created_at`, `updated_at`, `created_by_user_id` FK to `auth.users`, `order_in_stage` integer).
    *   [ ] Migration: Add RLS policies (Project members can SELECT/INSERT/UPDATE? TBD based on roles).
*   **Table: `project_roles`** (Potentially Seeded Enum-like)
    *   [ ] Migration: Create `project_roles` table (`role_name` text PK, `description`).
    *   [ ] Seed Data: Add default roles ('Admin', 'Editor', 'Viewer', 'QA').
*   **Table: `project_members`**
    *   [ ] Migration: Create `project_members` table (`id`, `project_id` FK to `projects`, `user_id` FK to `auth.users`, `role_name` FK to `project_roles`, `created_at`).
    *   [ ] Migration: Add RLS policies (Project Admins/Owner can CRUD, Members can SELECT).
    *   [ ] Migration: Add unique constraint on (`project_id`, `user_id`).
*   **Table: `project_task_assignments`**
    *   [ ] Migration: Create `project_task_assignments` table (`id`, `task_id` FK to `project_tasks`, `user_id` FK nullable FK to `auth.users`, `agent_id` FK nullable FK to `agents`, `assignment_type` text CHECK ('assignee', 'qa'), `created_at`).
    *   [ ] Constraint: `CHECK (num_nonnulls(user_id, agent_id) = 1)` - Ensure only user OR agent per row.
    *   [ ] Constraint: `UNIQUE (task_id, user_id, assignment_type)`.
    *   [ ] Constraint: `UNIQUE (task_id, agent_id, assignment_type)`.
    *   [ ] Migration: Add RLS policies (Project members can SELECT, Project Admins/Editors can CRUD?).
*   **Table: `project_invitations`**
    *   [ ] Migration: Create `project_invitations` table (`id`, `project_id` FK to `projects`, `email` text, `role_name` FK to `project_roles`, `invited_by_user_id` FK to `auth.users`, `token` text unique, `status` text CHECK ('pending', 'accepted', 'declined'), `created_at`, `expires_at`).
    *   [ ] Migration: Add RLS policies (Invited user can SELECT by token, Project Admins/Owner can CRUD).
*   **SQL Helper Functions**
    *   [ ] Create `is_project_member(p_project_id uuid, p_user_id uuid)` function.
    *   [ ] Create `can_manage_project(p_project_id uuid, p_user_id uuid)` function (checks Owner/Admin role).
    *   [ ] Create `can_edit_project_tasks(p_project_id uuid, p_user_id uuid)` function (checks Owner/Admin/Editor role).
    *   [ ] Grant execute permissions on helper functions.
*   **Apply Migrations**
    *   [ ] Run `supabase db push` (or equivalent) to apply all Phase 1 migrations.
*   **Backend Hooks (Core CRUD)**
    *   [ ] Hook: `useProjects`: Implement `fetchProjects`, `fetchProjectById`, `createProject`.
    *   [ ] Hook: `useProjectStages`: Implement `fetchStages(projectId)`, `createStage`, `updateStageOrder`, `deleteStage`.
    *   [ ] Hook: `useProjectTasks`: Implement `fetchTasksByStage(stageId)`, `createTask`, `updateTaskStage`, `updateTaskDetails`, `deleteTask`.
*   **Documentation Update:**
    *   [ ] Update `database/README.md` with new project-related tables.
    *   [ ] Update main `README.md`.

## Phase 2: Basic Frontend UI

*   **Routing:**
    *   [ ] Add `/projects` route -> `ProjectsListPage`.
    *   [ ] Add `/projects/new` route -> `CreateProjectPage`.
    *   [ ] Add `/projects/:projectId` route -> `ProjectBoardPage`.
    *   [ ] Add lazy loading for new pages.
*   **Component: `ProjectsListPage.tsx`**
    *   [ ] Create page component.
    *   [ ] Use `useProjects` hook to fetch and display list of projects accessible to the user.
    *   [ ] Add button linking to `/projects/new`.
    *   [ ] Link each project item to `/projects/:projectId`.
*   **Component: `CreateProjectPage.tsx`**
    *   [ ] Create page component.
    *   [ ] Implement form for project name, description.
    *   [ ] Implement selection for Coordinator Agent (How? Fetch available agents?).
    *   [ ] Use `useProjects` hook's `createProject` function.
    *   [ ] Redirect to the new project page on success.
*   **Component: `ProjectBoardPage.tsx`**
    *   [ ] Create page component.
    *   [ ] Fetch project details (`useProjects`), stages (`useProjectStages`), and tasks (`useProjectTasks`).
    *   [ ] Implement basic board layout (columns for stages).
    *   [ ] Render tasks within their respective stage columns.
    *   [ ] Implement UI for creating new tasks (within a stage column).
    *   [ ] Implement UI for creating new stages.
*   **Component: `StageColumn.tsx`**
    *   [ ] Create component to render a single stage column.
    *   [ ] Display stage title.
    *   [ ] Render list of tasks for the stage.
    *   [ ] Add button/mechanism to trigger adding a new task to this stage.
*   **Component: `TaskCard.tsx`**
    *   [ ] Create component to render a single task card.
    *   [ ] Display task title.
    *   [ ] (Optional V1) Display assignee(s).
    *   [ ] (Optional V1) Add click handler to open task details modal/view.

## Phase 3: Project Coordinator Agent Integration

*   **Project Board UI:**
    *   [ ] Add dedicated chat panel area to `ProjectBoardPage.tsx` layout (similar to `WorkspacePage`).
*   **Component: `ProjectChatPanel.tsx`**
    *   [ ] Create component for the agent chat interface.
    *   [ ] Fetch/Display chat history specific to this project-agent interaction (Needs new DB table? Or filter `chat_messages`?).
    *   [ ] Render `ProjectChatInput` component.
*   **Component: `ProjectChatInput.tsx`**
    *   [ ] Create component (similar to `WorkspaceChatInput`).
    *   [ ] Handle message submission.
    *   [ ] Send requests to a new/modified backend endpoint for project chat.
*   **Database Table: `project_chat_messages` (Alternative to filtering `chat_messages`)**
    *   [ ] Migration: Create `project_chat_messages` table (`id`, `project_id` FK, `content`, `sender_user_id` FK, `sender_agent_id` FK, `created_at`).
    *   [ ] Migration: Add RLS policies (Project members can SELECT/INSERT).
*   **Backend Hook: `useProjectChatMessages`**
    *   [ ] Create hook to fetch/subscribe to messages from `project_chat_messages` (or filtered `chat_messages`).
    *   [ ] Implement `createProjectMessage` function.
*   **Supabase Function: `/project-chat` (or modify `/chat`)**
    *   [ ] Create/Modify Edge Function to handle project chat requests.
    *   [ ] Input: `projectId`, `message`, `userId`.
    *   [ ] Fetch Project Coordinator Agent details (`coordinator_agent_id` from `projects` table).
    *   [ ] Fetch Project details, members, stages, tasks to provide context.
    *   [ ] Build context for the Coordinator Agent.
    *   [ ] Implement command parsing (e.g., "/createTask Title: X Stage: Y Assign: @AgentZ").
    *   [ ] If command detected:
        *   Validate command and permissions.
        *   Perform database action (insert task, update stage, etc.) using service role key.
        *   Generate confirmation message.
    *   [ ] If no command (general chat):
        *   Call OpenAI with context to generate a helpful response.
    *   [ ] Save user message and agent response to `project_chat_messages`.
    *   [ ] Return agent response.

## Phase 4: User Management & Permissions

*   **Project Board UI:**
    *   [ ] Add member management section (e.g., in a sidebar or settings page).
*   **Component: `ProjectMemberManager.tsx`**
    *   [ ] Create component to display project members and roles.
    *   [ ] Implement UI for inviting new members via email.
    *   [ ] Implement UI for changing member roles (requires permission checks).
    *   [ ] Implement UI for removing members (requires permission checks).
*   **Backend Hook: `useProjectMembers`**
    *   [ ] Create hook `useProjectMembers.ts`.
    *   [ ] Implement `fetchMembers(projectId)`.
    *   [ ] Implement `inviteMember(projectId, email, roleName)`.
    *   [ ] Implement `updateMemberRole(projectMemberId, roleName)`.
    *   [ ] Implement `removeMember(projectMemberId)`.
*   **Backend Hook: `useProjectInvitations`**
    *   [ ] Create hook `useProjectInvitations.ts`.
    *   [ ] Implement `acceptInvitation(token)`.
    *   [ ] Implement `declineInvitation(token)`.
*   **Email Service Integration:**
    *   [ ] Configure email sending service (e.g., Supabase SMTP, Resend).
    *   [ ] Implement logic in `inviteMember` hook function to send email with unique invitation link (`/accept-project-invite?token=...`).
*   **Frontend Page: `AcceptInvitePage.tsx`**
    *   [ ] Create page to handle invitation acceptance links.
    *   [ ] Extract token from URL.
    *   [ ] Call `acceptInvitation` hook function.
    *   [ ] Redirect user to the project page on success.
*   **Permission Enforcement:**
    *   [ ] Review and refine RLS policies on all project tables based on defined roles.
    *   [ ] Add checks in backend hooks (e.g., `createTask`, `updateStage`) to verify user permissions based on their role in the project (fetched via `is_project_member` / `can_...` helpers).
    *   [ ] Conditionally disable/hide UI elements in the frontend based on user permissions.

## Phase 5: Advanced Features & Refinement

*   **Task Assignment UI:**
    *   [ ] Update `TaskCard.tsx` to clearly display assignees (user/agent).
    *   [ ] Implement UI (e.g., in task detail view/modal) to assign/unassign users/agents.
    *   [ ] Implement UI to assign/unassign QA user/agent.
*   **Task Detail View/Modal:**
    *   [ ] Create component `TaskDetailModal.tsx`.
    *   [ ] Display full task details (title, description, stage, assignees, QA).
    *   [ ] Allow editing of task details (requires permission checks).
*   **Drag-and-Drop:**
    *   [ ] Implement drag-and-drop for tasks between stages on `ProjectBoardPage.tsx` (e.g., using `react-beautiful-dnd` or similar).
    *   [ ] Update task's `stage_id` and potentially `order_in_stage` via `useProjectTasks` hook on drop.
    *   [ ] (Optional) Implement drag-and-drop for reordering tasks within a stage.
    *   [ ] (Optional) Implement drag-and-drop for reordering stages.
*   **QA Assignment:**
    *   [ ] Ensure `project_task_assignments` table supports `assignment_type = 'qa'`.
    *   [ ] Update `useProjectTasks` hook with functions to `assignQA`, `unassignQA`.
    *   [ ] Add UI elements for QA assignment.
*   **Filtering/Sorting:**
    *   [ ] Add options to filter tasks on the board (e.g., by assignee).
    *   [ ] Add options to sort tasks within stages.
*   **Testing:**
    *   [ ] Perform comprehensive functionality testing for all features.
    *   [ ] Perform thorough RLS and permission testing for different roles.
    *   [ ] Test edge cases (empty projects, large number of tasks, etc.).
    *   [ ] Test invitation workflow.
    *   [ ] Test Project Coordinator Agent interactions and commands.
*   **Final Documentation:**
    *   [ ] Update `README.md` and relevant documentation (`database/README.md`, feature docs).

--- 