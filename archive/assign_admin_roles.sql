-- =====================================================================
-- ASSIGN ADMIN ROLES TO SPECIFIED USERS
-- This script assigns admin role to mail@enspyredigital.com and charles.r.sears@gmail.com
-- =====================================================================

-- Start transaction for safety
BEGIN;

-- 1. Preview: Show current admin role assignments
SELECT 
    'CURRENT ADMIN USERS' as info,
    au.email,
    au.id as user_id,
    r.name as role_name,
    ur.created_at as role_assigned_at
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE r.name = 'admin';

-- 2. Preview: Show the users we want to make admin
SELECT 
    'USERS TO MAKE ADMIN' as info,
    au.email,
    au.id as user_id,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.user_roles ur 
            JOIN public.roles r ON ur.role_id = r.id 
            WHERE ur.user_id = au.id AND r.name = 'admin'
        ) THEN 'Already Admin'
        ELSE 'Will be assigned Admin'
    END as current_status
FROM auth.users au
WHERE au.email IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com');

-- 3. Preview: Show admin role details
SELECT 
    'ADMIN ROLE DETAILS' as info,
    r.id as role_id,
    r.name,
    r.description,
    r.created_at
FROM public.roles r
WHERE r.name = 'admin';

-- Commit preview transaction
COMMIT;

-- =====================================================================
-- EXECUTION SECTION - Assign admin roles
-- =====================================================================

-- Start execution transaction
BEGIN;

-- Insert admin role assignments for both users (ignore if already exists)
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
    au.id as user_id,
    r.id as role_id
FROM auth.users au
CROSS JOIN public.roles r
WHERE au.email IN ('mail@enspyredigital.com', 'charles.r.sears@gmail.com')
  AND r.name = 'admin'
  AND NOT EXISTS (
    -- Only insert if not already assigned
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = au.id AND ur2.role_id = r.id
  );

-- Show results
SELECT 
    'FINAL ADMIN USERS' as result,
    au.email,
    au.id as user_id,
    r.name as role_name,
    ur.created_at as role_assigned_at
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE r.name = 'admin'
ORDER BY ur.created_at;

-- Show success message
SELECT 
    'SUCCESS' as status,
    'Admin roles have been assigned to both users' as message,
    COUNT(*) as total_admin_users
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE r.name = 'admin';

-- Commit the changes
COMMIT; 