-- RLS Policies for user_team_memberships table

-- Policy: Allow users to view their own memberships
CREATE POLICY "Allow users to view own memberships"
ON public.user_team_memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Allow users to add themselves to a team
CREATE POLICY "Allow users to add themselves to teams"
ON public.user_team_memberships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to remove themselves from a team
CREATE POLICY "Allow users to remove themselves from teams"
ON public.user_team_memberships
FOR DELETE
USING (auth.uid() = user_id); 