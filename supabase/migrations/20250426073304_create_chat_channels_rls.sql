-- RLS Policies for chat_channels table

-- Helper function is_room_member(room_id, user_id) is assumed to exist.

-- Policy: Allow room members to view channels in their room
CREATE POLICY "Allow room members to view channels"
ON public.chat_channels
FOR SELECT
USING (
    public.is_room_member(room_id, auth.uid())
);

-- Policy: Allow room owner to create channels
CREATE POLICY "Allow room owner to create channels"
ON public.chat_channels
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = chat_channels.room_id -- Use the room_id from the row being inserted
        AND cr.owner_user_id = auth.uid()
    )
);

-- Policy: Allow room owner to update channels
CREATE POLICY "Allow room owner to update channels"
ON public.chat_channels
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = chat_channels.room_id -- Use the room_id from the row being updated
        AND cr.owner_user_id = auth.uid()
    )
);

-- Policy: Allow room owner to delete channels
CREATE POLICY "Allow room owner to delete channels"
ON public.chat_channels
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = chat_channels.room_id -- Use the room_id from the row being deleted
        AND cr.owner_user_id = auth.uid()
    )
); 