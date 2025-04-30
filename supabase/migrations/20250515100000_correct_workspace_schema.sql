-- Corrective migration to ensure workspace schema consistency

-- Ensure chat_channels.room_id is renamed to workspace_id
DO $$
BEGIN
  IF EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'chat_channels' AND column_name = 'room_id'
  ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'chat_channels' AND column_name = 'workspace_id'
  ) THEN
      ALTER TABLE public.chat_channels RENAME COLUMN room_id TO workspace_id;
      RAISE NOTICE 'Renamed chat_channels.room_id to workspace_id';
  ELSE
      RAISE NOTICE 'Skipping chat_channels column rename (workspace_id likely already exists or room_id does not)';
  END IF;
END $$;

-- Ensure old chat_room_members table is dropped
DROP TABLE IF EXISTS public.chat_room_members;

-- Optional: Re-assert NOT NULL constraint on workspace_id if needed (might have been lost)
-- ALTER TABLE public.chat_channels ALTER COLUMN workspace_id SET NOT NULL;
-- RAISE NOTICE 'Ensured chat_channels.workspace_id is NOT NULL'; 