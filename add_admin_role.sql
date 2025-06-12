-- First, check if the admin role exists
SELECT * FROM roles WHERE name = 'admin';

-- If it doesn't exist, create it
INSERT INTO roles (name, display_name, description, permissions, role_type) 
VALUES ('admin', 'Administrator', 'Full system administrator', '["admin:all"]', 'GLOBAL')
ON CONFLICT (name) DO NOTHING;

-- Check current user (you'll need to replace this with your actual user ID)
-- You can get your user ID by going to the app and checking the browser console
-- or by logging in and checking the network tab for your user ID

-- Example of how to add admin role to a user (replace USER_ID with your actual user ID):
-- INSERT INTO user_roles (user_id, role_id) 
-- SELECT 'YOUR_USER_ID_HERE', id FROM roles WHERE name = 'admin'
-- ON CONFLICT DO NOTHING;

-- To find your user ID, run this after logging in:
-- SELECT auth.uid(); -- This will show your current user ID when run in Supabase SQL editor

-- Check all users and their roles
SELECT 
    u.email,
    u.id as user_id,
    r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
ORDER BY u.email; 