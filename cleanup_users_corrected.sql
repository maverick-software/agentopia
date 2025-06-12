-- =====================================================================
-- CORRECTED USER CLEANUP SCRIPT - Using actual database schema
-- This script safely deletes users except mail@enspyredigital.com and charles.r.sears@gmail.com
-- =====================================================================

-- Start transaction for safety
BEGIN;

-- 1. Preview: Show users that will be deleted
SELECT 
    'PREVIEW: Users to delete' as action,
    au.id, 
    au.email, 
    au.created_at
FROM auth.users au 
WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- 2. Preview: Show related data that will be deleted
SELECT 
    'PREVIEW: Profiles to delete' as action,
    p.id, 
    p.full_name, 
    p.created_at
FROM public.profiles p
WHERE p.id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

SELECT 
    'PREVIEW: User roles to delete' as action,
    ur.user_id, 
    r.name as role_name
FROM public.user_roles ur
JOIN public.roles r ON ur.role_id = r.id
WHERE ur.user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

SELECT 
    'PREVIEW: Agents to delete' as action,
    a.id, 
    a.name, 
    a.owner_user_id
FROM public.agents a
WHERE a.owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

SELECT 
    'PREVIEW: Workspaces to delete' as action,
    w.id, 
    w.name, 
    w.owner_user_id
FROM public.workspaces w
WHERE w.owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

SELECT 
    'PREVIEW: Account tool instances to delete' as action,
    ati.id, 
    ati.tool_name, 
    ati.owner_user_id
FROM public.account_tool_instances ati
WHERE ati.owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- ROLLBACK NOW TO PREVIEW ONLY (Comment out next line to execute actual deletion)
ROLLBACK;

-- =====================================================================
-- UNCOMMENT THE SECTION BELOW TO EXECUTE ACTUAL DELETION
-- =====================================================================

/*
-- Start fresh transaction for actual deletion
BEGIN;

-- Delete related data first (maintain referential integrity)

-- 1. Delete user roles
DELETE FROM public.user_roles 
WHERE user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 2. Delete profiles (using correct column name 'id')
DELETE FROM public.profiles 
WHERE id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 3. Delete agents owned by these users
DELETE FROM public.agents 
WHERE owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 4. Delete workspaces owned by these users
DELETE FROM public.workspaces 
WHERE owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 5. Delete account tool instances owned by these users
DELETE FROM public.account_tool_instances 
WHERE owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 6. Delete user secrets
DELETE FROM public.user_secrets 
WHERE user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 7. Delete user profiles (additional table)
DELETE FROM public.user_profiles 
WHERE id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 8. Finally, delete the auth users themselves
DELETE FROM auth.users 
WHERE email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- Show final counts
SELECT 
    'RESULT: Remaining users' as action,
    COUNT(*) as count 
FROM auth.users;

SELECT 
    'RESULT: Remaining users detail' as action,
    id, 
    email, 
    created_at 
FROM auth.users;

-- Commit the transaction
COMMIT;
*/ 