# Agent Teams & Team Rooms Feature - WBS Checklist

## Phase 1: Setup & Prerequisites

- [X] **Supabase Setup:**
    - [X] Enable `pgvector` extension in Supabase project settings via SQL Editor (`CREATE EXTENSION IF NOT EXISTS vector;`). (*User confirmed done*)
    - [X] Verify database credentials (URL, service_role_key) are correctly configured in relevant environment variables (`.env`, Supabase function settings). (*Assumed done based on project state*)
- [X] **Embedding Strategy:**
    - [X] Decide on embedding model (e.g., Supabase built-in `supabase_functions.vector_generate()`, OpenAI `text-embedding-3-small`, etc.). Document choice. (*Decision: OpenAI text-embedding-3-small*)
    - [X] Configure API keys/secrets if using an external model (e.g., `OPENAI_API_KEY` in function settings). (*User confirmed OPENAI_API_KEY exists*)
- [X] **Edge Functions:**
    - [X] Create Supabase Edge Function project: `generate-embedding`. (*Created via CLI*)
    - [X] Implement basic function structure in `generate-embedding/index.ts`. (*Initial template created*)
    - [X] Implement embedding generation logic using chosen model within `generate-embedding`. (*Implemented OpenAI logic*)
    - [X] Decide on trigger mechanism (DB webhook vs. explicit API call from `useChatMessages`). Document choice. (*Decision: Explicit API call*)
    - [ ] *(If using webhook)* Configure Supabase Database Webhook on `chat_messages` insert to call `generate-embedding`. (*Skipped based on decision*)
    - [ ] Deploy `generate-embedding` function (`supabase functions deploy generate-embedding`). (*Not yet deployed*)
- [X] **Define Agent Roles:**
    - [X] Create or update `/docs/project/agent_roles.md` documenting standard team roles (`project_manager`, `user_liaison`, `qa`, `member`). (*Created*)
    - [X] Define role exclusivity rules: only one project manager, one QA, and one user liaison per team. (*Added*)

## Phase 2: Database Implementation

- [X] **Table: `teams`**
    - [X] Create migration file (`supabase/migrations/20250425210846_create_teams_table.sql`) for `teams` table. (*Created*)
    - [X] Add `owner_user_id` column migration (`supabase/migrations/20250425211223_add_owner_to_teams.sql`). (*Created*)
    - [X] Apply `teams` & `owner` migrations (`supabase db push`). (*Applied*)
    - [X] Implement RLS policy migration (`supabase/migrations/20250425211310_create_teams_rls.sql`). (*Created*)
    - [X] Apply `teams` RLS migration (`supabase db push`). (*Applied*)
- [X] **Table: `team_members`**
    - [X] Create migration file (`supabase/migrations/20250425211408_create_team_members_table.sql`) for `team_members` (incl. `team_role`, `team_role_description`). (*Created*)
    - [X] Apply `team_members` migration (`supabase db push`). (*Applied after fixing syntax*)
    - [X] Implement RLS policy migration (`supabase/migrations/20250425211511_create_team_members_rls.sql`) incl. helper functions. (*Created*)
    - [X] Apply `team_members` RLS migration (`supabase db push`). (*Applied*)
    - [X] Add `job_description` text field to `team_members` table. (*Added*)
    - [X] Add `reports_to_agent_id` and `reports_to_user` fields to implement hierarchy. (*Added*)
- [X] **Table: `workspaces`** (renamed from `chat_sessions`)
    - [X] Create migration file (`supabase/migrations/20250425211651_create_chat_sessions_table.sql`) for `workspaces`. (*Created*)
    - [X] Apply `workspaces` migration (`supabase db push`). (*Applied*)
    - [X] Implement RLS policy migration (`supabase/migrations/20250425211723_create_chat_sessions_rls.sql`). (*Created*)
    - [X] Apply `workspaces` RLS migration (`supabase db push`). (*Applied*)
- [X] **Table: `chat_messages`**
    - [X] Create migration file (`supabase/migrations/20250425211817_create_chat_messages_table.sql`) for `chat_messages` (incl. `embedding`, `metadata`, realtime). (*Created*)
    - [X] Apply `chat_messages` migration (`supabase db push`). (*Applied*)
    - [X] Enable Realtime for `chat_messages` table in Supabase dashboard. (*User reminded*)
    - [X] Implement RLS policy migration (`supabase/migrations/20250425211954_create_chat_messages_rls.sql`) incl. helper function. (*Created*)
    - [X] Apply `chat_messages` RLS migration (`supabase db push`). (*Applied*)
- [-] **Database Functions/Triggers:** (*Helper functions created within RLS migrations*)
    - [ ] *(If using DB trigger for embeddings)* Create SQL function `handle_new_chat_message()` that calls `pg_net` to trigger `generate-embedding` edge function. (*Skipped*)
    - [ ] *(If using DB trigger for embeddings)* Create trigger `trigger_generate_embedding` AFTER INSERT ON `chat_messages` FOR EACH ROW EXECUTE FUNCTION `handle_new_chat_message()`. (*Skipped*)
    - [X] Create SQL function `is_team_member(p_team_id uuid, p_user_id uuid)` RETURNS boolean. (*Created in 20250425211511*)
    - [X] Create SQL function `is_team_admin_or_pm(p_team_id uuid, p_user_id uuid)` RETURNS boolean (checks `team_members.role`). (*Created in 20250425211511*)
    - [X] Create SQL function `get_team_id_for_session(p_session_id uuid)` RETURNS uuid. (*Created in 20250425211954*)
    - [ ] *(Optional)* Create SQL function `is_agent_in_team(p_agent_id uuid, p_team_id uuid)` RETURNS boolean. (*Not yet created*)

## Phase 3: API Layer (React Hooks/Services)

- [X] **Prerequisite: Define Core TypeScript Interfaces** (`Team`, `TeamMember`, etc.) (*Completed*)
- [X] **Hook: `useTeams` (`src/hooks/useTeams.ts`)**
    - [X] Create file and basic hook structure. (*Completed*)
    - [X] Implement `fetchTeams` function. (*Completed*)
    - [X] Implement `fetchTeamById(teamId)` function. (*Completed*)
    - [X] Implement `createTeam(name, description)` function. (*Completed*)
    - [X] Implement `updateTeam(teamId, data)` function. (*Completed*)
    - [X] Implement `deleteTeam(teamId)` function. (*Completed*)
    - [X] Add `useState` for loading and error states, update them in functions. (*Completed*)
    - [X] Export hook and necessary types. (*Completed*)
- [X] **Hook: `useTeamMembers` (`src/hooks/useTeamMembers.ts`)**
    - [X] Create file and basic hook structure. (*Verified existing*)
    - [X] Implement `fetchTeamMembers(teamId)` function. (*Verified existing*)
    - [X] Implement `addTeamMember(teamId, agentId, role, description?)` function. (*Verified existing*)
    - [X] Implement `removeTeamMember(teamId, agentId)` function. (*Verified existing*)
    - [X] Implement `updateTeamMember(teamId, agentId, updates)` function. (*Verified existing*)
    - [X] Add `useState` for loading and error states. (*Verified existing*)
    - [X] Export hook and types. (*Verified existing*)
- [X] **Hook: `useTeamChatRooms` (`src/hooks/useTeamChatRooms.ts`)**
    - [X] Create file and basic hook structure.
    - [X] Define `ChatRoom` interface in `src/types.ts`.
    - [X] Implement `fetchTeamChatRooms(teamId)` function.
    - [X] Implement `createChatRoom(teamId, roomName)` function.
    - [X] Add `useState` for loading and error states.
    - [X] Export hook and types.
- [X] **Hook: `useChatMessages` (`src/hooks/useChatMessages.ts`)**
    - [X] Create file and basic hook structure.
    - [X] Define `ChatMessage` interface in `src/types.ts`.
    - [X] Implement `fetchMessages(sessionId, offset, limit)` function.
    - [X] Implement `createMessage(sessionId, content, { senderAgentId?, senderUserId?, metadata? })` function.
    - [X] Modify `createMessage` to call `generate-embedding` function via RPC and update message row.
    - [X] Implement `subscribeToNewMessages(sessionId, handler)`.
    - [X] Implement `unsubscribeFromMessages(channel)`.
    - [X] Add `useState` for loading, error, and messages array.
    - [X] Export hook and types.

## Phase 4: Frontend Implementation - Core Team UI

- [X] **Routing (`src/router/AppRouter.tsx`)**
    - [X] Add `const TeamsPage = lazy(...)`.
    - [X] Add `const CreateTeamPage = lazy(...)`.
    - [X] Add `const TeamDetailsPage = lazy(...)`.
    - [X] Add `const EditTeamPage = lazy(...)`.
    - [X] Add `<Route path="/teams" element={<Layout><ProtectedRoute><TeamsPage /></ProtectedRoute></Layout>} />`.
    - [X] Add `<Route path="/teams/new" element={<Layout><ProtectedRoute><CreateTeamPage /></ProtectedRoute></Layout>} />`.
    - [X] Add `<Route path="/teams/:teamId" element={<Layout><ProtectedRoute><TeamDetailsPage /></ProtectedRoute></Layout>} />`.
    - [X] Add `<Route path="/teams/:teamId/edit" element={<Layout><ProtectedRoute><EditTeamPage /></ProtectedRoute></Layout>} />`.
- [X] **Component: `TeamsPage.tsx` (`src/pages/TeamsPage.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Call `useTeams` hook to get `teams`, `loading`, `error`.
    - [X] Render loading spinner or error message based on state.
    - [X] Map `teams` array to `TeamCard` components.
    - [X] Add a `Link` component from `react-router-dom` for "Create New Team" -> `/teams/new`.
- [X] **Component: `TeamCard.tsx` (`src/components/teams/TeamCard.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Accept `team` object as prop.
    - [X] Render team name and description.
    - [X] Wrap component in a `Link` to `/teams/${team.id}`.
- [X] **Component: `CreateTeamPage.tsx` (`src/pages/CreateTeamPage.tsx`)**
    - [X] Create file and basic component structure (likely a form).
    - [X] Use `useState` for form fields (name, description).
    - [X] Call `useTeams` hook to get `createTeam`, `loading`, `error`.
    - [X] Implement form submission handler calling `createTeam`.
    - [X] Implement basic form validation (e.g., name required).
    - [X] Display loading/error states during/after submission.
    - [X] Use `useNavigate` hook for redirection on success.
- [X] **Component: `TeamDetailsPage.tsx` (`src/pages/TeamDetailsPage.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Use `useParams` hook to get `teamId`.
    - [X] Call `useTeams` hook to `fetchTeamById(teamId)`.
    - [X] Display team name and description.
    - [X] Add `Link` to `/teams/${teamId}/edit`.
    - [X] Render `TeamMemberList` component, passing `teamId`.
    - [X] Render `TeamChatRoomList` component, passing `teamId`.
    - [X] Display loading/error states for team fetching.
- [X] **Component: `AgentSelector.tsx` (`src/components/shared/AgentSelector.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Accept `onSelectAgent` callback prop.
    - [X] Accept `excludeAgentIds` prop (array of agent IDs already on team).
    - [X] Fetch list of all agents (needs `useAgents` hook or similar).
    - [X] Filter out excluded agents.
    - [X] Render as a `<select>` dropdown or searchable input.
    - [X] Call `onSelectAgent(selectedAgentId)` when selection changes.
- [X] **Component: `TeamMemberList.tsx` (`src/components/teams/TeamMemberList.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Accept `teamId` prop.
    - [X] Call `useTeamMembers` hook to get `members`, `loading`, `error`, `addTeamMember`, `removeTeamMember`, `updateTeamMember`.
    - [X] Render loading/error states.
    - [X] Display table or list of members (name, role, reports to).
    - [X] Implement "Add Member" section:
        - [X] Render `AgentSelector` (passing current member IDs to `excludeAgentIds`).
        - [X] Add dropdown for selecting Role.
        - [X] Add button to trigger `addTeamMember`.
    - [X] Implement "Remove" button next to each member, calling `removeTeamMember`.
    - [X] Implement Role update mechanism (e.g., dropdown next to member, calls `updateTeamMember`).
    - [X] Implement "Reports To" update mechanism:
        - [X] Dropdown/modal showing team members + "User" option.
        - [X] Filter out the agent itself from the list.
        - [X] Call `updateTeamMember` with `reports_to_agent_id` or `reports_to_user`.
        - [X] Handle logic/UI to prevent multiple `reports_to_user`.
    - [X] Convert inline add form to modal.
    - [X] Create edit modal with role selection and remove functionality.
    - [X] Enforce one-per-team limit for specialized roles (project manager, QA, user liaison).
- [X] **Component: `EditTeamMemberModal.tsx` (`src/components/teams/EditTeamMemberModal.tsx`)**
    - [X] Create file and basic modal component structure.
    - [X] Accept props: `isOpen`, `onClose`, `onUpdateRole`, `onRemoveMember`, `member`.
    - [X] Display team member name.
    - [X] Implement role selection dropdown.
    - [X] Add job description text area field.
    - [X] Add "Remove from team" button with confirmation.
    - [X] Implement save changes button.
    - [X] Handle loading and error states.
- [X] **Component: `EditTeamPage.tsx` (`src/pages/EditTeamPage.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Use `useParams` to get `teamId`.
    - [X] Call `useTeams` hook's `fetchTeamById` to get current data.
    - [X] Use `useState` for form fields, pre-filled with current data.
    - [X] Implement form submission handler calling `updateTeam`.
    - [X] Display loading/error states.
    - [X] Use `useNavigate` for redirection on success.
- [X] **Component: `TeamChatRoomList.tsx` (`src/components/teams/TeamChatRoomList.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Accept `teamId` prop.
    - [X] Call `useTeamChatRooms` hook to get chat rooms, loading, error.
    - [X] Render loading/error states.
    - [X] Display list of workspaces with links to open.
    - [X] Add "Create Workspace" button.

## Phase 5: Frontend Implementation - Agent Edit Page Update

- [X] **Hook Update: `useAgents` (or similar)**
    - [X] Add function `fetchAgentTeamDetails(agentId)` to fetch team membership info (e.g., query `team_members` where `agent_id = agentId`, join `teams` table).
- [X] **Component Update: `AgentEditPage.tsx` (`src/pages/AgentEditPage.tsx`)**
    - [X] Call new `fetchAgentTeamDetails` hook/function.
    - [X] Add a new section to the form/display area.
    - [X] Conditionally render team name and "Reports To" based on fetched data.

## Phase 6: Frontend Implementation - Chat UI & Functionality

- [X] **Routing (`src/router/AppRouter.tsx`)**
    - [X] Add `const WorkspacePage = lazy(...)`.
    - [X] Add `<Route path="/workspace/:workspaceId" element={<Layout><ProtectedRoute><WorkspacePage /></ProtectedRoute></Layout>} />`.
- [X] **Component: `WorkspacePage.tsx` (`src/pages/WorkspacePage.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Use `useParams` to get `workspaceId`.
    - [X] Call appropriate hooks to load workspace data and messages.
    - [X] Render workspace UI with chat interface.
    - [X] Show team context in sidebar or header.

## Phase 7: Team Role Management Enhancements

- [X] **Role Exclusivity Enforcement**
    - [X] Modify `addTeamMember` and `updateTeamMember` functions to check for existing specialized roles.
    - [X] Implement validation logic preventing multiple instances of specialized roles (project manager, QA, user liaison).
    - [X] Add error handling and user feedback for role conflicts.
    - [X] Update UI to reflect role restrictions.

- [X] **Job Description Implementation**
    - [X] Add job description textarea field to `AddTeamMemberModal.tsx`.
    - [X] Add job description textarea field to `EditTeamMemberModal.tsx`.
    - [X] Update `addTeamMember` and `updateTeamMember` functions to handle job description field.
    - [X] Create database migration to add `job_description` column to `team_members` table if not already present.

- [X] **Reporting Hierarchy Implementation**
    - [X] Add "Reports To" dropdown to team member edit modal.
    - [X] Populate dropdown with team members and "User" option.
    - [X] Implement logic ensuring only one agent can report to user.
    - [X] Add validation preventing circular reporting chains.

## Phase 8: System Instructions Context Integration

- [ ] **Context System for Workspace Agents**
    - [ ] Create mechanism to add team role, job description, and reporting hierarchy to agent context window.
    - [ ] Modify workspace chat interface to include team context in agent prompts.
    - [ ] Update agent instruction generator to include team-specific information when agent operates in a workspace.
    - [ ] Test context integration with various agent roles and hierarchies.

- [ ] **Role-Based Behavior Guidelines**
    - [ ] Define behavior expectations for each specialized role (project manager, QA, user liaison).
    - [ ] Document how reporting hierarchy should influence agent behavior.
    - [ ] Implement prompt engineering strategies that leverage team structure.
    - [ ] Create examples and templates for effective team agent interactions.