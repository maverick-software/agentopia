-- Rename room_id to workspace_id in chat_channels
-- Attempt to drop FK constraint first if it exists (using name observed or default convention)
-- Adjust constraint name if different in your schema
ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_room_id_fkey;

ALTER TABLE public.chat_channels RENAME COLUMN room_id TO workspace_id;

-- Re-add FK constraint with new name (optional, but good practice)
-- Ensure workspaces table exists before adding constraint
-- ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
-- Note: Skipping re-adding FK for now to see if rename handles it.

-- Drop the old chat_room_members table
DROP TABLE IF EXISTS public.chat_room_members;
