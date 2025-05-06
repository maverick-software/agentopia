-- Helper function to check agent ownership
CREATE OR REPLACE FUNCTION public.can_manage_agent(agent_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.agents
    WHERE id = agent_id_param AND user_id = auth.uid() -- Check ownership
  ) INTO is_owner;
  RETURN is_owner;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.can_manage_agent(uuid) TO authenticated;

-- Enable RLS on storage.objects if not already enabled
-- This is often done once per project, check if needed
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they were created manually before (optional, for cleanup)
-- DROP POLICY IF EXISTS "Allow authenticated uploads for owners" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated updates for owners" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated deletes for owners" ON storage.objects;

-- Storage Policies for 'agent-avatars' bucket (PUBLIC)

-- Policy for INSERT (Upload)
CREATE POLICY "Allow authenticated uploads for owners" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'agent-avatars' AND
  owner = auth.uid() AND
  -- Assumes path format like 'public/AGENT_UUID.png' or 'AGENT_UUID.png'
  -- Extract agent_id from the path (assuming it's the first folder or the filename if no folders)
  public.can_manage_agent( COALESCE((storage.foldername(name))[1], storage.filename(name))::uuid )
);

-- Policy for UPDATE (Overwrite)
CREATE POLICY "Allow authenticated updates for owners" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'agent-avatars' AND
  owner = auth.uid() AND
  public.can_manage_agent( COALESCE((storage.foldername(name))[1], storage.filename(name))::uuid )
) 
WITH CHECK (
  bucket_id = 'agent-avatars' AND
  owner = auth.uid() AND
  public.can_manage_agent( COALESCE((storage.foldername(name))[1], storage.filename(name))::uuid )
);

-- Policy for DELETE
CREATE POLICY "Allow authenticated deletes for owners" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'agent-avatars' AND
  owner = auth.uid() AND
  public.can_manage_agent( COALESCE((storage.foldername(name))[1], storage.filename(name))::uuid )
);
