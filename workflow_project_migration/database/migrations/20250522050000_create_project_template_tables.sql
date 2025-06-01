-- supabase/migrations/20250522050000_create_project_template_tables.sql

-- Create project_templates table
CREATE TABLE public.project_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_templates_pkey PRIMARY KEY (id),
    CONSTRAINT project_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.project_templates IS 'Stores reusable project templates, including their stages and tasks, to bootstrap new projects.';
COMMENT ON COLUMN public.project_templates.name IS 'User-defined name for the project template.';
COMMENT ON COLUMN public.project_templates.description IS 'Optional detailed description of the project template.';
COMMENT ON COLUMN public.project_templates.created_by_user_id IS 'The user who originally created this template.';

CREATE INDEX idx_project_templates_created_by_user_id ON public.project_templates USING btree (created_by_user_id);

-- Assume handle_updated_at function already exists from previous migrations.
-- If not, it should be created in an earlier migration:
-- CREATE OR REPLACE FUNCTION public.handle_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

CREATE TRIGGER handle_project_templates_updated_at
BEFORE UPDATE ON public.project_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create project_template_stages table
CREATE TABLE public.project_template_stages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    name text NOT NULL,
    description text NULL,
    "order" integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_template_stages_pkey PRIMARY KEY (id),
    CONSTRAINT project_template_stages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.project_templates(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.project_template_stages IS 'Defines the stages (e.g., columns in a Kanban board) for a project template.';
COMMENT ON COLUMN public.project_template_stages.template_id IS 'The project template this stage belongs to.';
COMMENT ON COLUMN public.project_template_stages.name IS 'Name of the stage (e.g., "To Do", "In Progress").';
COMMENT ON COLUMN public.project_template_stages."order" IS 'Defines the display order of stages within a template.';

CREATE INDEX idx_project_template_stages_template_id ON public.project_template_stages USING btree (template_id);
CREATE INDEX idx_project_template_stages_order ON public.project_template_stages USING btree ("order");

CREATE TRIGGER handle_project_template_stages_updated_at
BEFORE UPDATE ON public.project_template_stages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create project_template_tasks table
CREATE TABLE public.project_template_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_stage_id uuid NOT NULL,
    name text NOT NULL,
    description text NULL,
    default_assignee_role text NULL,
    estimated_duration_hours numeric(5,2) NULL,
    "order" integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_template_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT project_template_tasks_template_stage_id_fkey FOREIGN KEY (template_stage_id) REFERENCES public.project_template_stages(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.project_template_tasks IS 'Defines default tasks for a stage within a project template.';
COMMENT ON COLUMN public.project_template_tasks.template_stage_id IS 'The project template stage this task belongs to.';
COMMENT ON COLUMN public.project_template_tasks.name IS 'Name of the default task.';
COMMENT ON COLUMN public.project_template_tasks.default_assignee_role IS 'Suggested role for who typically handles this task (e.g., "Developer").';
COMMENT ON COLUMN public.project_template_tasks.estimated_duration_hours IS 'Estimated time in hours to complete this task.';
COMMENT ON COLUMN public.project_template_tasks."order" IS 'Defines the display order of tasks within a template stage.';

CREATE INDEX idx_project_template_tasks_template_stage_id ON public.project_template_tasks USING btree (template_stage_id);
CREATE INDEX idx_project_template_tasks_order ON public.project_template_tasks USING btree ("order");

CREATE TRIGGER handle_project_template_tasks_updated_at
BEFORE UPDATE ON public.project_template_tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at(); 