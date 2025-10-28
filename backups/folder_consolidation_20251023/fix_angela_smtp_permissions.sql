-- Fix Angela's SMTP permissions to include proper scopes
-- This addresses the issue where SMTP provider shows 0 scopes

-- First, let's check the current state
SELECT 
    aip.id,
    aip.agent_id,
    aip.allowed_scopes,
    aip.is_active,
    uic.connection_name,
    op.name as provider_name,
    op.display_name as provider_display_name
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON aip.credential_id = uic.id
JOIN service_providers op ON uic.oauth_provider_id = op.id
WHERE aip.agent_id = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'  -- Angela's agent ID from logs
  AND op.name = 'smtp'
  AND aip.is_active = true;

-- Update the SMTP permissions to include the proper scopes
UPDATE agent_integration_permissions 
SET 
    allowed_scopes = '["send_email", "email_templates", "email_stats"]'::jsonb,
    updated_at = NOW()
WHERE id IN (
    SELECT aip.id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.credential_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE aip.agent_id = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'  -- Angela's agent ID
      AND op.name = 'smtp'
      AND aip.is_active = true
);

-- Verify the update
SELECT 
    aip.id,
    aip.agent_id,
    aip.allowed_scopes,
    aip.is_active,
    uic.connection_name,
    op.name as provider_name,
    op.display_name as provider_display_name,
    aip.updated_at
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON aip.credential_id = uic.id
JOIN service_providers op ON uic.oauth_provider_id = op.id
WHERE aip.agent_id = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'  -- Angela's agent ID
  AND op.name = 'smtp'
  AND aip.is_active = true;
