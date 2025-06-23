-- Create target_audiences table
CREATE TABLE IF NOT EXISTS public.target_audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_icp BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    demographics JSONB DEFAULT '{}'::jsonb,
    psychographics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.target_audiences IS 'Stores target audience profiles for clients, including ICP and brand avatars.';
COMMENT ON COLUMN public.target_audiences.is_icp IS 'Flags if this audience is the Ideal Customer Profile.';
COMMENT ON COLUMN public.target_audiences.avatar_url IS 'URL for the representative avatar image.';
COMMENT ON COLUMN public.target_audiences.demographics IS 'Demographic information for the audience.';
COMMENT ON COLUMN public.target_audiences.psychographics IS 'Psychographic information for the audience.';

-- Enable RLS
ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_target_audiences_updated_at ON public.target_audiences;
CREATE TRIGGER handle_target_audiences_updated_at
BEFORE UPDATE ON public.target_audiences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column(); -- Assuming this function already exists

-- RLS Policies
-- Users can view audiences for clients they can view.
CREATE POLICY "Users can view target audiences for accessible clients"
ON public.target_audiences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = target_audiences.client_id
    -- Replicates the SELECT RLS from the clients table:
    AND (
      auth.uid() = c.created_by OR
      c.id IN (
        SELECT p.client_id
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = auth.uid()
      )
    )
  )
);

-- Users can insert audiences for clients they created.
CREATE POLICY "Users can insert target audiences for their clients"
ON public.target_audiences
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = target_audiences.client_id AND auth.uid() = c.created_by
  )
);

-- Users can update audiences for clients they created.
CREATE POLICY "Users can update target audiences for their clients"
ON public.target_audiences
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = target_audiences.client_id AND auth.uid() = c.created_by
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = target_audiences.client_id AND auth.uid() = c.created_by
  )
);

-- Users can delete audiences for clients they created.
CREATE POLICY "Users can delete target audiences for their clients"
ON public.target_audiences
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = target_audiences.client_id AND auth.uid() = c.created_by
  )
);
