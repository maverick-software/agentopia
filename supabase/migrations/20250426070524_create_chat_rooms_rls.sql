-- Migration script for chat_rooms RLS policies

-- Helper function to check if a user is a member of a specific room
-- Checks direct user membership AND if the user is part of a team that is a member
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Important for checking tables the user might not have direct access to
SET search_path = public
AS $$
    SELECT EXISTS (
        -- Direct user membership
        SELECT 1
        FROM chat_room_members crm_user
        WHERE crm_user.room_id = p_room_id
          AND crm_user.member_type = 'user'
          AND crm_user.member_id = p_user_id

        UNION ALL

        -- Team membership (user is in a team via user_team_memberships, and that team is in chat_room_members)
        SELECT 1
        FROM chat_room_members crm_team
        JOIN user_team_memberships utm ON crm_team.member_id = utm.team_id -- Join based on team_id
        WHERE crm_team.room_id = p_room_id
          AND crm_team.member_type = 'team' -- Ensure we are looking at a team membership in the room
          AND utm.user_id = p_user_id -- Check if the calling user is in that team
    );
$$;

-- RLS Policies for chat_rooms table

-- Policy: Allow room owner full access
CREATE POLICY "Allow owner full access on chat_rooms"
ON public.chat_rooms
FOR ALL
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Allow room members read access
CREATE POLICY "Allow members read access on chat_rooms"
ON public.chat_rooms
FOR SELECT
USING (public.is_room_member(id, auth.uid())); 