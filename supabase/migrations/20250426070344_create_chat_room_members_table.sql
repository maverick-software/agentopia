-- Migration script to create the 'chat_room_members' table

-- Define allowed member types
CREATE TYPE public.chat_member_type AS ENUM (
    'user',
    'agent',
    'team'
);

-- Create the chat_room_members table
CREATE TABLE public.chat_room_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    member_type public.chat_member_type NOT NULL,
    member_id uuid NOT NULL, -- References auth.users, public.agents, or public.teams depending on member_type
    added_at timestamp with time zone NOT NULL DEFAULT now(),

    -- Ensure a specific user/agent/team can only be added once per room
    CONSTRAINT unique_room_member UNIQUE (room_id, member_type, member_id)
);

-- Add comments
COMMENT ON TABLE public.chat_room_members IS 'Tracks which users, agents, or teams are members of a chat room.';
COMMENT ON COLUMN public.chat_room_members.room_id IS 'The chat room this membership belongs to.';
COMMENT ON COLUMN public.chat_room_members.member_type IS 'The type of member (user, agent, or team).';
COMMENT ON COLUMN public.chat_room_members.member_id IS 'The ID of the user, agent, or team.';
COMMENT ON COLUMN public.chat_room_members.added_at IS 'Timestamp when the member was added.';
COMMENT ON CONSTRAINT unique_room_member ON public.chat_room_members IS 'Ensures a user, agent, or team cannot be added multiple times to the same room.';


-- Enable RLS
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_room_members_room_id ON public.chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_member ON public.chat_room_members(member_type, member_id); -- For finding rooms a specific entity is in 