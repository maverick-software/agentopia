-- Migration script to create the 'chat_channels' table

CREATE TABLE public.chat_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(name) > 0),
    topic text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_message_at timestamp with time zone -- Can be updated by trigger on chat_messages
);

-- Add comments
COMMENT ON TABLE public.chat_channels IS 'Represents individual channels within a chat room, similar to Discord channels.';
COMMENT ON COLUMN public.chat_channels.id IS 'Unique identifier for the channel.';
COMMENT ON COLUMN public.chat_channels.room_id IS 'The chat room this channel belongs to.';
COMMENT ON COLUMN public.chat_channels.name IS 'Name of the channel (e.g., #general, #random).';
COMMENT ON COLUMN public.chat_channels.topic IS 'Optional topic description for the channel.';
COMMENT ON COLUMN public.chat_channels.created_at IS 'Timestamp when the channel was created.';
COMMENT ON COLUMN public.chat_channels.last_message_at IS 'Timestamp of the last message sent in this channel (for sorting).';

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_channels_room_id ON public.chat_channels(room_id);
CREATE INDEX idx_chat_channels_last_message_at ON public.chat_channels(last_message_at DESC NULLS LAST); 