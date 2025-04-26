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
- [X] **Table: `chat_sessions`**
    - [X] Create migration file (`supabase/migrations/20250425211651_create_chat_sessions_table.sql`) for `chat_sessions`. (*Created*)
    - [X] Apply `chat_sessions` migration (`supabase db push`). (*Applied*)
    - [X] Implement RLS policy migration (`supabase/migrations/20250425211723_create_chat_sessions_rls.sql`). (*Created*)
    - [X] Apply `chat_sessions` RLS migration (`supabase db push`). (*Applied*)
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
- [X] **Hook: `useChatSessions` (`src/hooks/useChatSessions.ts`)**
    - [X] Create file and basic hook structure.
    - [X] Define `ChatSession` interface in `src/types.ts`.
    - [X] Implement `fetchChatSessions(teamId)` function.
    - [X] Implement `createChatSession(teamId, sessionName)` function.
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
    - [ ] Render `TeamMemberList` component, passing `teamId`.
    - [ ] Render `ChatSessionList` component, passing `teamId`.
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
- [X] **Component: `EditTeamPage.tsx` (`src/pages/EditTeamPage.tsx`)**
    - [X] Create file and basic component structure.
    - [X] Use `useParams` to get `teamId`.
    - [X] Call `useTeams` hook's `fetchTeamById` to get current data.
    - [X] Use `useState` for form fields, pre-filled with current data.
    - [X] Implement form submission handler calling `updateTeam`.
    - [X] Display loading/error states.
    - [X] Use `useNavigate` for redirection on success.

## Phase 5: Frontend Implementation - Agent Edit Page Update

- [X] **Hook Update: `useAgents` (or similar)**
    - [X] Add function `fetchAgentTeamDetails(agentId)` to fetch team membership info (e.g., query `team_members` where `agent_id = agentId`, join `teams` table).
- [X] **Component Update: `AgentEditPage.tsx` (`src/pages/AgentEditPage.tsx`)**
    - [X] Call new `fetchAgentTeamDetails` hook/function.
    - [X] Add a new section to the form/display area.
    - [X] Conditionally render team name and "Reports To" based on fetched data.

## Phase 6: Frontend Implementation - Chat UI & Functionality

- [ ] **Routing (`src/router/AppRouter.tsx`)**
    - [ ] Add `const ChatRoomPage = lazy(...)`.
    - [ ] Add `<Route path="/teams/:teamId/sessions/:sessionId" element={<Layout><ProtectedRoute><ChatRoomPage /></ProtectedRoute></Layout>} />`.
- [ ] **Component: `ChatSessionList.tsx` (`src/components/chat/ChatSessionList.tsx`)**
    - [ ] Create file and basic component structure.
    - [ ] Accept `teamId` prop.
    - [ ] Call `useChatSessions` hook to get `sessions`, `loading`, `error`.
    - [ ] Render loading/error states.
    - [ ] Map `sessions` array, rendering session name.
    - [ ] Wrap each session item in a `Link` to `/teams/${teamId}/sessions/${session.id}`.
    - [ ] Add button to trigger `CreateChatSessionModal`.
- [ ] **Component: `CreateChatSessionModal.tsx` (`src/components/chat/CreateChatSessionModal.tsx`)**
    - [ ] Create file and basic component structure (modal).
    - [ ] Accept `teamId`, `isOpen`, `onClose` props.
    - [ ] Use `useState` for `sessionName`