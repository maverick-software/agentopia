-- Re-add the functionally required 'active' column to the agents table

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.agents.active IS 'Indicates if the agent is generally considered active/enabled by the user.'; 