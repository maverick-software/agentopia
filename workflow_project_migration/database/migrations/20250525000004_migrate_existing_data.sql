-- Migration: Migrate existing data to unified workflow architecture
-- Created: 2025-05-25
-- Purpose: Execute data migration from templates and flows to unified structure

BEGIN;

-- ============================================================================
-- PHASE 1: MIGRATE PROJECT TEMPLATES SYSTEM
-- ============================================================================

-- 1.1 Migrate project_templates to unified_workflow_templates
INSERT INTO unified_workflow_templates (
    id,
    name,
    description,
    template_type,
    client_visible,
    is_active,
    is_published,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pt.id,
    pt.name,
    pt.description,
    'standard' as template_type,
    true as client_visible,
    true as is_active,
    true as is_published,
    pt.created_at,
    pt.updated_at,
    pt.created_by_user_id as created_by,
    pt.created_by_user_id as updated_by
FROM project_templates pt
WHERE NOT EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pt.id
);

-- 1.2 Migrate project_template_stages to unified_workflow_stages
INSERT INTO unified_workflow_stages (
    id,
    template_id,
    name,
    description,
    stage_order,
    is_required,
    client_visible,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pts.id,
    pts.template_id,
    pts.name,
    pts.description,
    ROW_NUMBER() OVER (PARTITION BY pts.template_id ORDER BY CASE WHEN pts."order" <= 0 THEN 1 ELSE pts."order" END, pts.created_at) as stage_order,
    true as is_required,
    true as client_visible,
    pts.created_at,
    pts.updated_at,
    (SELECT created_by FROM unified_workflow_templates WHERE id = pts.template_id) as created_by,
    (SELECT updated_by FROM unified_workflow_templates WHERE id = pts.template_id) as updated_by
FROM project_template_stages pts
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pts.template_id
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_stages uws 
    WHERE uws.id = pts.id
);

-- 1.3 Migrate project_template_tasks to unified_workflow_tasks
INSERT INTO unified_workflow_tasks (
    id,
    stage_id,
    name,
    description,
    task_order,
    task_type,
    is_required,
    assigned_to,
    estimated_duration_minutes,
    client_visible,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    ptt.id,
    ptt.template_stage_id as stage_id,
    ptt.name,
    ptt.description,
    ROW_NUMBER() OVER (PARTITION BY ptt.template_stage_id ORDER BY CASE WHEN ptt."order" <= 0 THEN 1 ELSE ptt."order" END, ptt.created_at) as task_order,
    'standard' as task_type,
    true as is_required,
    ptt.assignee_member_id as assigned_to,
    CASE 
        WHEN ptt.estimated_duration_hours IS NOT NULL 
        THEN (ptt.estimated_duration_hours * 60)::integer 
        ELSE NULL 
    END as estimated_duration_minutes,
    false as client_visible, -- Tasks are typically internal
    ptt.created_at,
    ptt.updated_at,
    (SELECT created_by FROM unified_workflow_stages WHERE id = ptt.template_stage_id) as created_by,
    (SELECT updated_by FROM unified_workflow_stages WHERE id = ptt.template_stage_id) as updated_by
FROM project_template_tasks ptt
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_stages uws 
    WHERE uws.id = ptt.template_stage_id
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_tasks uwt 
    WHERE uwt.id = ptt.id
);

-- ============================================================================
-- PHASE 2: MIGRATE PROJECT FLOWS SYSTEM
-- ============================================================================

-- 2.1 Migrate project_flows to unified_workflow_templates
INSERT INTO unified_workflow_templates (
    id,
    name,
    description,
    template_type,
    icon,
    color,
    requires_products_services,
    auto_create_project,
    estimated_duration_minutes,
    client_visible,
    is_active,
    is_published,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pf.id,
    pf.name,
    pf.description,
    'flow_based' as template_type,
    pf.icon,
    pf.color,
    pf.requires_products_services,
    pf.auto_create_project,
    pf.estimated_duration_minutes,
    true as client_visible,
    pf.is_active,
    pf.is_active as is_published, -- Assume active flows are published
    pf.created_at,
    pf.updated_at,
    pf.created_by_user_id as created_by,
    pf.created_by_user_id as updated_by
FROM project_flows pf
WHERE NOT EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pf.id
);

-- 2.2 Create default stage for each flow to contain the steps
INSERT INTO unified_workflow_stages (
    id,
    template_id,
    name,
    description,
    stage_order,
    is_required,
    client_visible,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    gen_random_uuid() as id,
    pf.id as template_id,
    'Flow Execution' as name,
    'Main execution stage for ' || pf.name as description,
    1 as stage_order,
    true as is_required,
    true as client_visible,
    pf.created_at,
    pf.updated_at,
    pf.created_by_user_id as created_by,
    pf.created_by_user_id as updated_by
FROM project_flows pf
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pf.id AND uwt.template_type = 'flow_based'
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_stages uws 
    WHERE uws.template_id = pf.id
);

-- 2.3 Create default task for each flow stage to contain the steps
INSERT INTO unified_workflow_tasks (
    id,
    stage_id,
    name,
    description,
    task_order,
    task_type,
    is_required,
    client_visible,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    gen_random_uuid() as id,
    uws.id as stage_id,
    'Flow Steps' as name,
    'Container task for flow steps' as description,
    1 as task_order,
    'standard' as task_type,
    true as is_required,
    true as client_visible,
    uws.created_at,
    uws.updated_at,
    uws.created_by,
    uws.updated_by
FROM unified_workflow_stages uws
JOIN unified_workflow_templates uwt ON uws.template_id = uwt.id
WHERE uwt.template_type = 'flow_based'
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_tasks uwt_task 
    WHERE uwt_task.stage_id = uws.id
);

-- 2.4 Migrate project_flow_steps to unified_workflow_steps
INSERT INTO unified_workflow_steps (
    id,
    task_id,
    name,
    description,
    step_order,
    step_type,
    is_required,
    allow_skip,
    auto_advance,
    show_progress,
    client_visible,
    condition_logic,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pfs.id,
    uwt_task.id as task_id,
    pfs.name,
    pfs.description,
    ROW_NUMBER() OVER (PARTITION BY uwt_task.id ORDER BY CASE WHEN pfs.step_number <= 0 THEN 1 ELSE pfs.step_number END, pfs.created_at) as step_order,
    'form' as step_type,
    pfs.is_required,
    pfs.allow_skip,
    pfs.auto_advance,
    pfs.show_progress,
    true as client_visible,
    pfs.condition_logic,
    pfs.created_at,
    pfs.updated_at,
    (SELECT created_by FROM unified_workflow_templates WHERE id = pfs.flow_id) as created_by,
    (SELECT updated_by FROM unified_workflow_templates WHERE id = pfs.flow_id) as updated_by
FROM project_flow_steps pfs
JOIN unified_workflow_stages uws ON uws.template_id = pfs.flow_id
JOIN unified_workflow_tasks uwt_task ON uwt_task.stage_id = uws.id
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pfs.flow_id AND uwt.template_type = 'flow_based'
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_steps uws_step 
    WHERE uws_step.id = pfs.id
);

-- 2.5 Migrate project_flow_elements to unified_workflow_elements
INSERT INTO unified_workflow_elements (
    id,
    step_id,
    element_type,
    element_key,
    element_order,
    label,
    placeholder,
    help_text,
    config,
    is_required,
    validation_rules,
    condition_logic,
    client_visible,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pfe.id,
    pfe.step_id,
    pfe.element_type,
    pfe.element_key,
    pfe.element_order,
    pfe.label,
    pfe.placeholder,
    pfe.help_text,
    pfe.config,
    pfe.is_required,
    pfe.validation_rules,
    pfe.condition_logic,
    true as client_visible,
    pfe.created_at,
    pfe.updated_at,
    (SELECT created_by FROM unified_workflow_steps WHERE id = pfe.step_id) as created_by,
    (SELECT updated_by FROM unified_workflow_steps WHERE id = pfe.step_id) as updated_by
FROM project_flow_elements pfe
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_steps uws 
    WHERE uws.id = pfe.step_id
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_elements uwe 
    WHERE uwe.id = pfe.id
);

-- ============================================================================
-- PHASE 3: MIGRATE INSTANCES AND USER DATA
-- ============================================================================

-- 3.1 Migrate project_flow_instances to unified_workflow_instances
INSERT INTO unified_workflow_instances (
    id,
    template_id,
    name,
    description,
    project_id,
    client_id,
    status,
    current_step_id,
    completion_percentage,
    started_at,
    completed_at,
    assigned_to,
    instance_data,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pfi.id,
    pfi.flow_id as template_id,
    'Instance of ' || (SELECT name FROM unified_workflow_templates WHERE id = pfi.flow_id) as name,
    'Migrated flow instance' as description,
    pfi.created_project_id as project_id,
    pfi.client_id,
    CASE 
        WHEN pfi.status = 'in_progress' THEN 'active'
        WHEN pfi.status = 'completed' THEN 'completed'
        WHEN pfi.status = 'abandoned' THEN 'cancelled'
        WHEN pfi.status = 'error' THEN 'on_hold'
        ELSE 'draft'
    END as status,
    pfi.current_step_id,
    CASE 
        WHEN pfi.status = 'completed' THEN 100.00
        WHEN pfi.status = 'in_progress' THEN 50.00
        ELSE 0.00
    END as completion_percentage,
    pfi.started_at,
    pfi.completed_at,
    pfi.user_id as assigned_to,
    pfi.metadata as instance_data,
    pfi.started_at as created_at,
    pfi.last_activity_at as updated_at,
    pfi.user_id as created_by,
    pfi.user_id as updated_by
FROM project_flow_instances pfi
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_templates uwt 
    WHERE uwt.id = pfi.flow_id
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_instances uwi 
    WHERE uwi.id = pfi.id
);

-- 3.2 Migrate project_flow_step_data to unified_workflow_step_data
INSERT INTO unified_workflow_step_data (
    id,
    instance_id,
    step_id,
    element_id,
    element_key,
    element_value,
    data_type,
    is_valid,
    validation_errors,
    submitted_at,
    submitted_by,
    created_at,
    updated_at,
    created_by,
    updated_by
)
SELECT 
    pfsd.id,
    pfsd.instance_id,
    pfsd.step_id,
    (SELECT id FROM unified_workflow_elements WHERE step_id = pfsd.step_id AND element_key = pfsd.element_key LIMIT 1) as element_id,
    pfsd.element_key,
    pfsd.data_value as element_value,
    pfsd.data_type,
    pfsd.is_valid,
    CASE 
        WHEN pfsd.validation_errors IS NULL THEN NULL
        WHEN jsonb_typeof(pfsd.validation_errors) = 'array' THEN 
            ARRAY(SELECT jsonb_array_elements_text(pfsd.validation_errors))
        ELSE ARRAY[pfsd.validation_errors::text]
    END as validation_errors,
    pfsd.updated_at as submitted_at,
    (SELECT assigned_to FROM unified_workflow_instances WHERE id = pfsd.instance_id) as submitted_by,
    pfsd.created_at,
    pfsd.updated_at,
    (SELECT assigned_to FROM unified_workflow_instances WHERE id = pfsd.instance_id) as created_by,
    (SELECT assigned_to FROM unified_workflow_instances WHERE id = pfsd.instance_id) as updated_by
FROM project_flow_step_data pfsd
WHERE EXISTS (
    SELECT 1 FROM unified_workflow_instances uwi 
    WHERE uwi.id = pfsd.instance_id
)
AND NOT EXISTS (
    SELECT 1 FROM unified_workflow_step_data uwsd 
    WHERE uwsd.id = pfsd.id
);

-- ============================================================================
-- POST-MIGRATION OPTIMIZATION
-- ============================================================================

-- Analyze tables for query optimization
ANALYZE unified_workflow_templates;
ANALYZE unified_workflow_stages;
ANALYZE unified_workflow_tasks;
ANALYZE unified_workflow_steps;
ANALYZE unified_workflow_elements;
ANALYZE unified_workflow_instances;
ANALYZE unified_workflow_step_data;

-- Note: VACUUM commands removed as they cannot run inside a transaction
-- Run these manually after migration if needed:
-- VACUUM ANALYZE unified_workflow_templates;
-- VACUUM ANALYZE unified_workflow_stages;
-- VACUUM ANALYZE unified_workflow_tasks;
-- VACUUM ANALYZE unified_workflow_steps;
-- VACUUM ANALYZE unified_workflow_elements;
-- VACUUM ANALYZE unified_workflow_instances;
-- VACUUM ANALYZE unified_workflow_step_data;

-- ============================================================================
-- MIGRATION VALIDATION
-- ============================================================================

-- Create validation summary view
CREATE VIEW migration_validation_summary AS
SELECT 
    'Templates' as entity,
    (SELECT COUNT(*) FROM project_templates) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'standard') as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_templates) = (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'standard')
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Flows' as entity,
    (SELECT COUNT(*) FROM project_flows) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'flow_based') as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_flows) = (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'flow_based')
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Template Stages' as entity,
    (SELECT COUNT(*) FROM project_template_stages) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_stages uws 
     JOIN unified_workflow_templates uwt ON uws.template_id = uwt.id 
     WHERE uwt.template_type = 'standard') as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_template_stages) = 
             (SELECT COUNT(*) FROM unified_workflow_stages uws 
              JOIN unified_workflow_templates uwt ON uws.template_id = uwt.id 
              WHERE uwt.template_type = 'standard')
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Template Tasks' as entity,
    (SELECT COUNT(*) FROM project_template_tasks) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_tasks uwt 
     JOIN unified_workflow_stages uws ON uwt.stage_id = uws.id
     JOIN unified_workflow_templates uwt_temp ON uws.template_id = uwt_temp.id 
     WHERE uwt_temp.template_type = 'standard') as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_template_tasks) = 
             (SELECT COUNT(*) FROM unified_workflow_tasks uwt 
              JOIN unified_workflow_stages uws ON uwt.stage_id = uws.id
              JOIN unified_workflow_templates uwt_temp ON uws.template_id = uwt_temp.id 
              WHERE uwt_temp.template_type = 'standard')
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Flow Steps' as entity,
    (SELECT COUNT(*) FROM project_flow_steps) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_steps) as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_flow_steps) = (SELECT COUNT(*) FROM unified_workflow_steps)
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Flow Elements' as entity,
    (SELECT COUNT(*) FROM project_flow_elements) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_elements) as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_flow_elements) = (SELECT COUNT(*) FROM unified_workflow_elements)
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Flow Instances' as entity,
    (SELECT COUNT(*) FROM project_flow_instances) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_instances) as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_flow_instances) = (SELECT COUNT(*) FROM unified_workflow_instances)
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status
UNION ALL
SELECT 
    'Step Data' as entity,
    (SELECT COUNT(*) FROM project_flow_step_data) as original_count,
    (SELECT COUNT(*) FROM unified_workflow_step_data) as migrated_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM project_flow_step_data) = (SELECT COUNT(*) FROM unified_workflow_step_data)
        THEN 'SUCCESS' 
        ELSE 'FAILED' 
    END as migration_status;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

-- Log data migration completion
INSERT INTO unified_workflow_migration_log (migration_step, status, notes, data_counts) 
VALUES (
    'migrate_existing_data',
    'completed',
    'Successfully migrated all existing data from dual-system to unified workflow architecture',
    jsonb_build_object(
        'templates_migrated', (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'standard'),
        'flows_migrated', (SELECT COUNT(*) FROM unified_workflow_templates WHERE template_type = 'flow_based'),
        'stages_migrated', (SELECT COUNT(*) FROM unified_workflow_stages),
        'tasks_migrated', (SELECT COUNT(*) FROM unified_workflow_tasks),
        'steps_migrated', (SELECT COUNT(*) FROM unified_workflow_steps),
        'elements_migrated', (SELECT COUNT(*) FROM unified_workflow_elements),
        'instances_migrated', (SELECT COUNT(*) FROM unified_workflow_instances),
        'step_data_migrated', (SELECT COUNT(*) FROM unified_workflow_step_data)
    )
);

COMMIT;

-- Verification query (run after migration)
-- SELECT * FROM migration_validation_summary; 