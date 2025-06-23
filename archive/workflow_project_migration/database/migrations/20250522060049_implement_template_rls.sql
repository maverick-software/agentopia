-- supabase/migrations/20250522060049_implement_template_rls.sql

-- Enable RLS and define policies for project_templates
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on project_templates"
ON public.project_templates
FOR ALL
USING (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
WITH CHECK (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()));

CREATE POLICY "Authenticated users can read project_templates"
ON public.project_templates
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable RLS and define policies for project_template_stages
ALTER TABLE public.project_template_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on template_stages"
ON public.project_template_stages
FOR ALL
USING (
    (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())) AND
    EXISTS (
        SELECT 1 FROM public.project_templates pt
        WHERE pt.id = project_template_stages.template_id
    )
)
WITH CHECK (
    (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
);

CREATE POLICY "Authenticated users read template_stages"
ON public.project_template_stages
FOR SELECT
USING (
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM public.project_templates pt
        WHERE pt.id = project_template_stages.template_id
        -- This relies on RLS on project_templates allowing read for the user on pt
    )
);

-- Enable RLS and define policies for project_template_tasks
ALTER TABLE public.project_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on template_tasks"
ON public.project_template_tasks
FOR ALL
USING (
    (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid())) AND
    EXISTS (
        SELECT 1 FROM public.project_template_stages pts
        WHERE pts.id = project_template_tasks.template_stage_id
    )
)
WITH CHECK (
    (ARRAY['SUPER_ADMIN', 'ADMIN'] && get_user_global_role_names(auth.uid()))
);

CREATE POLICY "Authenticated users read template_tasks"
ON public.project_template_tasks
FOR SELECT
USING (
    auth.role() = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM public.project_template_stages pts
        WHERE pts.id = project_template_tasks.template_stage_id
        -- This relies on RLS on project_template_stages allowing read for the user on pts
    )
); 