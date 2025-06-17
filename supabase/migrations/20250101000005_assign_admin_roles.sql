-- Migration: Assign admin roles to specified users
-- Purpose: Make mail@enspyredigital.com and charles.r.sears@gmail.com admins
-- Date: 2025-01-01

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
    'Admin role assignment completed' as status,
    au.email,
    au.id as user_id,
    r.name as role_name
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE r.name = 'admin'
ORDER BY au.email; 