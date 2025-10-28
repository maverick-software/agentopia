-- Check MCP connections and tools in the database
-- This script will help us understand if the MCP tools are being stored correctly

-- 1. Check if Angela agent exists
SELECT 'Angela Agent Check' as check_type, id, name, user_id 
FROM agents 
WHERE name ILIKE '%angela%'
LIMIT 5;

-- 2. Check MCP connections for Angela
SELECT 'MCP Connections' as check_type, 
       amc.id, 
       amc.agent_id, 
       a.name as agent_name,
       amc.connection_name,
       amc.server_url,
       amc.is_active,
       amc.created_at
FROM agent_mcp_connections amc
JOIN agents a ON a.id = amc.agent_id
WHERE a.name ILIKE '%angela%';

-- 3. Check cached MCP tools
SELECT 'MCP Tools Cache' as check_type,
       mtc.id,
       mtc.connection_id,
       amc.connection_name,
       mtc.tool_name,
       mtc.tool_schema->>'name' as schema_name,
       mtc.tool_schema->>'description' as description,
       mtc.openai_schema->>'name' as openai_name,
       mtc.last_updated
FROM mcp_tools_cache mtc
JOIN agent_mcp_connections amc ON amc.id = mtc.connection_id
JOIN agents a ON a.id = amc.agent_id
WHERE a.name ILIKE '%angela%'
ORDER BY mtc.tool_name;

-- 4. Test the RPC function
SELECT 'RPC Function Test' as check_type,
       tool_name,
       connection_id,
       openai_schema->>'name' as openai_function_name,
       openai_schema->>'description' as openai_description
FROM get_agent_mcp_tools('87e6e948-694d-4f8c-8e94-2b4f6281ffc3')
ORDER BY tool_name;

-- 5. Check if the RPC function exists
SELECT 'RPC Function Exists' as check_type,
       proname as function_name,
       prosrc as function_body
FROM pg_proc 
WHERE proname = 'get_agent_mcp_tools';
