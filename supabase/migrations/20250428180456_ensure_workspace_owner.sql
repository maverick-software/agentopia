-- Add the owner_user_id column if it doesn't exist
ALTER TABLE public.chat_rooms
ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL; -- Review ON DELETE behavior (SET NULL or CASCADE?)

-- No existing workspaces, so no need to update NULLs.

-- Alter the column to be NOT NULL.
ALTER TABLE public.chat_rooms
ALTER COLUMN owner_user_id SET NOT NULL;
