# WBS Checklist: Agent Profile Images

This checklist details the specific work breakdown structure tasks for implementing agent profile images.

## Phase 1: Refactor AgentEditPage.tsx (Prerequisite)

### Analyze `AgentEditPage.tsx`
- [x] Read file
- [x] List distinct functional blocks

### Backup Original File (Rule #3)
- [x] Copy `AgentEditPage.tsx` to `AgentEditPage.tsx.bak`

### Create Sub-Components
- [x] Create new `.tsx` files (`AgentFormBasicInfo`, `AgentFormInstructions`, `AgentDiscordSettings`, `AgentDatastoreSelector`)
- [x] Define basic component structure

### Migrate Logic
- [ ] Cut/paste JSX
- [ ] Cut/paste state hooks
- [ ] Cut/paste handlers/effects
- [ ] Adjust props/state management

### Update `AgentEditPage.tsx`
- [ ] Add imports
- [ ] Replace old JSX with new components
- [ ] Pass props down

### Test Refactoring
- [ ] Run frontend
- [ ] Navigate to edit page
- [ ] Test all existing functionalities

## Phase 2: Backend Setup

### Database Migration
- [ ] Create new migration file
- [ ] Add `ALTER TABLE agents ADD COLUMN avatar_url TEXT;`
- [ ] Run `supabase db push` (or apply via dashboard)

### Storage Bucket
- [ ] Use Supabase dashboard/CLI
- [ ] Create bucket (`agent_avatars`)

### Storage Policies
- [ ] Define SELECT policy
- [ ] Define INSERT policy (with function/user check)
- [ ] Define DELETE policy (with function/user check)
- [ ] Apply policies

### RLS for `agents` table
- [ ] Review existing `UPDATE` policy
- [ ] Modify `USING` / `WITH CHECK` clauses to include `avatar_url`

### Create Supabase Function (`generate-agent-image`)
- [ ] Create function files
- [ ] Add dependencies
- [ ] Write auth logic
- [ ] Implement OpenAI API call (DALL-E)
- [ ] Implement image upload to Supabase Storage
- [ ] Implement DB update (`agents.avatar_url`)
- [ ] Define return values
- [ ] Handle errors

### Deploy Function
- [ ] Run `supabase functions deploy generate-agent-image`

## Phase 3: Frontend Implementation

### Create `AgentProfileImageEditor.tsx` Component
- [ ] Create `src/components/agent-edit/AgentProfileImageEditor.tsx`
- [ ] Define props (e.g., `agentId`, `currentAvatarUrl`, `onUpdate`)

### Implement Upload Logic
- [ ] Add file input JSX
- [ ] Write validation function (type, size, aspect ratio)
- [ ] Implement `supabaseClient.storage.from(...).upload()` call
- [ ] Implement DB update call (via prop/hook)
- [ ] Add preview/display logic

### Implement AI Generation Logic
- [ ] Add textarea JSX
- [ ] Add button JSX
- [ ] Add loading state
- [ ] Create `src/lib/openaiClient.ts` (or similar service)
- [ ] Implement function invoke logic (`generate-agent-image`)
- [ ] Call service from button handler
- [ ] Add UI feedback

### Integrate into `AgentEditPage.tsx`
- [ ] Import `AgentProfileImageEditor` component
- [ ] Add component to JSX in the appropriate refactored sub-component
- [ ] Pass props

## Phase 4: Display Avatars

### Update `WorkspaceMemberSidebar.tsx`
- [ ] Locate agent rendering
- [ ] Add conditional rendering for avatar/icon
- [ ] Use `<img>` tag for `avatar_url`
- [ ] Add fallback logic (default icon)

### Update `WorkspaceMemberManager.tsx`
- [ ] Locate agent rendering
- [ ] Add conditional rendering for avatar/icon
- [ ] Use `<img>` tag for `avatar_url`
- [ ] Add fallback logic (default icon)

### Review Other Agent Displays
- [ ] Use search tool (`grep`) for agent list/display components
- [ ] Identify relevant files
- [ ] Update rendering logic similarly

## Phase 5: Testing & Verification

- [ ] Test Upload: Validation, success, DB update, display
- [ ] Test Generation: Prompt, loading, success/error, DB update, display
- [ ] Test Fallback: Default icon display
- [ ] Test Permissions: Upload/generate/update authorization, RLS
- [ ] Test Refactoring: `AgentEditPage.tsx` functionality intact 