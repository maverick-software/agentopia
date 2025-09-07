-- DROP OLD SMTP TABLES - They're replaced by unified agent_integration_permissions system

-- ==============================================
-- SHOW WHAT TABLES WE'RE ABOUT TO DROP
-- ==============================================
SELECT 'OLD SMTP TABLES TO BE DROPPED:' as action;

-- Check if tables exist and show their content count
SELECT 
    'agent_smtp_permissions' as table_name,
    COUNT(*) as record_count,
    'OLD - replaced by agent_integration_permissions' as status
FROM agent_smtp_permissions
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_smtp_permissions');

SELECT 
    'smtp_configurations' as table_name, 
    COUNT(*) as record_count,
    'OLD - replaced by user_integration_credentials' as status
FROM smtp_configurations  
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smtp_configurations');

-- ==============================================
-- BACKUP DATA BEFORE DROPPING (OPTIONAL)
-- ==============================================
-- Uncomment if you want to backup data first:
-- 
-- CREATE TABLE IF NOT EXISTS backup_agent_smtp_permissions AS 
-- SELECT * FROM agent_smtp_permissions;
-- 
-- CREATE TABLE IF NOT EXISTS backup_smtp_configurations AS 
-- SELECT * FROM smtp_configurations;

-- ==============================================
-- DROP OLD SMTP TABLES
-- ==============================================
-- Uncomment the following lines to execute the drops:

-- Drop dependent objects first
-- DROP TRIGGER IF EXISTS update_agent_smtp_permissions_updated_at ON agent_smtp_permissions;
-- DROP TRIGGER IF EXISTS update_smtp_configurations_updated_at ON smtp_configurations;

-- Drop foreign key constraints
-- ALTER TABLE IF EXISTS agent_smtp_permissions DROP CONSTRAINT IF EXISTS agent_smtp_permissions_agent_id_fkey;
-- ALTER TABLE IF EXISTS agent_smtp_permissions DROP CONSTRAINT IF EXISTS agent_smtp_permissions_smtp_config_id_fkey;

-- Drop the tables
-- DROP TABLE IF EXISTS agent_smtp_permissions CASCADE;
-- DROP TABLE IF EXISTS smtp_configurations CASCADE;

-- ==============================================
-- VERIFY UNIFIED SYSTEM IS WORKING
-- ==============================================
SELECT 'UNIFIED SYSTEM VERIFICATION:' as check_type;

-- Show SMTP permissions in unified system
SELECT 
    a.name as agent_name,
    op.name as provider_name,
    uic.connection_name,
    aip.allowed_scopes,
    'UNIFIED SYSTEM ✅' as system
FROM agent_integration_permissions aip
JOIN agents a ON a.id = aip.agent_id
JOIN user_integration_credentials uic ON uic.id = aip.connection_id
JOIN service_providers op ON op.id = uic.oauth_provider_id
WHERE op.name = 'smtp'
  AND aip.is_active = true
LIMIT 5;

SELECT 'CLEANUP COMPLETE - OLD SMTP TABLES WILL BE DROPPED' as final_status;
