-- Migration: Create compatibility views for unified workflow
-- Created: 2025-05-25
-- Purpose: Create views to maintain backward compatibility during migration

BEGIN;

-- ============================================================================
-- CREATE COMPATIBILITY VIEWS FOR PROJECT TEMPLATES
-- ============================================================================

-- Create view that maps unified templates to old project_templates structure
CREATE VIEW project_templates_unified_view AS
SELECT 
    id,
    name,
    description,
    created_by as created_by_user_id,
    created_at,
    updated_at
FROM unified_workflow_templates
WHERE template_type IN ('standard', 'hybrid')
AND is_active = true;

-- Create view that maps unified stages to old project_template_stages structure
CREATE VIEW project_template_stages_unified_view AS
SELECT 
    s.id,
    s.template_id,
    s.name,
    s.description,
    s.stage_order as "order",
    s.created_at,
    s.updated_at
FROM unified_workflow_stages s
JOIN unified_workflow_templates t ON s.template_id = t.id
WHERE t.template_type IN ('standard', 'hybrid')
AND t.is_active = true
AND s.client_visible = true;

-- Create view that maps unified tasks to old project_template_tasks structure
CREATE VIEW project_template_tasks_unified_view AS
SELECT 
    tk.id,
    tk.stage_id,
    tk.name,
    tk.description,
    tk.task_order as "order",
    tk.assigned_to as assigned_to_user_id,
    tk.estimated_duration_minutes,
    tk.created_at,
    tk.updated_at
FROM unified_workflow_tasks tk
JOIN unified_workflow_stages s ON tk.stage_id = s.id
JOIN unified_workflow_templates t ON s.template_id = t.id
WHERE t.template_type IN ('standard', 'hybrid')
AND t.is_active = true
AND tk.client_visible = false; -- Tasks are typically internal

-- ============================================================================
-- CREATE COMPATIBILITY VIEWS FOR PROJECT FLOWS
-- ============================================================================

-- Create view that maps unified templates to old project_flows structure
CREATE VIEW project_flows_unified_view AS
SELECT 
    id,
    name,
    description,
    is_active,
    estimated_duration_minutes,
    icon,
    color,
    0 as sort_order, -- Default sort order
    created_by as created_by_user_id,
    created_at,
    updated_at,
    requires_products_services,
    true as requires_template_selection, -- Default to true for flow-based
    auto_create_project
FROM unified_workflow_templates
WHERE template_type IN ('flow_based', 'hybrid')
AND is_active = true;

-- Create view that maps unified steps to old project_flow_steps structure
CREATE VIEW project_flow_steps_unified_view AS
SELECT 
    st.id,
    t.id as flow_id,
    st.name,
    st.description,
    ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY s.stage_order, tk.task_order, st.step_order) as step_number,
    st.is_required,
    st.allow_skip,
    st.show_progress,
    st.auto_advance,
    st.condition_logic,
    st.created_at,
    st.updated_at
FROM unified_workflow_steps st
JOIN unified_workflow_tasks tk ON st.task_id = tk.id
JOIN unified_workflow_stages s ON tk.stage_id = s.id
JOIN unified_workflow_templates t ON s.template_id = t.id
WHERE t.template_type IN ('flow_based', 'hybrid')
AND t.is_active = true
AND st.client_visible = true;

-- Create view that maps unified elements to old project_flow_elements structure
CREATE VIEW project_flow_elements_unified_view AS
SELECT 
    e.id,
    st.id as step_id,
    e.element_type,
    e.element_key,
    e.label,
    e.placeholder,
    e.help_text,
    e.element_order,
    e.config,
    e.is_required,
    e.validation_rules,
    e.condition_logic,
    e.created_at,
    e.updated_at
FROM unified_workflow_elements e
JOIN unified_workflow_steps st ON e.step_id = st.id
JOIN unified_workflow_tasks tk ON st.task_id = tk.id
JOIN unified_workflow_stages s ON tk.stage_id = s.id
JOIN unified_workflow_templates t ON s.template_id = t.id
WHERE t.template_type IN ('flow_based', 'hybrid')
AND t.is_active = true
AND e.client_visible = true;

-- Create view that maps unified instances to old project_flow_instances structure
CREATE VIEW project_flow_instances_unified_view AS
SELECT 
    i.id,
    i.template_id as flow_id,
    i.assigned_to as user_id,
    i.client_id,
    i.status,
    i.current_step_id,
    -- Calculate current step number
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY s.stage_order, tk.task_order, st.step_order)
        FROM unified_workflow_steps st
        JOIN unified_workflow_tasks tk ON st.task_id = tk.id
        JOIN unified_workflow_stages s ON tk.stage_id = s.id
        JOIN unified_workflow_templates t ON s.template_id = t.id
        WHERE st.id = i.current_step_id
        AND t.id = i.template_id
    ) as current_step_number,
    '[]'::jsonb as completed_steps, -- Will be populated by migration
    i.started_at,
    i.completed_at,
    i.updated_at as last_activity_at,
    i.project_id as created_project_id,
    null as error_message,
    i.instance_data as metadata
FROM unified_workflow_instances i
JOIN unified_workflow_templates t ON i.template_id = t.id
WHERE t.template_type IN ('flow_based', 'hybrid');

-- Create view that maps unified step data to old project_flow_step_data structure
CREATE VIEW project_flow_step_data_unified_view AS
SELECT 
    sd.id,
    sd.instance_id,
    sd.step_id,
    sd.element_key,
    sd.element_value as data_value,
    sd.data_type,
    sd.is_valid,
    COALESCE(array_to_json(sd.validation_errors), '[]'::json)::jsonb as validation_errors,
    sd.created_at,
    sd.updated_at
FROM unified_workflow_step_data sd
JOIN unified_workflow_instances i ON sd.instance_id = i.id
JOIN unified_workflow_templates t ON i.template_id = t.id
WHERE t.template_type IN ('flow_based', 'hybrid');

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR COMPATIBILITY
-- ============================================================================

-- Function to get template type for backward compatibility
CREATE OR REPLACE FUNCTION get_template_type(template_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT template_type 
        FROM unified_workflow_templates 
        WHERE id = template_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert unified workflow to project template format
CREATE OR REPLACE FUNCTION get_project_template_with_stages_tasks(input_template_id UUID)    
RETURNS TABLE (
    template_id UUID,
    template_name TEXT,
    template_description TEXT,
    stages JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as template_id,
        t.name as template_name,
        t.description as template_description,
        jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', s.description,
                'order', s.stage_order,
                'tasks', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', tk.id,
                            'name', tk.name,
                            'description', tk.description,
                            'order', tk.task_order,
                            'assigned_to_user_id', tk.assigned_to,
                            'estimated_duration_minutes', tk.estimated_duration_minutes
                        ) ORDER BY tk.task_order
                    )
                    FROM unified_workflow_tasks tk
                    WHERE tk.stage_id = s.id
                    AND tk.client_visible = false
                )
            ) ORDER BY s.stage_order
        ) as stages
    FROM unified_workflow_templates t
    JOIN unified_workflow_stages s ON t.id = s.template_id
    WHERE t.id = input_template_id
    AND t.template_type IN ('standard', 'hybrid')
    AND t.is_active = true
    GROUP BY t.id, t.name, t.description;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert unified workflow to project flow format
CREATE OR REPLACE FUNCTION get_project_flow_with_steps_elements(input_flow_id UUID)
RETURNS TABLE (
    flow_id UUID,
    flow_name TEXT,
    flow_description TEXT,
    steps JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as flow_id,
        t.name as flow_name,
        t.description as flow_description,
        jsonb_agg(
            jsonb_build_object(
                'id', st.id,
                'name', st.name,
                'description', st.description,
                'step_number', ROW_NUMBER() OVER (ORDER BY s.stage_order, tk.task_order, st.step_order),
                'is_required', st.is_required,
                'allow_skip', st.allow_skip,
                'show_progress', st.show_progress,
                'auto_advance', st.auto_advance,
                'elements', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', e.id,
                            'element_type', e.element_type,
                            'element_key', e.element_key,
                            'label', e.label,
                            'placeholder', e.placeholder,
                            'help_text', e.help_text,
                            'element_order', e.element_order,
                            'config', e.config,
                            'is_required', e.is_required,
                            'validation_rules', e.validation_rules,
                            'condition_logic', e.condition_logic
                        ) ORDER BY e.element_order
                    )
                    FROM unified_workflow_elements e
                    WHERE e.step_id = st.id
                    AND e.client_visible = true
                )
            ) ORDER BY s.stage_order, tk.task_order, st.step_order
        ) as steps
    FROM unified_workflow_templates t
    JOIN unified_workflow_stages s ON t.id = s.template_id
    JOIN unified_workflow_tasks tk ON s.id = tk.stage_id
    JOIN unified_workflow_steps st ON tk.id = st.task_id
    WHERE t.id = input_flow_id
    AND t.template_type IN ('flow_based', 'hybrid')
    AND t.is_active = true
    AND st.client_visible = true
    GROUP BY t.id, t.name, t.description;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS FOR COMPATIBILITY
-- ============================================================================

-- Trigger to handle updated_at for compatibility views
CREATE OR REPLACE FUNCTION handle_unified_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to unified workflow tables
CREATE TRIGGER handle_unified_workflow_templates_updated_at
    BEFORE UPDATE ON unified_workflow_templates
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_stages_updated_at
    BEFORE UPDATE ON unified_workflow_stages
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_tasks_updated_at
    BEFORE UPDATE ON unified_workflow_tasks
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_steps_updated_at
    BEFORE UPDATE ON unified_workflow_steps
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_elements_updated_at
    BEFORE UPDATE ON unified_workflow_elements
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_instances_updated_at
    BEFORE UPDATE ON unified_workflow_instances
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

CREATE TRIGGER handle_unified_workflow_step_data_updated_at
    BEFORE UPDATE ON unified_workflow_step_data
    FOR EACH ROW EXECUTE FUNCTION handle_unified_workflow_updated_at();

-- ============================================================================
-- ADD COMMENTS TO COMPATIBILITY VIEWS
-- ============================================================================

COMMENT ON VIEW project_templates_unified_view IS 'Compatibility view mapping unified workflow templates to legacy project_templates structure';
COMMENT ON VIEW project_template_stages_unified_view IS 'Compatibility view mapping unified workflow stages to legacy project_template_stages structure';
COMMENT ON VIEW project_template_tasks_unified_view IS 'Compatibility view mapping unified workflow tasks to legacy project_template_tasks structure';
COMMENT ON VIEW project_flows_unified_view IS 'Compatibility view mapping unified workflow templates to legacy project_flows structure';
COMMENT ON VIEW project_flow_steps_unified_view IS 'Compatibility view mapping unified workflow steps to legacy project_flow_steps structure';
COMMENT ON VIEW project_flow_elements_unified_view IS 'Compatibility view mapping unified workflow elements to legacy project_flow_elements structure';
COMMENT ON VIEW project_flow_instances_unified_view IS 'Compatibility view mapping unified workflow instances to legacy project_flow_instances structure';
COMMENT ON VIEW project_flow_step_data_unified_view IS 'Compatibility view mapping unified workflow step data to legacy project_flow_step_data structure';

-- ============================================================================
-- LOG COMPATIBILITY VIEWS CREATION
-- ============================================================================

-- Log compatibility views creation completion
INSERT INTO unified_workflow_migration_log (migration_step, status, notes) 
VALUES (
    'create_compatibility_views',
    'completed',
    'Successfully created compatibility views and helper functions for backward compatibility during migration'
);

COMMIT; 