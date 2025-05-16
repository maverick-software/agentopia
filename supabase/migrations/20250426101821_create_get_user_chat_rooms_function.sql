-- Function to get basic details of chat rooms a specific user is a member of.
-- Leverages the is_room_member helper function.

CREATE OR REPLACE FUNCTION public.get_user_chat_rooms(p_user_id uuid)
RETURNS SETOF public.chat_rooms -- Returns rows matching the chat_rooms table structure
LANGUAGE sql
STABLE -- Function is read-only
SECURITY DEFINER -- Necessary to potentially call is_room_member which might be SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cr.*
  FROM public.chat_rooms cr
  WHERE public.is_room_member(cr.id, p_user_id); -- Filter rooms using the helper
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_chat_rooms(uuid) TO authenticated; 