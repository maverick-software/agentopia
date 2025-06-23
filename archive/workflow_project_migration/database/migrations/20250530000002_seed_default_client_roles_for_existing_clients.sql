DO $$
DECLARE
    client_record RECORD;
    client_admin_permissions TEXT[];
    manager_permissions TEXT[];
BEGIN
    -- Define permissions for Client Admin
    client_admin_permissions := ARRAY[
        'client.view',
        'client.edit',
        'client.users.view',
        'client.users.invite',
        'client.users.manage',
        'client.users.assign_role.manager',
        'client.roles.view',
        'client.content.manage',
        'client.projects.manage'
    ];

    -- Define permissions for Manager
    manager_permissions := ARRAY[
        'client.view',
        'client.content.manage',
        'client.projects.manage',
        'client.users.view'
    ];

    FOR client_record IN SELECT id FROM clients
    LOOP
        -- Seed 'Client Admin' role if it doesn't exist for this client
        IF NOT EXISTS (
            SELECT 1 FROM client_roles
            WHERE client_id = client_record.id AND role_name = 'Client Admin'
        ) THEN
            INSERT INTO client_roles (client_id, role_name, permissions)
            VALUES (client_record.id, 'Client Admin', to_jsonb(client_admin_permissions));
        END IF;

        -- Seed 'Manager' role if it doesn't exist for this client
        IF NOT EXISTS (
            SELECT 1 FROM client_roles
            WHERE client_id = client_record.id AND role_name = 'Manager'
        ) THEN
            INSERT INTO client_roles (client_id, role_name, permissions)
            VALUES (client_record.id, 'Manager', to_jsonb(manager_permissions));
        END IF;
    END LOOP;
END $$; 