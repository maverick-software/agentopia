-- Migration script to create the 'chat_sessions' table

-- Ensure the vector extension is enabled (added in Phase 1)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Create the chat_sessions table
CREATE TABLE public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    session_name text CHECK (char_length(session_name) > 0), -- Optional, but good to have a name
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_message_at timestamp with time zone, -- To be updated by a trigger or application logic
    session_summary_embedding vector(1536) NULL -- Adjust dimension (1536 for text-embedding-3-small) as needed
);

-- Add comments
COMMENT ON TABLE public.chat_sessions IS 'Stores chat sessions associated with teams.';
COMMENT ON COLUMN public.chat_sessions.id IS 'Unique identifier for the chat session.';
COMMENT ON COLUMN public.chat_sessions.team_id IS 'The team this chat session belongs to.';
COMMENT ON COLUMN public.chat_sessions.session_name IS 'User-defined name for the chat session (e.g., project name).';
COMMENT ON COLUMN public.chat_sessions.created_at IS 'Timestamp when the session was created.';
COMMENT ON COLUMN public.chat_sessions.last_message_at IS 'Timestamp of the last message sent in this session (for sorting).';
COMMENT ON COLUMN public.chat_sessions.session_summary_embedding IS 'Optional vector embedding representing the overall topic of the session.';

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_chat_sessions_team_id ON public.chat_sessions(team_id);
CREATE INDEX idx_chat_sessions_last_message_at ON public.chat_sessions(last_message_at DESC NULLS LAST); -- For sorting sessions
