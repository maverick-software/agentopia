-- Verify ClickSend Integration Status
-- This script checks if ClickSend has been properly integrated

-- Check if ClickSend service provider exists
SELECT 'ClickSend Service Provider' as check_type, 
       CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
       COUNT(*) as count
FROM service_providers 
WHERE name = 'clicksend_sms';

-- Check if ClickSend integration exists in integrations table
SELECT 'ClickSend Integration' as check_type,
       CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
       COUNT(*) as count
FROM integrations 
WHERE name = 'ClickSend SMS';

-- Check if Messaging & Communication category exists
SELECT 'Messaging Category' as check_type,
       CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
       COUNT(*) as count
FROM integration_categories 
WHERE name = 'Messaging & Communication';

-- Check if ClickSend capabilities exist
SELECT 'ClickSend Capabilities' as check_type,
       CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
       COUNT(*) as count
FROM integration_capabilities ic
JOIN service_providers sp ON ic.integration_id = sp.id
WHERE sp.name = 'clicksend_sms';

-- Show detailed ClickSend integration info if it exists
SELECT 
    i.name as integration_name,
    ic.name as category_name,
    i.status,
    i.is_popular,
    i.agent_classification,
    i.created_at
FROM integrations i
JOIN integration_categories ic ON i.category_id = ic.id
WHERE i.name = 'ClickSend SMS';

-- Show ClickSend capabilities if they exist
SELECT 
    ic.capability_key,
    ic.display_label,
    ic.display_order
FROM integration_capabilities ic
JOIN service_providers sp ON ic.integration_id = sp.id
WHERE sp.name = 'clicksend_sms'
ORDER BY ic.display_order;
