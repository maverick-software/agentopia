-- Migration: Seed core roles into the new 'roles' table

-- Seed GLOBAL Roles
INSERT INTO public.roles (name, display_name, description, permissions, role_type) VALUES
    ('SUPER_ADMIN', 'Super Admin', 'Full platform access, manages system settings, users, and clients.', '["platform.*", "client.*"]'::jsonb, 'GLOBAL'),
    ('ADMIN', 'Administrator', 'General administrative access to manage users and clients.', '["platform.users.view", "platform.users.edit", "platform.clients.view_all", "platform.clients.edit", "platform.users.view_assignments"]'::jsonb, 'GLOBAL'),
    ('DEVELOPER', 'Developer', 'Access for development and system maintenance, typically has high-level permissions.', '["platform.*", "client.*"]'::jsonb, 'GLOBAL'),
    ('SUPPORT_REP', 'Support Representative', 'Assists clients and users, typically has broad read access and specific support-related write permissions.', '["platform.clients.view_all", "platform.users.view", "client.view"]'::jsonb, 'GLOBAL'),
    ('CLIENT_USER', 'Client User', 'Base role for an external client user who logs into the platform.', '["client.view"]'::jsonb, 'GLOBAL');
    -- Consider a more restrictive 'DEFAULT_USER' or 'AUTHENTICATED_USER' if 'CLIENT_USER' implies too much by default.
    -- For now, 'CLIENT_USER' maps from the old 'CLIENT' global_role.

-- Seed CLIENT_CONTEXTUAL Role Templates
INSERT INTO public.roles (name, display_name, description, permissions, role_type) VALUES
    ('CLIENT_ADMIN', 'Client Admin', 'Manages a specific client account, including users, roles, content, and projects within that client.',
     '["client.view", "client.edit", "client.users.view", "client.users.create", "client.users.edit", "client.users.delete", "client.users.invite", "client.users.assign_role.*", "client.users.unassign_role", "client.roles.view", "client.roles.create", "client.roles.edit", "client.roles.delete", "client.content.view", "client.content.create", "client.content.edit", "client.content.delete", "client.content.publish", "client.projects.view", "client.projects.create", "client.projects.edit", "client.projects.delete", "client.users.view_assignments"]'::jsonb,
     'CLIENT_CONTEXTUAL'),
    ('CLIENT_MANAGER', 'Client Manager', 'Manages content and projects within a specific client account, can view users.',
     '["client.view", "client.users.view", "client.content.view", "client.content.create", "client.content.edit", "client.content.delete", "client.content.publish", "client.projects.view", "client.projects.create", "client.projects.edit", "client.projects.delete"]'::jsonb,
     'CLIENT_CONTEXTUAL'),
    ('CLIENT_VIEWER', 'Client Viewer', 'Read-only access to a specific client account.',
     '["client.view", "client.users.view", "client.roles.view", "client.content.view", "client.projects.view"]'::jsonb,
     'CLIENT_CONTEXTUAL');

-- RAISE NOTICE 'Core roles seeded successfully.'; 