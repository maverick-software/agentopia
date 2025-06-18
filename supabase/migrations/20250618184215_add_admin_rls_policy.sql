-- Migration: Add admin RLS policies for MCP server management
-- Date: 2025-06-18
-- Purpose: Allow admins to view and manage all account_tool_instances across all users

BEGIN;

-- Create admin policy for SELECT access to all account_tool_instances
CREATE POLICY "Admin can view all account tool instances" 
ON public.account_tool_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
);

-- Create admin policy for UPDATE access to all account_tool_instances  
CREATE POLICY "Admin can update all account tool instances"
ON public.account_tool_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
);

-- Create admin policy for INSERT access to account_tool_instances
CREATE POLICY "Admin can create account tool instances"
ON public.account_tool_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
);

-- Create admin policy for DELETE access to account_tool_instances
CREATE POLICY "Admin can delete account tool instances"
ON public.account_tool_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
);

-- Also add admin policy for account_tool_environments so admins can see all environments
CREATE POLICY "Admin can view all account tool environments" 
ON public.account_tool_environments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('admin', 'super_admin')
  )
);

COMMIT;
