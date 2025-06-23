-- supabase/migrations/20250522070000_setup_project_core_tables_and_rls.sql

-- Create ENUM type for project member roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_member_role_enum') THEN
        CREATE TYPE public.project_member_role_enum AS ENUM ('PROJECT_LEAD', 'PROJECT_EDITOR', 'PROJECT_VIEWER');
    END IF;
END$$;

-- Modify existing projects table
-- Based on docs/research_findings/A1.4_projects_table_modifications_findings.md

-- Add description column if it doesn't exist
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description text NULL;
COMMENT ON COLUMN public.projects.description IS 'Optional detailed description of the project.';

-- Add template_id column if it doesn't exist and its foreign key
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS template_id uuid NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_template_id_fkey' AND table_name = 'projects'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE SET NULL;
    END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON public.projects USING btree (template_id);
COMMENT ON COLUMN public.projects.template_id IS 'The template used to bootstrap this project, if any.';

-- Ensure client_id is NOT NULL and has FK (assuming it exists and is correctly typed as uuid)
ALTER TABLE public.projects ALTER COLUMN client_id SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_client_id_fkey' AND table_name = 'projects'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
END$$;

-- Drop deprecated columns
ALTER TABLE public.projects DROP COLUMN IF EXISTS current_phase;
ALTER TABLE public.projects DROP COLUMN IF EXISTS current_step;
ALTER TABLE public.projects DROP COLUMN IF EXISTS wordpress_url;

-- Handle created_by_user_id column: rename if exists as 'created_by', ensure type, add FK and Index.
DO $$
BEGIN
    -- Check if 'created_by' column exists and 'created_by_user_id' does not
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_by') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_by_user_id') THEN
        ALTER TABLE public.projects RENAME COLUMN created_by TO created_by_user_id;
    END IF;
END$$;

-- Ensure created_by_user_id is UUID. This assumes it might be text and tries to cast.
-- This is a potentially DANGEROUS operation if data cannot be cast. Backup recommended before running this in production.
-- For development, if it fails, the column type needs manual inspection and correction.
ALTER TABLE public.projects
    ALTER COLUMN created_by_user_id TYPE uuid USING created_by_user_id::uuid;

-- Ensure created_by_user_id Foreign Key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'projects_created_by_user_id_fkey' AND table_name = 'projects'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns -- Re-check existence of correctly named column
        WHERE table_name = 'projects' AND column_name = 'created_by_user_id'
    ) THEN
        ALTER TABLE public.projects 
            ADD CONSTRAINT projects_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_projects_created_by_user_id ON public.projects USING btree (created_by_user_id);

-- Ensure updated_at trigger exists for projects table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_projects_updated_at' AND tgrelid = 'public.projects'::regclass) THEN
        CREATE TRIGGER handle_projects_updated_at
        BEFORE UPDATE ON public.projects
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END$$;

-- Create project_stages table
-- Based on docs/research_findings/A1.5_project_stages_table_design_findings.md
CREATE TABLE public.project_stages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text NULL,
    "order" integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_stages_pkey PRIMARY KEY (id),
    CONSTRAINT project_stages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.project_stages IS 'Defines the actual stages for a client project.';
COMMENT ON COLUMN public.project_stages.project_id IS 'The client project this stage belongs to.';
COMMENT ON COLUMN public.project_stages.name IS 'Name of the project stage.';
COMMENT ON COLUMN public.project_stages."order" IS 'Defines the display order of stages within the project.';

CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON public.project_stages USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_order ON public.project_stages USING btree ("order");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_project_stages_updated_at' AND tgrelid = 'public.project_stages'::regclass) THEN
        CREATE TRIGGER handle_project_stages_updated_at
        BEFORE UPDATE ON public.project_stages
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END$$;

-- Create project_tasks table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_stage_id uuid NOT NULL,
    name text NOT NULL,
    description text NULL,
    status text NOT NULL DEFAULT 'To Do',
    assigned_to_user_id uuid NULL,
    due_date timestamptz NULL,
    priority text NULL DEFAULT 'Medium',
    "order" integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT project_tasks_project_stage_id_fkey FOREIGN KEY (project_stage_id) REFERENCES public.project_stages(id) ON DELETE CASCADE,
    CONSTRAINT project_tasks_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.project_tasks IS 'Stores individual tasks for a project stage.';
COMMENT ON COLUMN public.project_tasks.status IS 'Current status of the task.';
COMMENT ON COLUMN public.project_tasks.assigned_to_user_id IS 'The user assigned to this task.';
COMMENT ON COLUMN public.project_tasks.due_date IS 'Optional due date for the task.';
COMMENT ON COLUMN public.project_tasks.priority IS 'Priority level of the task.';
COMMENT ON COLUMN public.project_tasks."order" IS 'Defines the display order of tasks within a project stage.';

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_stage_id ON public.project_tasks USING btree (project_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to_user_id ON public.project_tasks USING btree (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON public.project_tasks USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_order ON public.project_tasks USING btree ("order");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_project_tasks_updated_at' AND tgrelid = 'public.project_tasks'::regclass) THEN
        CREATE TRIGGER handle_project_tasks_updated_at
        BEFORE UPDATE ON public.project_tasks
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END$$;

-- Create project_members table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.project_member_role_enum NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_members_pkey PRIMARY KEY (id),
    CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT project_members_unique UNIQUE (project_id, user_id)
);

COMMENT ON TABLE public.project_members IS 'Links users to projects with a specific project-level role.';
COMMENT ON COLUMN public.project_members.role IS 'Role of the user within the project (LEAD, EDITOR, VIEWER).';

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members USING btree (user_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_project_members_updated_at' AND tgrelid = 'public.project_members'::regclass) THEN
        CREATE TRIGGER handle_project_members_updated_at
        BEFORE UPDATE ON public.project_members
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END$$;

--------------------------------------------------------------------------------
-- RLS Policies
--------------------------------------------------------------------------------

-- RLS for projects table (A1.4)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on projects"
ON public.projects
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

-- Policy for project members to access projects
-- This policy allows any member of a project to view it.
-- For INSERT, UPDATE, DELETE, it relies on project leads having broader permissions via project_members table RLS.
-- This approach simplifies project creation (user creates project, becomes member, then can manage based on project_members RLS)
-- More specific client-level permissions (e.g., check_user_has_client_project_permission) are deferred as they require a helper not yet defined.
CREATE POLICY "Project members can access their projects"
ON public.projects
FOR ALL -- More granular SELECT/UPDATE/DELETE can be done if needed, but relying on project_members for write control
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS ( -- For create/update, user must be a project_lead of that project
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id 
          AND pm.user_id = auth.uid()
          AND pm.role = 'PROJECT_LEAD' -- Only project leads can create/update project details directly on this table
    ) OR ( -- For initial creation, allow if user creating is the one listed in created_by_user_id, then they should be added as PROJECT_LEAD member
        projects.created_by_user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = projects.id)
    )
);


-- RLS for project_stages table (A1.5)
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on project_stages"
ON public.project_stages
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

CREATE POLICY "Project members access to project_stages"
ON public.project_stages
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_stages.project_id
          AND pm.user_id = auth.uid()
        -- For SELECT, any role is fine.
        -- For INSERT/UPDATE/DELETE, specific roles are checked in WITH CHECK.
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_stages.project_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('PROJECT_LEAD', 'PROJECT_EDITOR') -- Only leads/editors can create/modify/delete stages
    )
);

-- RLS for project_tasks table (A1.6)
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on project_tasks"
ON public.project_tasks
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

CREATE POLICY "Project members can view project_tasks"
ON public.project_tasks
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.project_stages ps ON pm.project_id = ps.project_id
        WHERE ps.id = project_tasks.project_stage_id
          AND pm.user_id = auth.uid()
        -- Any project member role can view tasks
    )
);

CREATE POLICY "Project editors_leads can insert project_tasks"
ON public.project_tasks
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.project_stages ps ON pm.project_id = ps.project_id
        WHERE ps.id = project_tasks.project_stage_id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('PROJECT_EDITOR', 'PROJECT_LEAD')
    )
);

CREATE POLICY "Project editors_leads_assignees can update project_tasks"
ON public.project_tasks
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.project_stages ps ON pm.project_id = ps.project_id
        WHERE ps.id = project_tasks.project_stage_id
          AND pm.user_id = auth.uid()
          AND (
            pm.role IN ('PROJECT_EDITOR', 'PROJECT_LEAD') OR
            project_tasks.assigned_to_user_id = auth.uid() -- Allow assignee to update
          )
    )
)
WITH CHECK ( -- Ensure the user modifying has edit rights or is the assignee
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.project_stages ps ON pm.project_id = ps.project_id
        WHERE ps.id = project_tasks.project_stage_id
          AND pm.user_id = auth.uid()
          AND (
            pm.role IN ('PROJECT_EDITOR', 'PROJECT_LEAD') OR
            project_tasks.assigned_to_user_id = auth.uid() -- Corrected: Assignee can update if they are the assignee
          )
    )
);


CREATE POLICY "Project leads can delete project_tasks"
ON public.project_tasks
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.project_members pm
        JOIN public.project_stages ps ON pm.project_id = ps.project_id
        WHERE ps.id = project_tasks.project_stage_id
          AND pm.user_id = auth.uid()
          AND pm.role = 'PROJECT_LEAD'
    )
);

-- RLS for project_members table (A1.7)
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on project_members"
ON public.project_members
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

CREATE POLICY "Project leads can manage project_members"
ON public.project_members
FOR ALL -- Allows SELECT, INSERT, UPDATE, DELETE for leads
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm_lead
        WHERE pm_lead.project_id = project_members.project_id -- The project_id of the row being accessed/modified
          AND pm_lead.user_id = auth.uid()
          AND pm_lead.role = 'PROJECT_LEAD'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_members pm_lead
        WHERE pm_lead.project_id = project_members.project_id
          AND pm_lead.user_id = auth.uid()
          AND pm_lead.role = 'PROJECT_LEAD'
    )
);

CREATE POLICY "Project members can view other project_members"
ON public.project_members
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm_viewer
        WHERE pm_viewer.project_id = project_members.project_id
          AND pm_viewer.user_id = auth.uid()
    )
); 