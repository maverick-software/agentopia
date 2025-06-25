-- SAFE USER CLEANUP SCRIPT
-- This script will delete all users except mail@enspyredigital.com and charles.r.sears@gmail.com

-- =====================================================
-- STEP 1: PREVIEW - See what will be deleted
-- =====================================================

-- Show users that will be KEPT (should be only 2)
SELECT 
    id,
    email,
    created_at,
    'WILL BE KEPT' as action
FROM auth.users 
WHERE email IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
ORDER BY email;

-- Show users that will be DELETED
SELECT 
    id,
    email,
    created_at,
    'WILL BE DELETED' as action
FROM auth.users 
WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
ORDER BY email;

-- Count check
SELECT 
    COUNT(*) FILTER (WHERE email IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')) as users_to_keep,
    COUNT(*) FILTER (WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')) as users_to_delete,
    COUNT(*) as total_users
FROM auth.users;

-- =====================================================
-- STEP 2: CHECK RELATED DATA
-- =====================================================

-- Check user_roles that will be affected
SELECT 
    ur.user_id,
    u.email,
    r.name as role_name,
    'user_roles - will be deleted' as table_affected
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
JOIN roles r ON ur.role_id = r.id
WHERE u.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- Check profiles that will be affected
SELECT 
    p.id,
    p.auth_user_id,
    u.email,
    'profiles - will be deleted' as table_affected
FROM profiles p
JOIN auth.users u ON p.auth_user_id = u.id
WHERE u.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- =====================================================
-- STEP 3: ACTUAL CLEANUP (Uncomment when ready)
-- =====================================================

-- IMPORTANT: Review the preview results above before running the deletion!
-- Uncomment the lines below ONLY after you've verified the preview looks correct.


BEGIN;

-- Delete related records first (to avoid foreign key constraint errors)

-- 1. Delete user_roles for users to be deleted
DELETE FROM user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 2. Delete profiles for users to be deleted
DELETE FROM profiles 
WHERE auth_user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 3. Delete from any other tables that reference auth.users
-- Add more DELETE statements here for other tables that reference users

-- 4. Delete agents owned by users to be deleted
DELETE FROM agents 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 5. Delete workspaces owned by users to be deleted  
DELETE FROM workspaces 
WHERE created_by IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 6. Delete account_tool_instances for users to be deleted
DELETE FROM account_tool_instances 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 7. Finally, delete the auth.users records
DELETE FROM auth.users 
WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- Verify the cleanup worked
SELECT 
    COUNT(*) as remaining_users,
    string_agg(email, ', ') as remaining_emails
FROM auth.users;

COMMIT;

-- =====================================================
-- STEP 4: POST-CLEANUP VERIFICATION (Run after cleanup)
-- =====================================================

-- Verify only the correct users remain
SELECT 
    id,
    email,
    created_at
FROM auth.users 
ORDER BY email;

-- Verify no orphaned records in related tables
SELECT 
    'user_roles' as table_name,
    COUNT(*) as record_count
FROM user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id)

UNION ALL

SELECT 
    'profiles' as table_name,
    COUNT(*) as record_count  
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.auth_user_id); 