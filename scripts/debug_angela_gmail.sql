-- EMERGENCY DEBUG: Why does Angela still have Gmail access?

-- 1. Find Angela's exact agent ID
SELECT 'STEP 1: FIND ANGELA' as debug_step;
SELECT id as agent_id, name, user_id, created_at 
FROM agents 
WHERE name ILIKE '%angela%'
LIMIT 5;

-- 2. Check ALL of Angela's integration permissions (should show SMTP, NOT Gmail)
SELECT 'STEP 2: ANGELA INTEGRATION PERMISSIONS' as debug_step;
SELECT 
    aip.id as permission_id,
    aip.agent_id,
    aip.connection_id,
    aip.allowed_scopes,
    aip.is_active,
    aip.permission_level,
    aip.created_at
FROM agent_integration_permissions aip
WHERE aip.agent_id IN (
    SELECT id FROM agents WHERE name ILIKE '%angela%'
)
ORDER BY aip.created_at DESC;

-- 3. Check what connections those permission IDs point to
SELECT 'STEP 3: ANGELA CONNECTION DETAILS' as debug_step;
SELECT 
    uic.id as connection_id,
    uic.connection_name,
    uic.external_username,
    uic.credential_type,
    uic.connection_status,
    op.name as provider_name,
    op.display_name as provider_display,
    uic.created_at
FROM user_integration_credentials uic
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE uic.id IN (
    SELECT aip.connection_id 
    FROM agent_integration_permissions aip
    WHERE aip.agent_id IN (
        SELECT id FROM agents WHERE name ILIKE '%angela%'
    )
)
ORDER BY uic.created_at DESC;

-- 4. Specific Gmail check - this is what the function queries
SELECT 'STEP 4: GMAIL PERMISSION CHECK (FUNCTION LOGIC)' as debug_step;
SELECT 
    aip.id,
    aip.allowed_scopes,
    aip.is_active,
    uic.oauth_provider_id,
    uic.credential_type,
    op.name as provider_name,
    'THIS SHOULD BE EMPTY!' as should_be_empty
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE aip.agent_id IN (SELECT id FROM agents WHERE name ILIKE '%angela%')
  AND op.name = 'gmail'  -- This is the exact query from function logic
  AND uic.credential_type = 'oauth'
  AND aip.is_active = true;

-- 5. SMTP check - this should show results
SELECT 'STEP 5: SMTP PERMISSION CHECK' as debug_step;
SELECT 
    aip.id,
    aip.allowed_scopes,
    aip.is_active,
    uic.connection_name,
    op.name as provider_name,
    'THIS SHOULD SHOW RESULTS!' as should_show_results
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE aip.agent_id IN (SELECT id FROM agents WHERE name ILIKE '%angela%')
  AND op.name IN ('smtp', 'sendgrid', 'mailgun')
  AND aip.is_active = true;

-- 6. Check for duplicate agent names
SELECT 'STEP 6: CHECK FOR DUPLICATE ANGELAS' as debug_step;
SELECT count(*) as angela_count, 'SHOULD BE 1' as expected
FROM agents 
WHERE name ILIKE '%angela%';

-- 7. Show user's OAuth providers
SELECT 'STEP 7: USER OAUTH PROVIDERS' as debug_step;
SELECT DISTINCT op.name as provider_name
FROM user_integration_credentials uic
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE uic.user_id IN (
    SELECT user_id FROM agents WHERE name ILIKE '%angela%'
);

SELECT 'DEBUG COMPLETE - CHECK RESULTS ABOVE!' as final_message;
