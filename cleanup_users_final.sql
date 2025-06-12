-- =====================================================================
-- FINAL USER CLEANUP SCRIPT - Using actual database schema column names
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
    a.user_id
FROM public.agents a
WHERE a.user_id IN (
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

-- Check if account_tool_instances table exists and preview records to delete
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'account_tool_instances'
    ) THEN
        RAISE NOTICE 'PREVIEW: Account tool instances table exists - checking for records to delete';
        PERFORM 1 FROM public.account_tool_instances ati
        JOIN public.account_tool_environments ate ON ati.account_tool_environment_id = ate.id
        JOIN auth.users au ON ate.user_id = au.id
        WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');
        
        IF FOUND THEN
            RAISE NOTICE 'Found account tool instances to delete for users being removed';
        ELSE
            RAISE NOTICE 'No account tool instances found for users being removed';
        END IF;
    ELSE
        RAISE NOTICE 'PREVIEW: Account tool instances table does not exist - skipping';
    END IF;
END $$;

-- ROLLBACK NOW TO PREVIEW ONLY (Comment out next line to execute actual deletion)
ROLLBACK;

-- =====================================================================
-- UNCOMMENT THE SECTION BELOW TO EXECUTE ACTUAL DELETION
-- =====================================================================


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

-- 3. Delete agents owned by these users (using correct column name 'user_id')
DELETE FROM public.agents 
WHERE user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 4. Delete workspaces owned by these users (correct column name 'owner_user_id')
DELETE FROM public.workspaces 
WHERE owner_user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 5. Delete account tool instances if table exists (using proper JOIN through account_tool_environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'account_tool_instances'
    ) THEN
        DELETE FROM public.account_tool_instances 
        WHERE account_tool_environment_id IN (
            SELECT ate.id 
            FROM public.account_tool_environments ate
            JOIN auth.users au ON ate.user_id = au.id
            WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
        );
    END IF;
END $$;

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

-- 8. Delete workspace members
DELETE FROM public.workspace_members 
WHERE user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 9. Delete team memberships
DELETE FROM public.user_team_memberships 
WHERE user_id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email NOT IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
);

-- 10. Finally, delete the auth users themselves
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
 