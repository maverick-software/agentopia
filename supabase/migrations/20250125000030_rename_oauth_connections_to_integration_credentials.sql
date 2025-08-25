-- Migration: Rename user_oauth_connections to user_integration_credentials
-- Purpose: Fix misleading table name that stores both OAuth tokens AND API keys
-- Date: January 25, 2025
-- 
-- This migration renames the table to accurately reflect its dual purpose
-- of storing all types of integration credentials (OAuth and API keys)

BEGIN;

-- Step 1: Rename the main table
ALTER TABLE user_oauth_connections 
RENAME TO user_integration_credentials;

-- Step 2: Update table comment to reflect true purpose
COMMENT ON TABLE user_integration_credentials IS 
'Centralized secure storage for all integration credentials (OAuth tokens and API keys) using Supabase Vault encryption';

-- Step 3: Update column comments for clarity
COMMENT ON COLUMN user_integration_credentials.vault_access_token_id IS 
'Vault UUID reference for OAuth access token or API key (never store plain text)';

COMMENT ON COLUMN user_integration_credentials.vault_refresh_token_id IS 
'Vault UUID reference for OAuth refresh token (NULL for API keys)';

COMMENT ON COLUMN user_integration_credentials.credential_type IS 
'Type of credential: oauth (has refresh token) or api_key (long-lived, no refresh)';

COMMENT ON COLUMN user_integration_credentials.token_expires_at IS 
'Expiration timestamp for OAuth tokens (NULL for non-expiring API keys)';

-- Step 4: Rename constraints to match new table name
ALTER TABLE user_integration_credentials
RENAME CONSTRAINT user_oauth_connections_pkey TO user_integration_credentials_pkey;

ALTER TABLE user_integration_credentials
RENAME CONSTRAINT user_oauth_connections_connection_status_check 
TO user_integration_credentials_connection_status_check;

-- Step 5: Update indexes to match new naming
ALTER INDEX idx_user_oauth_connections_user_id 
RENAME TO idx_user_integration_credentials_user_id;

ALTER INDEX idx_user_oauth_connections_provider 
RENAME TO idx_user_integration_credentials_provider;

ALTER INDEX idx_user_oauth_connections_status 
RENAME TO idx_user_integration_credentials_status;

ALTER INDEX idx_user_oauth_connections_credential_type 
RENAME TO idx_user_integration_credentials_credential_type;

-- Step 6: Create backward compatibility view for existing code
-- This allows gradual migration without breaking existing queries
CREATE VIEW user_oauth_connections AS 
SELECT 
    id,
    user_id,
    oauth_provider_id,
    external_user_id,
    external_username,
    scopes_granted,
    connection_name,
    vault_access_token_id,
    vault_refresh_token_id,
    token_expires_at,
    last_token_refresh,
    connection_status,
    connection_metadata,
    created_at,
    updated_at,
    encrypted_access_token,
    encrypted_refresh_token,
    credential_type
FROM user_integration_credentials;

-- Grant same permissions to the view
GRANT ALL ON user_oauth_connections TO authenticated;
GRANT ALL ON user_oauth_connections TO service_role;

COMMENT ON VIEW user_oauth_connections IS 
'DEPRECATED: Backward compatibility view - use user_integration_credentials directly';

-- Step 7: Update agent_oauth_permissions table name and references
-- This table also has a misleading name since it handles both OAuth and API key permissions

-- First, check if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        -- Rename the table
        ALTER TABLE agent_oauth_permissions 
        RENAME TO agent_integration_permissions;

        -- Update table comment
        COMMENT ON TABLE agent_integration_permissions IS 
        'Agent-specific permissions for integration credentials (OAuth and API keys)';

        -- Rename the foreign key constraint
        ALTER TABLE agent_integration_permissions
        RENAME CONSTRAINT agent_oauth_permissions_connection_id_fkey 
        TO agent_integration_permissions_credential_id_fkey;

        -- Rename the column for clarity
        ALTER TABLE agent_integration_permissions
        RENAME COLUMN connection_id TO credential_id;

        -- Create backward compatibility view
        CREATE VIEW agent_oauth_permissions AS 
        SELECT 
            id,
            agent_id,
            credential_id as connection_id,  -- Map back to old column name
            allowed_scopes,
            permission_level,
            is_active,
            created_at,
            updated_at
        FROM agent_integration_permissions;

        -- Grant permissions
        GRANT ALL ON agent_oauth_permissions TO authenticated;
        GRANT ALL ON agent_oauth_permissions TO service_role;

        COMMENT ON VIEW agent_oauth_permissions IS 
        'DEPRECATED: Backward compatibility view - use agent_integration_permissions directly';
    END IF;
END $$;

-- Step 8: Update RLS policies to reference new table name
-- Note: Policies are automatically updated when table is renamed

-- Step 9: Update functions that reference the old table name
-- Update any functions that explicitly reference user_oauth_connections

-- Update get_user_oauth_connections function
DROP FUNCTION IF EXISTS public.get_user_oauth_connections(UUID);

CREATE OR REPLACE FUNCTION public.get_user_integration_credentials(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    credential_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    credential_type TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as credential_id,
        p.name as provider_name,
        p.display_name as provider_display_name,
        c.external_username,
        c.connection_name,
        c.scopes_granted,
        c.connection_status,
        c.credential_type::TEXT,
        c.token_expires_at,
        c.created_at,
        c.updated_at
    FROM user_integration_credentials c
    JOIN oauth_providers p ON c.oauth_provider_id = p.id
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC;
END;
$$;

-- Create wrapper function with old name for backward compatibility
CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    connection_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    credential_type TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delegate to the new function
    RETURN QUERY
    SELECT * FROM get_user_integration_credentials(p_user_id);
END;
$$;

COMMENT ON FUNCTION get_user_oauth_connections IS 
'DEPRECATED: Use get_user_integration_credentials instead';

-- Step 10: Create helper function to check credential storage security
CREATE OR REPLACE FUNCTION public.verify_credential_vault_storage()
RETURNS TABLE(
    credential_type TEXT,
    total_count BIGINT,
    vault_stored BIGINT,
    plain_text BIGINT,
    security_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.credential_type::TEXT,
        COUNT(*) as total_count,
        COUNT(CASE 
            WHEN c.vault_access_token_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN 1 
        END) as vault_stored,
        COUNT(CASE 
            WHEN c.vault_access_token_id IS NOT NULL 
            AND c.vault_access_token_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN 1 
        END) as plain_text,
        CASE 
            WHEN COUNT(CASE 
                WHEN c.vault_access_token_id IS NOT NULL 
                AND c.vault_access_token_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN 1 
            END) > 0 THEN '⚠️ INSECURE - Plain text found'
            ELSE '✅ SECURE - All using vault'
        END as security_status
    FROM user_integration_credentials c
    WHERE c.connection_status = 'active'
    GROUP BY c.credential_type;
END;
$$;

COMMENT ON FUNCTION verify_credential_vault_storage IS 
'Verify that all integration credentials are properly stored in vault (no plain text)';

-- Step 11: Add trigger to ensure new credentials always use vault
CREATE OR REPLACE FUNCTION public.ensure_vault_storage()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if vault_access_token_id looks like plain text (not a UUID)
    IF NEW.vault_access_token_id IS NOT NULL 
       AND NEW.vault_access_token_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND NEW.vault_access_token_id !~ '^ya29\.' -- Allow OAuth tokens that start with ya29 (Google)
    THEN
        RAISE EXCEPTION 'Security Error: API keys and tokens must be stored in vault. Use create_vault_secret() to encrypt credentials.';
    END IF;
    
    -- Same check for refresh token
    IF NEW.vault_refresh_token_id IS NOT NULL 
       AND NEW.vault_refresh_token_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND NEW.credential_type = 'oauth'
    THEN
        RAISE EXCEPTION 'Security Error: Refresh tokens must be stored in vault. Use create_vault_secret() to encrypt credentials.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new inserts (disable for now to avoid breaking existing flows)
-- Uncomment after all code is updated to use vault
-- CREATE TRIGGER ensure_vault_storage_trigger
-- BEFORE INSERT OR UPDATE ON user_integration_credentials
-- FOR EACH ROW
-- EXECUTE FUNCTION ensure_vault_storage();

-- Step 12: Create audit log for credential access
CREATE TABLE IF NOT EXISTS credential_access_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    credential_id UUID REFERENCES user_integration_credentials(id) ON DELETE CASCADE,
    accessed_by UUID, -- User or service that accessed the credential
    access_type TEXT CHECK (access_type IN ('create', 'read', 'update', 'delete', 'decrypt')),
    access_context JSONB, -- Additional context (agent_id, function_name, etc.)
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credential_access_log_credential ON credential_access_log(credential_id);
CREATE INDEX idx_credential_access_log_time ON credential_access_log(created_at);

COMMENT ON TABLE credential_access_log IS 
'Audit log for tracking all access to integration credentials for security compliance';

-- Step 13: Summary comment
COMMENT ON SCHEMA public IS 
'Public schema - Note: user_oauth_connections renamed to user_integration_credentials for clarity';

COMMIT;

-- Post-migration verification
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verify the new table exists
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integration_credentials';
    
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: user_integration_credentials table not found';
    END IF;
    
    -- Verify backward compatibility view exists
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'user_oauth_connections';
    
    IF v_count = 0 THEN
        RAISE WARNING 'Backward compatibility view user_oauth_connections not created';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully. Table renamed from user_oauth_connections to user_integration_credentials';
    RAISE NOTICE 'Run SELECT * FROM verify_credential_vault_storage() to check security status';
END $$;
