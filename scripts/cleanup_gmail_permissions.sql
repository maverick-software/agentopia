-- CRITICAL SECURITY CLEANUP: Remove all unauthorized Gmail permissions
-- This script will clean up any rogue Gmail connections for agents

-- Step 1: Show what we're about to delete (for review)
SELECT 'GMAIL PERMISSIONS TO BE DELETED:' as action;
SELECT 
    aip.id as permission_id,
    a.name as agent_name,
    aip.agent_id,
    uic.connection_name,
    uic.external_username,
    op.name as provider_name,
    'WILL BE DELETED' as status
FROM agent_integration_permissions aip
JOIN agents a ON a.id = aip.agent_id
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE op.name = 'gmail';

-- Step 2: Check which agents have SMTP permissions (should be preserved)
SELECT 'SMTP PERMISSIONS TO BE PRESERVED:' as action;
SELECT 
    a.name as agent_name,
    aip.agent_id,
    uic.connection_name,
    op.name as provider_name,
    'WILL BE PRESERVED' as status
FROM agent_integration_permissions aip
JOIN agents a ON a.id = aip.agent_id
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE op.name IN ('smtp', 'sendgrid', 'mailgun');

-- Step 3: DELETE all Gmail agent permissions (CRITICAL SECURITY STEP)
-- Uncomment the following lines to execute the cleanup:

-- DELETE FROM agent_integration_permissions 
-- WHERE connection_id IN (
--     SELECT uic.id 
--     FROM user_integration_credentials uic
--     JOIN oauth_providers op ON op.id = uic.oauth_provider_id
--     WHERE op.name = 'gmail'
-- );

-- Step 4: Optionally remove Gmail credentials entirely (uncomment to execute)
-- BE CAREFUL: This will remove all Gmail connections for all users
-- 
-- DELETE FROM user_integration_credentials 
-- WHERE oauth_provider_id IN (
--     SELECT id FROM oauth_providers WHERE name = 'gmail'
-- );

SELECT 'CLEANUP COMMANDS READY - UNCOMMENT TO EXECUTE' as note;
