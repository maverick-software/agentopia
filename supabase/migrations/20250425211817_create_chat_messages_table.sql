-- Migration script to create the 'chat_messages' table

-- Ensure the vector extension is enabled (added in Phase 1)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Create the chat_messages table
CREATE TABLE public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL, -- Null if sender is user
    sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Null if sender is agent
    content text NOT NULL CHECK (char_length(content) > 0),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    embedding vector(1536) NULL, -- Dimension matches OpenAI text-embedding-3-small
    metadata jsonb NULL, -- For storing extra info like @mentions { "mentioned_agent_ids": ["uuid1", "uuid2"] }

    -- Constraints
    CONSTRAINT chk_sender_not_null CHECK (sender_agent_id IS NOT NULL OR sender_user_id IS NOT NULL)
);

-- Add comments
COMMENT ON TABLE public.chat_messages IS 'Stores individual messages within chat sessions.';
COMMENT ON COLUMN public.chat_messages.id IS 'Unique identifier for the message.';
COMMENT ON COLUMN public.chat_messages.session_id IS 'The chat session this message belongs to.';
COMMENT ON COLUMN public.chat_messages.sender_agent_id IS 'The agent that sent the message (if applicable).';
COMMENT ON COLUMN public.chat_messages.sender_user_id IS 'The user that sent the message (if applicable).';
COMMENT ON COLUMN public.chat_messages.content IS 'The textual content of the message.';
COMMENT ON COLUMN public.chat_messages.created_at IS 'Timestamp when the message was created.';
COMMENT ON COLUMN public.chat_messages.embedding IS 'Vector embedding of the message content.';
COMMENT ON COLUMN public.chat_messages.metadata IS 'JSONB field for storing arbitrary metadata, e.g., mentions.';

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_messages_session_id_created_at ON public.chat_messages(session_id, created_at ASC); -- Common query pattern
CREATE INDEX idx_chat_messages_sender_agent_id ON public.chat_messages(sender_agent_id);
CREATE INDEX idx_chat_messages_sender_user_id ON public.chat_messages(sender_user_id);

-- Enable Realtime
-- This requires enabling it in the Supabase Dashboard under Database -> Replication as well.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Optional: Trigger to update chat_sessions.last_message_at
CREATE OR REPLACE FUNCTION public.update_session_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_sessions
    SET last_message_at = NEW.created_at
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_session_last_message_at
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_session_last_message_at();
