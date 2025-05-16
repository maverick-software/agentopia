-- RLS Policies for chat_room_members table

-- Helper function is_room_member(room_id, user_id) is assumed to exist from chat_rooms RLS.

-- Policy: Allow members to view other members of the same room
CREATE POLICY "Allow members to view other room members"
ON public.chat_room_members
FOR SELECT
USING (
    public.is_room_member(room_id, auth.uid())
);

-- Policy: Allow room owner to add members
CREATE POLICY "Allow room owner to add members"
ON public.chat_room_members
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = chat_room_members.room_id -- Use the room_id from the row being inserted
        AND cr.owner_user_id = auth.uid()
    )
);

-- Policy: Allow room owner to remove members
CREATE POLICY "Allow room owner to remove members"
ON public.chat_room_members
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = chat_room_members.room_id -- Use the room_id from the row being deleted
        AND cr.owner_user_id = auth.uid()
    )
); 