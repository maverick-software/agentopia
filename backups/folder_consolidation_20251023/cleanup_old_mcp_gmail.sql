-- EMERGENCY CLEANUP: Remove Gmail from old MCP system that's bypassing security

-- ==============================================
-- 1. SHOW WHAT WE'RE ABOUT TO DELETE
-- ==============================================
SELECT 'GMAIL TOOLS TO BE DELETED FROM OLD MCP SYSTEM:' as action;
SELECT 
    connection_id,
    tool_name,
    openai_schema->>'name' as function_name,
    'WILL BE DELETED' as status
FROM mcp_tools_cache 
WHERE tool_name LIKE '%gmail%' 
   OR openai_schema->>'name' LIKE '%gmail%'
   OR openai_schema::text ILIKE '%gmail%';

-- ==============================================
-- 2. DELETE GMAIL TOOLS FROM MCP CACHE
-- ==============================================
-- Uncomment the following line to execute:
-- DELETE FROM mcp_tools_cache 
-- WHERE tool_name LIKE '%gmail%' 
--    OR openai_schema->>'name' LIKE '%gmail%'
--    OR openai_schema::text ILIKE '%gmail%';

-- ==============================================
-- 3. SHOW AGENT MCP CONNECTIONS THAT MIGHT PROVIDE GMAIL
-- ==============================================
SELECT 'AGENT MCP CONNECTIONS ANALYSIS:' as action;
SELECT 
    amc.id,
    amc.agent_id,
    amc.connection_name,
    a.name as agent_name,
    COUNT(mtc.tool_name) as total_tools,
    CASE 
        WHEN COUNT(mtc.tool_name) = 0 THEN 'NO TOOLS - CAN DELETE CONNECTION'
        ELSE 'HAS OTHER TOOLS - KEEP CONNECTION'
    END as recommendation
FROM agent_mcp_connections amc
LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
LEFT JOIN agents a ON a.id = amc.agent_id
GROUP BY amc.id, amc.agent_id, amc.connection_name, a.name
HAVING amc.connection_name ILIKE '%gmail%'
   OR amc.connection_name ILIKE '%google%'
ORDER BY a.name;

-- ==============================================
-- 4. OPTIONAL: DELETE EMPTY GMAIL MCP CONNECTIONS
-- ==============================================
-- Only delete connections that have no tools left after cleanup
-- Uncomment the following lines to execute:
-- 
-- DELETE FROM agent_mcp_connections
-- WHERE id IN (
--     SELECT amc.id
--     FROM agent_mcp_connections amc
--     LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
--     WHERE (amc.connection_name ILIKE '%gmail%' OR amc.connection_name ILIKE '%google%')
--       AND mtc.connection_id IS NULL  -- No tools left
-- );

-- ==============================================
-- 5. VERIFY CLEANUP
-- ==============================================
SELECT 'POST-CLEANUP VERIFICATION:' as action;
SELECT 'Gmail tools remaining in mcp_tools_cache:' as check_type,
       COUNT(*) as count,
       CASE WHEN COUNT(*) = 0 THEN '✅ CLEAN' ELSE '❌ STILL HAS GMAIL' END as status
FROM mcp_tools_cache 
WHERE tool_name LIKE '%gmail%' 
   OR openai_schema->>'name' LIKE '%gmail%'
   OR openai_schema::text ILIKE '%gmail%';

-- ==============================================
-- 6. RECOMMENDATION
-- ==============================================
SELECT 'SECURITY RECOMMENDATION:' as final_note;
SELECT 'After running this cleanup:' as step_1
UNION ALL
SELECT '1. Gmail tools will be removed from old MCP system' as step_2
UNION ALL  
SELECT '2. Only unified agent_integration_permissions will control Gmail' as step_3
UNION ALL
SELECT '3. Angela will only see tools she is authorized for' as step_4
UNION ALL
SELECT '4. No more security bypass via MCP cache' as step_5;

SELECT '=' as divider, 'CLEANUP READY - UNCOMMENT DELETE STATEMENTS TO EXECUTE' as status, '=' as divider2;
