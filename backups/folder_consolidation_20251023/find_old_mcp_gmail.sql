-- Find where Gmail tools are coming from in the old MCP system

-- 1. Find Angela's agent ID
SELECT 'ANGELA AGENT ID' as step;
SELECT id as agent_id, name 
FROM agents 
WHERE name ILIKE '%angela%';

-- 2. Check agent_mcp_connections (old system)
SELECT 'OLD MCP CONNECTIONS' as step;
SELECT 
    amc.id as connection_id,
    amc.agent_id,
    amc.connection_name,
    amc.is_active,
    amc.created_at,
    'OLD MCP SYSTEM' as system_type
FROM agent_mcp_connections amc
WHERE amc.agent_id IN (
    SELECT id FROM agents WHERE name ILIKE '%angela%'
);

-- 3. Check what tools those connections provide
SELECT 'MCP TOOLS CACHE' as step;
SELECT 
    mtc.connection_id,
    mtc.tool_name,
    mtc.openai_schema->>'name' as tool_function_name,
    CASE 
        WHEN mtc.tool_name LIKE '%gmail%' OR mtc.openai_schema->>'name' LIKE '%gmail%' THEN '❌ GMAIL TOOL (REMOVE!)'
        ELSE '✅ Other tool'
    END as tool_type
FROM mcp_tools_cache mtc
WHERE mtc.connection_id IN (
    SELECT amc.id 
    FROM agent_mcp_connections amc
    WHERE amc.agent_id IN (
        SELECT id FROM agents WHERE name ILIKE '%angela%'
    )
);

-- 4. Simulate what get_agent_mcp_tools would return
SELECT 'SIMULATED get_agent_mcp_tools OUTPUT' as step;
SELECT 
    amc.id as connection_id,
    amc.connection_name,
    mtc.tool_name,
    mtc.openai_schema->>'name' as function_name,
    CASE 
        WHEN mtc.openai_schema->>'name' = 'gmail_send_email' THEN '🚨 THIS IS THE PROBLEM!'
        ELSE 'Other tool'
    END as problem_indicator
FROM agent_mcp_connections amc
JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
WHERE amc.agent_id IN (
    SELECT id FROM agents WHERE name ILIKE '%angela%'
)
AND amc.is_active = true
ORDER BY amc.connection_name, mtc.tool_name;

-- 5. Show all Gmail entries in mcp_tools_cache
SELECT 'ALL GMAIL IN MCP CACHE' as step;
SELECT 
    connection_id,
    tool_name,
    openai_schema->>'name' as function_name,
    'DELETE THIS!' as action
FROM mcp_tools_cache 
WHERE tool_name LIKE '%gmail%' 
   OR openai_schema->>'name' LIKE '%gmail%';

SELECT 'INVESTIGATION COMPLETE' as final_message;
