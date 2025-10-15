-- Verify the OneDrive connection exists in the database
SELECT 
    uic.id,
    uic.connection_name,
    uic.connection_status,
    uic.external_username,
    sp.name as provider_name,
    sp.display_name as provider_display_name,
    uic.created_at
FROM user_integration_credentials uic
JOIN service_providers sp ON uic.oauth_provider_id = sp.id
WHERE sp.name = 'microsoft-onedrive'
ORDER BY uic.created_at DESC;
