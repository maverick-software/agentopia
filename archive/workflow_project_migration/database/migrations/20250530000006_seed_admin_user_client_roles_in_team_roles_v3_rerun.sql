DO $$
DECLARE
    admin_profile RECORD;
    client_record RECORD;
    client_admin_role_id_var UUID;
    auth_user_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting team_roles seeding script (v3 rerun - with team_members prerequisite).';

    FOR admin_profile IN
        SELECT auth_user_id FROM profiles WHERE global_role IN ('SUPER_ADMIN', 'ADMIN')
    LOOP
        RAISE NOTICE 'Processing admin_profile with auth_user_id: %', admin_profile.auth_user_id;

        SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_profile.auth_user_id) INTO auth_user_exists;
        RAISE NOTICE 'auth_user_exists for %: %', admin_profile.auth_user_id, auth_user_exists;

        IF auth_user_exists THEN
            FOR client_record IN
                SELECT id FROM clients
            LOOP
                RAISE NOTICE '  Processing client_record with id: % for user: %', client_record.id, admin_profile.auth_user_id;

                RAISE NOTICE '    Attempting to ensure entry in team_members for user_id=%, client_id=%', admin_profile.auth_user_id, client_record.id;
                BEGIN
                    INSERT INTO team_members (auth_user_id, client_id, status)
                    VALUES (admin_profile.auth_user_id, client_record.id, 'ACTIVE')
                    ON CONFLICT (auth_user_id, client_id) DO NOTHING;
                    RAISE NOTICE '    team_members entry ensured/existed for user: %, client: %', admin_profile.auth_user_id, client_record.id;
                EXCEPTION
                    WHEN undefined_table THEN
                        RAISE WARNING 'team_members table does not exist. Cannot create prerequisite link for team_roles. Skipping for user %, client %.', admin_profile.auth_user_id, client_record.id;
                        CONTINUE;
                    WHEN others THEN
                        RAISE WARNING 'Error ensuring team_members entry for user %, client %: %', admin_profile.auth_user_id, client_record.id, SQLERRM;
                        CONTINUE;
                END;

                SELECT id INTO client_admin_role_id_var
                FROM client_roles
                WHERE client_id = client_record.id AND role_name = 'Client Admin'
                LIMIT 1;

                IF client_admin_role_id_var IS NOT NULL THEN
                    RAISE NOTICE '    Found Client Admin role_id: % for client: %', client_admin_role_id_var, client_record.id;
                    RAISE NOTICE '    Attempting to insert into team_roles: user_id=%, client_id=%, role_id=%', admin_profile.auth_user_id, client_record.id, client_admin_role_id_var;
                    
                    INSERT INTO team_roles (team_member_auth_user_id, client_id, client_role_id)
                    SELECT admin_profile.auth_user_id, client_record.id, client_admin_role_id_var
                    WHERE NOT EXISTS (
                        SELECT 1 FROM team_roles
                        WHERE team_member_auth_user_id = admin_profile.auth_user_id
                          AND client_id = client_record.id
                          AND client_role_id = client_admin_role_id_var
                    );
                    RAISE NOTICE '    Insertion into team_roles attempt completed for user: %, client: %', admin_profile.auth_user_id, client_record.id;
                ELSE
                    RAISE NOTICE '    Client Admin role not found for client_id: % for user: %', client_record.id, admin_profile.auth_user_id;
                END IF;
            END LOOP;
        ELSE
            RAISE NOTICE 'User ID % from profiles not found in auth.users. Skipping team_roles seeding for this user.', admin_profile.auth_user_id;
        END IF;
    END LOOP;
    RAISE NOTICE 'Finished team_roles seeding script (v3 rerun).';
END $$; 