-- Migration to rename room_id to workspace_id in chat_channels

-- Check if the column exists before trying to rename
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='chat_channels' AND column_name='room_id')
  THEN
    ALTER TABLE public.chat_channels 
    RENAME COLUMN room_id TO workspace_id;

    -- Optional: Add a NOT NULL constraint if it wasn't there before and is desired
    -- ALTER TABLE public.chat_channels
    -- ALTER COLUMN workspace_id SET NOT NULL;

    -- Optional: Ensure Foreign Key constraint points to workspaces.id
    -- Remove old constraint if exists (replace 'chat_channels_room_id_fkey' with actual name)
    -- ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_room_id_fkey;
    -- Add new constraint (replace 'chat_channels_workspace_id_fkey' with desired name)
    -- ALTER TABLE public.chat_channels 
    -- ADD CONSTRAINT chat_channels_workspace_id_fkey 
    -- FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
    RAISE NOTICE 'Renamed room_id to workspace_id on chat_channels.';
  ELSE
    RAISE NOTICE 'Column room_id does not exist on chat_channels, skipping rename.';
  END IF;
END $$; 