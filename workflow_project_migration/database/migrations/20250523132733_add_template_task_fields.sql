-- Migration: Add new fields to project_template_tasks table
-- Date: 2025-01-23
-- Description: Add due_date, assignee_member_id, and priority fields to support enhanced template functionality

-- Add due_date column (nullable date field)
ALTER TABLE project_template_tasks 
ADD COLUMN due_date DATE;

-- Add assignee_member_id column (nullable UUID field for future user assignment)
ALTER TABLE project_template_tasks 
ADD COLUMN assignee_member_id UUID;

-- Add priority column (nullable text field with constraint)
ALTER TABLE project_template_tasks 
ADD COLUMN priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));

-- Add comments for documentation
COMMENT ON COLUMN project_template_tasks.due_date IS 'Optional due date for task completion';
COMMENT ON COLUMN project_template_tasks.assignee_member_id IS 'Optional ID of team member assigned to this task';
COMMENT ON COLUMN project_template_tasks.priority IS 'Task priority level: HIGH, MEDIUM, or LOW';
