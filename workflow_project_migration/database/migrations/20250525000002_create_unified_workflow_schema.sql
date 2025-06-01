-- Migration: Create unified workflow schema
-- Created: 2025-05-25
-- Purpose: Create the unified workflow architecture tables

BEGIN;

-- ============================================================================
-- CREATE MIGRATION LOG TABLE
-- ============================================================================

-- Create migration log table for tracking migration progress
CREATE TABLE IF NOT EXISTS unified_workflow_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_step TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
    notes TEXT,
    data_counts JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for migration log queries
CREATE INDEX IF NOT EXISTS idx_unified_workflow_migration_log_step ON unified_workflow_migration_log(migration_step);
CREATE INDEX IF NOT EXISTS idx_unified_workflow_migration_log_status ON unified_workflow_migration_log(status);
CREATE INDEX IF NOT EXISTS idx_unified_workflow_migration_log_created_at ON unified_workflow_migration_log(created_at);

-- ============================================================================
-- CREATE UNIFIED WORKFLOW TEMPLATES TABLE
-- ============================================================================

CREATE TABLE unified_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'standard', 'flow_based', 'hybrid'
    
    -- Template metadata
    icon VARCHAR(100),
    color VARCHAR(7), -- Hex color code
    category VARCHAR(100),
    tags TEXT[], -- Array of tags
    
    -- Workflow settings
    requires_products_services BOOLEAN DEFAULT false,
    auto_create_project BOOLEAN DEFAULT true,
    estimated_duration_minutes INTEGER,
    
    -- Client visibility
    client_visible BOOLEAN DEFAULT true,
    client_description TEXT,
    
    -- Status and versioning
    is_active BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_template_type CHECK (template_type IN ('standard', 'flow_based', 'hybrid')),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$' OR color IS NULL)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_templates_name ON unified_workflow_templates(name);
CREATE INDEX idx_unified_workflow_templates_type ON unified_workflow_templates(template_type);
CREATE INDEX idx_unified_workflow_templates_active ON unified_workflow_templates(is_active);
CREATE INDEX idx_unified_workflow_templates_published ON unified_workflow_templates(is_published);
CREATE INDEX idx_unified_workflow_templates_created_by ON unified_workflow_templates(created_by);

-- Enable RLS
ALTER TABLE unified_workflow_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view active published templates" ON unified_workflow_templates
    FOR SELECT USING (is_active = true AND is_published = true);

CREATE POLICY "Admins can manage all templates" ON unified_workflow_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'ADMIN')
        )
    );

CREATE POLICY "Users can manage their own templates" ON unified_workflow_templates
    FOR ALL USING (created_by = auth.uid());

-- ============================================================================
-- CREATE UNIFIED WORKFLOW STAGES TABLE
-- ============================================================================

CREATE TABLE unified_workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES unified_workflow_templates(id) ON DELETE CASCADE,
    
    -- Stage identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    
    -- Stage behavior
    is_required BOOLEAN DEFAULT true,
    allow_skip BOOLEAN DEFAULT false,
    auto_advance BOOLEAN DEFAULT false,
    
    -- Client visibility
    client_visible BOOLEAN DEFAULT true,
    client_description TEXT,
    
    -- Conditional logic
    condition_logic JSONB DEFAULT '{}',
    
    -- Visual settings
    icon VARCHAR(100),
    color VARCHAR(7),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_stage_order CHECK (stage_order > 0),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$' OR color IS NULL),
    UNIQUE(template_id, stage_order)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_stages_template ON unified_workflow_stages(template_id);
CREATE INDEX idx_unified_workflow_stages_order ON unified_workflow_stages(template_id, stage_order);
CREATE INDEX idx_unified_workflow_stages_required ON unified_workflow_stages(is_required);

-- Enable RLS
ALTER TABLE unified_workflow_stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view stages of accessible templates" ON unified_workflow_stages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_templates t
            WHERE t.id = template_id
            AND (
                (t.is_active = true AND t.is_published = true) OR
                t.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

CREATE POLICY "Users can manage stages of their templates" ON unified_workflow_stages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_templates t
            WHERE t.id = template_id
            AND (
                t.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

-- ============================================================================
-- CREATE UNIFIED WORKFLOW TASKS TABLE
-- ============================================================================

CREATE TABLE unified_workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES unified_workflow_stages(id) ON DELETE CASCADE,
    
    -- Task identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_order INTEGER NOT NULL,
    
    -- Task behavior
    task_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'approval', 'review', 'automated'
    is_required BOOLEAN DEFAULT true,
    allow_skip BOOLEAN DEFAULT false,
    auto_advance BOOLEAN DEFAULT false,
    
    -- Assignment and timing
    assigned_to UUID REFERENCES auth.users(id),
    estimated_duration_minutes INTEGER,
    due_date_offset_days INTEGER, -- Days from project start
    
    -- Client visibility
    client_visible BOOLEAN DEFAULT false,
    client_description TEXT,
    
    -- Conditional logic
    condition_logic JSONB DEFAULT '{}',
    
    -- Dependencies
    depends_on_task_ids UUID[], -- Array of task IDs this task depends on
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_task_order CHECK (task_order > 0),
    CONSTRAINT valid_task_type CHECK (task_type IN ('standard', 'approval', 'review', 'automated')),
    UNIQUE(stage_id, task_order)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_tasks_stage ON unified_workflow_tasks(stage_id);
CREATE INDEX idx_unified_workflow_tasks_order ON unified_workflow_tasks(stage_id, task_order);
CREATE INDEX idx_unified_workflow_tasks_assigned ON unified_workflow_tasks(assigned_to);
CREATE INDEX idx_unified_workflow_tasks_type ON unified_workflow_tasks(task_type);

-- Enable RLS
ALTER TABLE unified_workflow_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view tasks of accessible stages" ON unified_workflow_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_stages s
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE s.id = stage_id
            AND (
                (t.is_active = true AND t.is_published = true) OR
                t.created_by = auth.uid() OR
                assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

CREATE POLICY "Users can manage tasks of their templates" ON unified_workflow_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_stages s
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE s.id = stage_id
            AND (
                t.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

-- ============================================================================
-- CREATE UNIFIED WORKFLOW STEPS TABLE
-- ============================================================================

CREATE TABLE unified_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES unified_workflow_tasks(id) ON DELETE CASCADE,
    
    -- Step identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    step_order INTEGER NOT NULL,
    
    -- Step behavior
    step_type VARCHAR(50) DEFAULT 'form', -- 'form', 'approval', 'review', 'automated', 'conditional'
    is_required BOOLEAN DEFAULT true,
    allow_skip BOOLEAN DEFAULT false,
    auto_advance BOOLEAN DEFAULT false,
    
    -- Form and interaction settings
    show_progress BOOLEAN DEFAULT true,
    allow_back_navigation BOOLEAN DEFAULT true,
    save_progress BOOLEAN DEFAULT true,
    
    -- Client visibility
    client_visible BOOLEAN DEFAULT true,
    client_description TEXT,
    
    -- Conditional logic
    condition_logic JSONB DEFAULT '{}',
    
    -- Validation settings
    validation_rules JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_step_order CHECK (step_order > 0),
    CONSTRAINT valid_step_type CHECK (step_type IN ('form', 'approval', 'review', 'automated', 'conditional')),
    UNIQUE(task_id, step_order)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_steps_task ON unified_workflow_steps(task_id);
CREATE INDEX idx_unified_workflow_steps_order ON unified_workflow_steps(task_id, step_order);
CREATE INDEX idx_unified_workflow_steps_type ON unified_workflow_steps(step_type);
CREATE INDEX idx_unified_workflow_steps_required ON unified_workflow_steps(is_required);

-- Enable RLS
ALTER TABLE unified_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view steps of accessible tasks" ON unified_workflow_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_tasks tk
            JOIN unified_workflow_stages s ON tk.stage_id = s.id
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE tk.id = task_id
            AND (
                (t.is_active = true AND t.is_published = true) OR
                t.created_by = auth.uid() OR
                tk.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

CREATE POLICY "Users can manage steps of their templates" ON unified_workflow_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_tasks tk
            JOIN unified_workflow_stages s ON tk.stage_id = s.id
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE tk.id = task_id
            AND (
                t.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

-- ============================================================================
-- CREATE UNIFIED WORKFLOW ELEMENTS TABLE
-- ============================================================================

CREATE TABLE unified_workflow_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES unified_workflow_steps(id) ON DELETE CASCADE,
    
    -- Element identification
    element_type VARCHAR(100) NOT NULL,
    element_key VARCHAR(255) NOT NULL, -- Unique key for data binding
    element_order INTEGER NOT NULL,
    
    -- Element content
    label VARCHAR(255),
    placeholder TEXT,
    help_text TEXT,
    
    -- Element configuration
    config JSONB DEFAULT '{}', -- Element-specific configuration
    
    -- Validation
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}',
    
    -- Conditional logic
    condition_logic JSONB DEFAULT '{}',
    
    -- Client visibility
    client_visible BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_element_order CHECK (element_order > 0),
    CONSTRAINT valid_element_type CHECK (
        element_type IN (
            -- Form Elements
            'text_input', 'textarea', 'number_input', 'email_input', 'url_input',
            'dropdown', 'radio_group', 'checkbox_group', 'date_picker', 'file_upload',
            -- Content Elements  
            'heading', 'paragraph', 'instructions', 'link', 'divider', 'image',
            -- Integration Elements
            'products_services_selector', 'template_selector', 'client_info_display',
            -- Validation Elements
            'confirmation_checkbox', 'signature_pad',
            -- Review Elements
            'summary_display', 'data_review'
        )
    ),
    UNIQUE(step_id, element_key),
    UNIQUE(step_id, element_order)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_elements_step ON unified_workflow_elements(step_id);
CREATE INDEX idx_unified_workflow_elements_order ON unified_workflow_elements(step_id, element_order);
CREATE INDEX idx_unified_workflow_elements_type ON unified_workflow_elements(element_type);
CREATE INDEX idx_unified_workflow_elements_key ON unified_workflow_elements(element_key);

-- Enable RLS
ALTER TABLE unified_workflow_elements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view elements of accessible steps" ON unified_workflow_elements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_steps st
            JOIN unified_workflow_tasks tk ON st.task_id = tk.id
            JOIN unified_workflow_stages s ON tk.stage_id = s.id
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE st.id = step_id
            AND (
                (t.is_active = true AND t.is_published = true) OR
                t.created_by = auth.uid() OR
                tk.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

CREATE POLICY "Users can manage elements of their templates" ON unified_workflow_elements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_steps st
            JOIN unified_workflow_tasks tk ON st.task_id = tk.id
            JOIN unified_workflow_stages s ON tk.stage_id = s.id
            JOIN unified_workflow_templates t ON s.template_id = t.id
            WHERE st.id = step_id
            AND (
                t.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

-- ============================================================================
-- CREATE UNIFIED WORKFLOW INSTANCES TABLE
-- ============================================================================

CREATE TABLE unified_workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES unified_workflow_templates(id),
    
    -- Instance identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Project association
    project_id UUID REFERENCES projects(id),
    client_id UUID REFERENCES clients(id),
    
    -- Instance status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'completed', 'cancelled', 'on_hold'
    current_stage_id UUID REFERENCES unified_workflow_stages(id),
    current_task_id UUID REFERENCES unified_workflow_tasks(id),
    current_step_id UUID REFERENCES unified_workflow_steps(id),
    
    -- Progress tracking
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    assigned_team_id UUID, -- Future: team assignments
    
    -- Instance data
    instance_data JSONB DEFAULT '{}', -- Global instance data
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'on_hold')),
    CONSTRAINT valid_completion_percentage CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_instances_template ON unified_workflow_instances(template_id);
CREATE INDEX idx_unified_workflow_instances_project ON unified_workflow_instances(project_id);
CREATE INDEX idx_unified_workflow_instances_client ON unified_workflow_instances(client_id);
CREATE INDEX idx_unified_workflow_instances_status ON unified_workflow_instances(status);
CREATE INDEX idx_unified_workflow_instances_assigned ON unified_workflow_instances(assigned_to);
CREATE INDEX idx_unified_workflow_instances_current_step ON unified_workflow_instances(current_step_id);

-- Enable RLS
ALTER TABLE unified_workflow_instances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their assigned instances" ON unified_workflow_instances
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
            AND (
                p.created_by_user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.id
                    AND pm.user_id = auth.uid()
                )
            )
        ) OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'ADMIN')
        )
    );

CREATE POLICY "Users can manage their instances" ON unified_workflow_instances
    FOR ALL USING (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('SUPER_ADMIN', 'ADMIN')
        )
    );

-- ============================================================================
-- CREATE UNIFIED WORKFLOW STEP DATA TABLE
-- ============================================================================

CREATE TABLE unified_workflow_step_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES unified_workflow_instances(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES unified_workflow_steps(id),
    element_id UUID REFERENCES unified_workflow_elements(id),
    
    -- Data storage
    element_key VARCHAR(255) NOT NULL,
    element_value JSONB,
    
    -- Data metadata
    data_type VARCHAR(50), -- 'text', 'number', 'boolean', 'date', 'file', 'array', 'object'
    is_valid BOOLEAN DEFAULT true,
    validation_errors TEXT[],
    
    -- Submission tracking
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by UUID REFERENCES auth.users(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    UNIQUE(instance_id, step_id, element_key)
);

-- Create indexes
CREATE INDEX idx_unified_workflow_step_data_instance ON unified_workflow_step_data(instance_id);
CREATE INDEX idx_unified_workflow_step_data_step ON unified_workflow_step_data(step_id);
CREATE INDEX idx_unified_workflow_step_data_element ON unified_workflow_step_data(element_id);
CREATE INDEX idx_unified_workflow_step_data_key ON unified_workflow_step_data(element_key);
CREATE INDEX idx_unified_workflow_step_data_submitted ON unified_workflow_step_data(submitted_at);

-- Enable RLS
ALTER TABLE unified_workflow_step_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view step data of their instances" ON unified_workflow_step_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_instances i
            WHERE i.id = instance_id
            AND (
                i.assigned_to = auth.uid() OR
                i.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM projects p
                    WHERE p.id = i.project_id
                    AND (
                        p.created_by_user_id = auth.uid() OR
                        EXISTS (
                            SELECT 1 FROM project_members pm
                            WHERE pm.project_id = p.id
                            AND pm.user_id = auth.uid()
                        )
                    )
                ) OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

CREATE POLICY "Users can manage step data of their instances" ON unified_workflow_step_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM unified_workflow_instances i
            WHERE i.id = instance_id
            AND (
                i.assigned_to = auth.uid() OR
                i.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid()
                    AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            )
        )
    );

-- ============================================================================
-- LOG SCHEMA CREATION
-- ============================================================================

-- Log schema creation completion
INSERT INTO unified_workflow_migration_log (migration_step, status, notes) 
VALUES (
    'create_unified_schema',
    'completed',
    'Successfully created unified workflow schema with 7 tables, indexes, constraints, and RLS policies'
);

COMMIT; 