-- Check Angela's Gmail permissions and connections
-- Part 1: Find Angela
SELECT 'ANGELA AGENT INFO:' as check_type;
SELECT id as agent_id, name, user_id 
FROM agents 
WHERE name ILIKE '%angela%';

-- Part 2: Check for Gmail integration permissions
SELECT 'GMAIL INTEGRATION PERMISSIONS:' as check_type;
SELECT 
    aip.id as permission_id,
    aip.agent_id,
    aip.is_active,
    aip.allowed_scopes,
    uic.connection_name,
    uic.vault_access_token_id,
    op.name as provider_name
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON uic.id = aip.connection_id  
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE aip.agent_id IN (SELECT id FROM agents WHERE name ILIKE '%angela%')
  AND op.name = 'gmail';

-- Part 3: Check for ANY Gmail credentials for Angela's user
SELECT 'ALL GMAIL CREDENTIALS:' as check_type;
SELECT 
    uic.id,
    uic.connection_name,
    uic.external_username,
    uic.vault_access_token_id,
    uic.connection_status,
    uic.credential_type,
    uic.created_at,
    op.name as provider_name
FROM user_integration_credentials uic
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE uic.user_id IN (SELECT user_id FROM agents WHERE name ILIKE '%angela%')
  AND op.name = 'gmail';

-- Part 4: Check for email relay permissions (should exist)
SELECT 'EMAIL RELAY PERMISSIONS:' as check_type;
SELECT 
    aip.id as permission_id,
    aip.agent_id,
    aip.is_active,
    uic.connection_name,
    op.name as provider_name
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN oauth_providers op ON op.id = uic.oauth_provider_id
WHERE aip.agent_id IN (SELECT id FROM agents WHERE name ILIKE '%angela%')
  AND op.name IN ('smtp', 'sendgrid', 'mailgun');
