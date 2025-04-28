# Checklist: Database Refactor - Chat Rooms to Workspaces

This checklist tracks the tasks involved in renaming `chat_rooms` to `workspaces` and related entities.

## Tasks

- [x] Rename `chat_rooms` table to `workspaces`. (Consolidated)
- [x] Rename `room_id` columns to `workspace_id` in related tables (e.g., `chat_channels`). (Consolidated)
- [x] Create `workspace_members` table. (Consolidated)
- [x] Update RLS policies for `workspaces`, `workspace_members`, `chat_channels`, `chat_messages` to use new names and logic. (Consolidated)
- [x] Create helper functions `is_workspace_member` and `can_manage_workspace_members`. (Consolidated)
- [x] Consolidate individual migration steps into `supabase/migrations/20250428180438_remove_team_id_from_workspaces.sql`.
- [x] Delete redundant migration file: `supabase/migrations/20250428182540_rename_chat_rooms_to_workspaces.sql`.
- [x] Delete redundant migration file: `supabase/migrations/20250428184532_rename_channel_room_id_to_workspace_id.sql`.
- [ ] Verify database changes by inspecting the schema directly or via Supabase UI.
- [ ] Test application functionality related to workspaces, channels, and messages to ensure no regressions.
- [ ] Review frontend code (`src/`) for any hardcoded references to `chat_rooms` or `room_id` that need updating to `workspaces` or `workspace_id`.
- [ ] Update `README.md` and any other relevant documentation (`docs/`) to reflect the schema changes. 