-- Update role permissions to match new APP_PERMISSIONS structure
-- This migration maps old permission format to new structured permissions

-- Update SUPER_ADMIN role
UPDATE roles 
SET permissions = '["platform.admin.pages.view.user_management", "platform.admin.pages.view.role_management", "platform.admin.pages.view.client_management", "platform.admin.users.manage", "platform.admin.roles.manage_definitions", "platform.admin.clients.manage_accounts", "platform.admin.system.impersonate_clients"]'::jsonb
WHERE name = 'SUPER_ADMIN';

-- Update SITE_MANAGER role
UPDATE roles 
SET permissions = '["platform.admin.pages.view.user_management", "platform.admin.pages.view.client_management", "platform.admin.users.manage", "platform.admin.clients.manage_accounts"]'::jsonb
WHERE name = 'SITE_MANAGER';

-- Update CLIENT_ADMIN role
UPDATE roles 
SET permissions = '["client.context.pages.view.dashboard", "client.context.pages.view.users", "client.context.pages.view.projects", "client.context.pages.view.content", "client.context.pages.view.settings", "client.context.users.invite", "client.context.users.manage_members", "client.context.users.assign_roles", "client.context.projects.create", "client.context.projects.edit", "client.context.projects.delete", "client.context.projects.manage_all", "client.context.content.create", "client.context.content.edit", "client.context.content.delete", "client.context.content.publish", "client.context.content.manage_all", "client.context.settings.manage"]'::jsonb
WHERE name = 'CLIENT_ADMIN';

-- Update CLIENT_MANAGER role
UPDATE roles 
SET permissions = '["client.context.pages.view.dashboard", "client.context.pages.view.users", "client.context.pages.view.projects", "client.context.pages.view.content", "client.context.projects.create", "client.context.projects.edit", "client.context.projects.delete", "client.context.projects.manage_all", "client.context.content.create", "client.context.content.edit", "client.context.content.delete", "client.context.content.publish", "client.context.content.manage_all"]'::jsonb
WHERE name = 'CLIENT_MANAGER';

-- Update CLIENT_VIEWER role
UPDATE roles 
SET permissions = '["client.context.pages.view.dashboard", "client.context.pages.view.users", "client.context.pages.view.projects", "client.context.pages.view.content"]'::jsonb
WHERE name = 'CLIENT_VIEWER';

-- CLIENT_USER role already has empty permissions array, so no update needed
