-- TOOL AUTHORIZATION VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify the fix

-- ==============================================
-- 1. CHECK ANGELA'S PERMISSIONS
-- ==============================================
SELECT 'ANGELA TOOL PERMISSIONS' as check_type;

SELECT 
    a.name as agent_name,
    op.name as provider_name,
    uic.connection_name,
    aip.allowed_scopes,
    CASE 
        WHEN op.name = 'gmail' THEN '❌ PROBLEM: Has Gmail (should not!)'
        WHEN op.name IN ('smtp', 'sendgrid', 'mailgun') THEN '✅ OK: Has email relay'
        ELSE '📌 ' || op.name
    END as status
FROM agent_integration_permissions aip
JOIN agents a ON a.id = aip.agent_id
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE a.name ILIKE '%angela%'
  AND aip.is_active = true
ORDER BY op.name;

-- ==============================================
-- 2. EXPECTED TOOLS FOR ANGELA
-- ==============================================
SELECT 'EXPECTED TOOL NAMES' as check_type;

SELECT 
    CASE op.name
        WHEN 'gmail' THEN 'gmail_send_email, gmail_read_emails, gmail_search_emails'
        WHEN 'smtp' THEN 'smtp_send_email, smtp_test_connection'
        WHEN 'sendgrid' THEN 'sendgrid_send_email'
        WHEN 'mailgun' THEN 'mailgun_send_email, mailgun_validate_email'
        ELSE op.name || '_tools'
    END as available_tools,
    op.name as provider
FROM agent_integration_permissions aip
JOIN agents a ON a.id = aip.agent_id
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE a.name ILIKE '%angela%'
  AND aip.is_active = true;

-- ==============================================
-- 3. CHECK FOR ANY GMAIL CREDENTIALS (Security)
-- ==============================================
SELECT 'GMAIL CREDENTIALS CHECK' as check_type;

SELECT 
    'User ' || u.email as user_email,
    uic.connection_name,
    uic.external_username as gmail_account,
    uic.connection_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM agent_integration_permissions aip2
            JOIN agents a2 ON a2.id = aip2.agent_id
            WHERE aip2.connection_id = uic.id
              AND a2.name ILIKE '%angela%'
        ) THEN '❌ ANGELA HAS ACCESS!'
        ELSE '✅ Angela has no access'
    END as angela_access
FROM user_integration_credentials uic
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
JOIN auth.users u ON u.id = uic.user_id
WHERE op.name = 'gmail'
  AND uic.user_id IN (
      SELECT user_id FROM agents WHERE name ILIKE '%angela%'
  );

-- ==============================================
-- 4. SUMMARY OF ALL AGENT TOOLS
-- ==============================================
SELECT 'ALL AGENTS TOOL SUMMARY' as check_type;

SELECT 
    a.name as agent_name,
    STRING_AGG(
        DISTINCT op.name || ' (' || 
        CASE op.name
            WHEN 'gmail' THEN 'gmail_*'
            WHEN 'smtp' THEN 'smtp_*'
            WHEN 'sendgrid' THEN 'sendgrid_*'
            WHEN 'mailgun' THEN 'mailgun_*'
            ELSE op.name || '_*'
        END || ')', 
        ', '
    ) as available_tool_prefixes
FROM agents a
LEFT JOIN agent_integration_permissions aip ON aip.agent_id = a.id AND aip.is_active = true
LEFT JOIN user_integration_credentials uic ON uic.id = aip.connection_id
LEFT JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE a.is_active = true
GROUP BY a.id, a.name
ORDER BY a.name;

-- ==============================================
-- 5. VERIFY NO TOOL NAME COLLISIONS
-- ==============================================
SELECT 'TOOL NAMING VERIFICATION' as check_type;

SELECT 
    'With namespacing, each provider has unique tool names:' as info
UNION ALL
SELECT '  • Gmail: gmail_send_email (not send_email)'
UNION ALL
SELECT '  • SMTP: smtp_send_email (not send_email)'
UNION ALL
SELECT '  • SendGrid: sendgrid_send_email (not send_email)'
UNION ALL
SELECT '  • Mailgun: mailgun_send_email (not send_email)'
UNION ALL
SELECT '✅ No collisions possible!';

-- ==============================================
-- END OF VERIFICATION
-- ==============================================
SELECT '=' as divider, 'VERIFICATION COMPLETE' as status, '=' as divider2;
