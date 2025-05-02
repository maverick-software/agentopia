-- Add context window settings to the workspaces table

-- 1. Add context_window_size column
ALTER TABLE public.workspaces
ADD COLUMN context_window_size INT NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.workspaces.context_window_size IS 'Maximum number of recent messages to include in the context for agents in this workspace.';

-- 2. Add context_window_token_limit column
ALTER TABLE public.workspaces
ADD COLUMN context_window_token_limit INT NOT NULL DEFAULT 8000;

COMMENT ON COLUMN public.workspaces.context_window_token_limit IS 'Maximum number of tokens allowed in the context window sent to agents.';

-- 3. Update RLS policies for workspaces to allow owner update of new columns

-- Drop existing update policy (if it exists)
-- Using DO $$ BEGIN ... END $$ block to handle potential non-existence gracefully.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'workspaces'
          AND policyname = 'Allow owner to update workspace'
    ) THEN
        DROP POLICY "Allow owner to update workspace" ON public.workspaces;
    END IF;
END $$;

-- Recreate update policy, allowing owner to update any owned row
CREATE POLICY "Allow owner to update workspace" ON public.workspaces
  FOR UPDATE
  USING (auth.uid() = owner_user_id) -- Specifies which rows can be updated
  WITH CHECK (auth.uid() = owner_user_id); -- Specifies conditions for the update operation itself
  -- The owner can update any column on rows they own.
  -- Specific column update restrictions would typically be handled
  -- in application logic or via more complex triggers/functions if needed at DB level.


-- Grant execute permission if any new helper functions were created (none in this case)
