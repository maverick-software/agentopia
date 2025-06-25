-- CORRECTED USER CLEANUP SCRIPT
-- First, let's check the actual column names in the profiles table

-- Check the structure of the profiles table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check a sample profile record to see the structure
SELECT * FROM profiles LIMIT 1;

-- CORRECTED CLEANUP SCRIPT
-- Based on common patterns, the column is likely 'id' or 'user_id'

BEGIN;

-- Delete related records first (to avoid foreign key constraint errors)

-- 1. Delete user_roles for users to be deleted
DELETE FROM user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 2. Delete profiles for users to be deleted (CORRECTED)
-- Try with 'id' column (most common pattern)
DELETE FROM profiles 
WHERE id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- Alternative: If the above fails, try with 'user_id' column
-- DELETE FROM profiles 
-- WHERE user_id IN (
--     SELECT id FROM auth.users 
--     WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
-- );

-- 3. Delete agents owned by users to be deleted
DELETE FROM agents 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 4. Delete workspaces owned by users to be deleted  
DELETE FROM workspaces 
WHERE created_by IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 5. Delete account_tool_instances for users to be deleted
DELETE FROM account_tool_instances 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 6. Delete datastores owned by users to be deleted
DELETE FROM datastores 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 7. Delete teams owned by users to be deleted
DELETE FROM teams 
WHERE created_by IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 8. Finally, delete the auth.users records
DELETE FROM auth.users 
WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- Verify the cleanup worked
SELECT 
    COUNT(*) as remaining_users,
    string_agg(email, ', ') as remaining_emails
FROM auth.users;

COMMIT; 