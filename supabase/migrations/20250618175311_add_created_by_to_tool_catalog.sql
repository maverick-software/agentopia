-- Migration: Add created_by column to tool_catalog table
-- Date: 2025-06-18
-- Purpose: Fix database schema mismatch for MCP-DTMA integration deployment
-- This resolves the "Could not find the 'created_by' column of 'tool_catalog'" error

BEGIN;

-- Add created_by column to track who created the tool/template
ALTER TABLE public.tool_catalog
ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.tool_catalog.created_by IS 'The user who created the tool catalog entry.';

-- Update the existing generic MCP entry to have a proper created_by value
-- Use the first admin user if available, otherwise keep it NULL
UPDATE public.tool_catalog 
SET created_by = (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE r.name = 'admin' 
    LIMIT 1
)
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Ensure proper RLS policies exist for tool_catalog table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view tool catalog" ON public.tool_catalog;
DROP POLICY IF EXISTS "Service roles can manage tool catalog" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can view all tool catalog entries" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can create tool catalog entries" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can manage tool catalog entries" ON public.tool_catalog;

-- Create comprehensive RLS policies for tool_catalog
-- Policy for all authenticated users to read tool catalog entries
CREATE POLICY "Authenticated users can view tool catalog"
ON public.tool_catalog FOR SELECT
TO authenticated
USING (true);

-- Policy for admins to read all tool catalog entries
CREATE POLICY "Admins can view all tool catalog entries"
ON public.tool_catalog FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- Policy for admins to create tool catalog entries
CREATE POLICY "Admins can create tool catalog entries"
ON public.tool_catalog FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- Policy for admins to update tool catalog entries
CREATE POLICY "Admins can update tool catalog entries"
ON public.tool_catalog FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- Policy for service roles to manage all tool catalog operations
CREATE POLICY "Service roles can manage tool catalog"
ON public.tool_catalog FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;
