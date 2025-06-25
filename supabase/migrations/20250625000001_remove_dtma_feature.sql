-- Migration: Remove DTMA Feature - Complete Database Cleanup
-- Date: 2025-06-25 12:17:00
-- Purpose: Safely remove all DTMA (Droplet Tool Management Agent) components from database
-- Order: Functions → Policies → Tables (child to parent to avoid FK violations)

-- =============================================================================
-- STEP 1: DROP DATABASE FUNCTIONS (Must be first)
-- =============================================================================

-- Drop MCP-related functions that reference DTMA tables
DROP FUNCTION IF EXISTS get_agent_mcp_servers(UUID);
DROP FUNCTION IF EXISTS get_available_mcp_servers(UUID);
DROP FUNCTION IF EXISTS get_mcp_server_details(UUID, UUID);
DROP FUNCTION IF EXISTS create_mcp_server_access(UUID, UUID, UUID);

-- =============================================================================
-- STEP 2: DROP ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Drop RLS policies for account_tool_instances
DROP POLICY IF EXISTS "Users can manage instances on their own account environments" ON public.account_tool_instances;
DROP POLICY IF EXISTS "Service roles can access all account tool instances" ON public.account_tool_instances;
DROP POLICY IF EXISTS "Users can manage tools on their own account environment" ON public.account_tool_instances;
DROP POLICY IF EXISTS "Service roles can access all account tool environment tools" ON public.account_tool_instances;

-- Drop RLS policies for account_tool_environments  
DROP POLICY IF EXISTS "Users can manage their own account tool environment" ON public.account_tool_environments;
DROP POLICY IF EXISTS "Service roles can access all account tool environments" ON public.account_tool_environments;

-- Drop RLS policies for tool_catalog
DROP POLICY IF EXISTS "Authenticated users can view tool catalog" ON public.tool_catalog;
DROP POLICY IF EXISTS "Service roles can manage tool catalog" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can view all tool catalog entries" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can create tool catalog entries" ON public.tool_catalog;
DROP POLICY IF EXISTS "Admins can manage tool catalog entries" ON public.tool_catalog;

-- Drop RLS policies for agent_toolbox_access
DROP POLICY IF EXISTS "Users can manage agent toolbox access for their own agents" ON public.agent_toolbox_access;
DROP POLICY IF EXISTS "Service roles can access all agent toolbox access" ON public.agent_toolbox_access;

-- Drop RLS policies for agent_mcp_server_access
DROP POLICY IF EXISTS "Users can manage agent MCP server access for their own agents" ON public.agent_mcp_server_access;
DROP POLICY IF EXISTS "Service roles can access all agent MCP server access" ON public.agent_mcp_server_access;

-- =============================================================================
-- STEP 3: DROP TABLES (Child to Parent Order - Critical!)
-- =============================================================================

-- Drop child tables first (tables with foreign keys to parent tables)
DROP TABLE IF EXISTS public.agent_mcp_server_access CASCADE;
DROP TABLE IF EXISTS public.agent_toolbox_access CASCADE;
DROP TABLE IF EXISTS public.account_tool_instances CASCADE;

-- Drop parent tables
DROP TABLE IF EXISTS public.account_tool_environments CASCADE;
DROP TABLE IF EXISTS public.tool_catalog CASCADE;

-- =============================================================================
-- STEP 4: DROP CUSTOM TYPES AND ENUMS
-- =============================================================================

-- Drop custom enums used by DTMA tables
DROP TYPE IF EXISTS public.account_tool_environment_status_enum CASCADE;
DROP TYPE IF EXISTS public.account_tool_installation_status_enum CASCADE;

-- =============================================================================
-- STEP 5: CLEANUP VERIFICATION
-- =============================================================================

-- Add comment for verification
COMMENT ON SCHEMA public IS 'DTMA feature removal completed on 2025-06-25. All related tables, functions, policies, and types have been removed.'; 