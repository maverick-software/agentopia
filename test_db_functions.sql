-- Test if our database functions exist
SELECT 
    routine_name, 
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%temp_chat%' 
   OR routine_name LIKE '%temporary_chat%'
ORDER BY routine_name;

-- Test if our tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%temporary_chat%' 
   OR table_name LIKE '%temp_chat%'
ORDER BY table_name;

-- Test if Vault functions exist
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%vault%'
ORDER BY routine_name;
