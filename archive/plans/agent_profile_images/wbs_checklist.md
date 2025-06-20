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
- [x] Cut/paste JSX
- [ ] Cut/paste state hooks (N/A - State lifted to parent)
- [x] Cut/paste handlers/effects (Generic handlers created in parent)
- [x] Adjust props/state management (Props defined and passed)

### Update `AgentEditPage.tsx`
- [x] Add imports
- [x] Replace old JSX with new components
- [x] Pass props down

### Test Refactoring
- [ ] Run frontend
- [ ] Navigate to edit page
- [ ] Test all existing functionalities

## Phase 2: Backend Setup

### Database Migration
- [x] Create new migration file
- [x] Add `ALTER TABLE agents ADD COLUMN avatar_url TEXT;`
- [x] Run `supabase db push` (and resolve sync issues)

### Storage Bucket
- [x] Use Supabase dashboard/CLI
- [x] Create bucket (`agent-avatars`)

### Storage Policies
- [x] Define SELECT policy (N/A - Public Bucket)
- [x] Define INSERT policy (with function/user check)
- [x] Define UPDATE policy (with function/user check)
- [x] Define DELETE policy (with function/user check)
- [x] Apply policies (via migration)

### RLS for `agents` table
- [x] Review existing `UPDATE` policy
- [x] Modify `USING` / `WITH CHECK` clauses to include `avatar_url` (N/A - Existing policy sufficient)

### Create Supabase Function (`generate-agent-image`)
- [x] Create function files
- [x] Add dependencies (Imports added)
- [x] Write auth logic
- [x] Implement OpenAI API call (DALL-E)
- [x] Implement image upload to Supabase Storage
- [x] Implement DB update (`agents.avatar_url`)
- [x] Define return values
- [x] Handle errors

### Deploy Function
- [x] Run `supabase functions deploy generate-agent-image`

## Phase 3: Frontend Implementation

### Create `AgentProfileImageEditor.tsx` Component
- [x] Create `src/components/agent-edit/AgentProfileImageEditor.tsx`
- [x] Define props (e.g., `agentId`, `currentAvatarUrl`, `onUpdate`)

### Implement Upload Logic
- [x] Add file input JSX (Done in component creation)
- [x] Write validation function (type, size, aspect ratio)
- [x] Implement `supabaseClient.storage.from(...).upload()` call
- [ ] Implement DB update call (via prop/hook) (Handled by parent via onAvatarUpdate)
- [x] Add preview/display logic (Done in component creation)

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