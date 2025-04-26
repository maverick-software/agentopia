-- Migration to drop the old chat_sessions table

-- Drop dependent RLS policies/functions first if they exist
DROP POLICY IF EXISTS "Allow team members to read chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow team members to insert chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow team admins/pms to delete chat sessions" ON public.chat_sessions;
DROP FUNCTION IF EXISTS public.get_team_id_for_session(uuid); -- This was likely already dropped by the chat_messages RLS update, but good to be sure.

-- Drop the table itself
DROP TABLE IF EXISTS public.chat_sessions; 