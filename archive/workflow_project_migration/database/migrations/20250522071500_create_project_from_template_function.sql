-- supabase/migrations/20250522071500_create_project_from_template_function.sql

CREATE OR REPLACE FUNCTION public.create_project_from_template(
    p_client_id uuid,
    p_template_id uuid,
    p_project_name text,
    p_created_by_user_id uuid
)
RETURNS uuid -- Returns the id of the newly created project
LANGUAGE plpgsql
SECURITY DEFINER -- Important for permissions to insert into all tables
AS $$
DECLARE
    new_project_id uuid;
    template_stage_record record;
    new_project_stage_id uuid;
    template_task_record record;
BEGIN
    -- 1. Create the new project
    INSERT INTO public.projects (client_id, name, description, template_id, created_by_user_id)
    SELECT p_client_id, p_project_name, pt.description, p_template_id, p_created_by_user_id
    FROM public.project_templates pt
    WHERE pt.id = p_template_id
    RETURNING id INTO new_project_id;

    IF new_project_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create project. Template ID % might be invalid.', p_template_id;
    END IF;

    -- 2. Add the creator as a PROJECT_LEAD to the project_members table
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (new_project_id, p_created_by_user_id, 'PROJECT_LEAD');

    -- 3. Copy stages from the template to the new project
    FOR template_stage_record IN
        SELECT id, name, description, "order"
        FROM public.project_template_stages pts
        WHERE pts.template_id = p_template_id
        ORDER BY pts."order"
    LOOP
        INSERT INTO public.project_stages (project_id, name, description, "order")
        VALUES (new_project_id, template_stage_record.name, template_stage_record.description, template_stage_record."order")
        RETURNING id INTO new_project_stage_id;

        -- 4. For each new stage, copy tasks from the corresponding template stage
        FOR template_task_record IN
            SELECT name, description, default_assigned_role, estimated_hours, "order"
            FROM public.project_template_tasks ptt
            WHERE ptt.template_stage_id = template_stage_record.id
            ORDER BY ptt."order"
        LOOP
            -- Note: default_assigned_role and estimated_hours from template tasks are not directly mapped
            -- to project_tasks table fields in its current schema (A1.6).
            -- project_tasks has assigned_to_user_id, due_date, priority, status.
            -- For now, we'll copy name, description, and order. Status will default to 'To Do'.
            -- Assignee and priority could be set later or based on a more complex logic if needed.
            INSERT INTO public.project_tasks (project_stage_id, name, description, status, "order")
            VALUES (new_project_stage_id, template_task_record.name, template_task_record.description, 'To Do', template_task_record."order");
        END LOOP;
    END LOOP;

    RETURN new_project_id;
END;
$$;

COMMENT ON FUNCTION public.create_project_from_template(uuid, uuid, text, uuid) 
IS 'Creates a new project for a client based on a specified project template. It copies the template''s stages and tasks, and assigns the creator as a project lead.'; 