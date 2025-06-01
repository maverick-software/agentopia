-- supabase/migrations/20250522060123_create_duplicate_template_function.sql

CREATE OR REPLACE FUNCTION public.duplicate_project_template(
    original_template_id uuid,
    new_template_name text,
    new_created_by_user_id uuid
)
RETURNS uuid -- The ID of the new project template
LANGUAGE plpgsql
SECURITY DEFINER -- Important: runs with permissions of the function owner (usually superuser)
AS $$
DECLARE
    new_template_id uuid;
    original_stage record;
    new_stage_id uuid;
    original_task record;
BEGIN
    -- 1. Create the new project template
    INSERT INTO public.project_templates (name, description, created_by_user_id)
    SELECT
        COALESCE(new_template_name, 'Copy of ' || pt.name),
        pt.description,
        new_created_by_user_id
    FROM public.project_templates pt
    WHERE pt.id = original_template_id
    RETURNING id INTO new_template_id;

    IF new_template_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create new project template. Original template ID % not found or insert failed.', original_template_id;
    END IF;

    -- 2. Loop through the original template's stages and duplicate them
    FOR original_stage IN
        SELECT * FROM public.project_template_stages pts
        WHERE pts.template_id = original_template_id
        ORDER BY pts."order"
    LOOP
        INSERT INTO public.project_template_stages (template_id, name, description, "order")
        VALUES (new_template_id, original_stage.name, original_stage.description, original_stage."order")
        RETURNING id INTO new_stage_id;

        IF new_stage_id IS NULL THEN
            RAISE EXCEPTION 'Failed to create new stage for template ID % (original stage ID %).', new_template_id, original_stage.id;
        END IF;

        -- 3. Loop through the original stage's tasks and duplicate them for the new stage
        FOR original_task IN
            SELECT * FROM public.project_template_tasks ptt
            WHERE ptt.template_stage_id = original_stage.id
            ORDER BY ptt."order"
        LOOP
            INSERT INTO public.project_template_tasks (template_stage_id, name, description, default_assignee_role, estimated_duration_hours, "order")
            VALUES (new_stage_id, original_task.name, original_task.description, original_task.default_assignee_role, original_task.estimated_duration_hours, original_task."order");
        END LOOP;
    END LOOP;

    RETURN new_template_id;
END;
$$;

COMMENT ON FUNCTION public.duplicate_project_template(uuid, text, uuid) 
IS 'Duplicates an existing project template, including its stages and tasks. If new_template_name is NULL, it defaults to "Copy of [original_name]".'; 