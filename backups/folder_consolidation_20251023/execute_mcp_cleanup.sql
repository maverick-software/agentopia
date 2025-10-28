-- EXECUTE MCP CLEANUP - Remove Gmail from old MCP system

-- First, show what we're deleting
SELECT 'GMAIL TOOLS IN OLD MCP SYSTEM:' as step;
SELECT 
    connection_id,
    tool_name,
    openai_schema->>'name' as function_name,
    'WILL BE DELETED' as status
FROM mcp_tools_cache 
WHERE tool_name LIKE '%gmail%' 
   OR openai_schema->>'name' LIKE '%gmail%'
   OR openai_schema::text ILIKE '%gmail%';

-- DELETE Gmail tools from MCP cache
DELETE FROM mcp_tools_cache 
WHERE tool_name LIKE '%gmail%' 
   OR openai_schema->>'name' LIKE '%gmail%'
   OR openai_schema::text ILIKE '%gmail%';

-- Check for empty Gmail MCP connections
SELECT 'GMAIL MCP CONNECTIONS AFTER CLEANUP:' as step;
SELECT 
    amc.id,
    amc.connection_name,
    COUNT(mtc.tool_name) as remaining_tools
FROM agent_mcp_connections amc
LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
WHERE (amc.connection_name ILIKE '%gmail%' OR amc.connection_name ILIKE '%google%')
GROUP BY amc.id, amc.connection_name;

-- Delete empty Gmail connections
DELETE FROM agent_mcp_connections
WHERE id IN (
    SELECT amc.id
    FROM agent_mcp_connections amc
    LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
    WHERE (amc.connection_name ILIKE '%gmail%' OR amc.connection_name ILIKE '%google%')
      AND mtc.connection_id IS NULL  -- No tools left
);

SELECT 'MCP GMAIL CLEANUP COMPLETE' as final_status;
