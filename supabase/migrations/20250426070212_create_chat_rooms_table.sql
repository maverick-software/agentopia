-- Migration script to create the 'chat_rooms' table (top-level container)

CREATE TABLE public.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(name) > 0),
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Or restrict? Decide if owner leaving deletes room
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.chat_rooms IS 'Top-level container for chat channels and members, similar to a Discord server.';
COMMENT ON COLUMN public.chat_rooms.id IS 'Unique identifier for the chat room.';
COMMENT ON COLUMN public.chat_rooms.name IS 'User-defined name for the chat room.';
COMMENT ON COLUMN public.chat_rooms.owner_user_id IS 'The user who created and owns the chat room.';
COMMENT ON COLUMN public.chat_rooms.created_at IS 'Timestamp when the chat room was created.';

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_rooms_owner_user_id ON public.chat_rooms(owner_user_id); 