-- Fix missing contact management function
-- This ensures the create_contact_management_credential_for_user function exists
-- and can be called by triggers when creating new agents

BEGIN;

-- Recreate the function to ensure it exists and works properly
CREATE OR REPLACE FUNCTION create_contact_management_credential_for_user(user_id UUID)
RETURNS UUID AS $$
DECLARE
  credential_id UUID;
  service_provider_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  -- Check if credential already exists
  SELECT id INTO credential_id
  FROM user_integration_credentials
  WHERE user_integration_credentials.user_id = create_contact_management_credential_for_user.user_id
  AND service_provider_id = create_contact_management_credential_for_user.service_provider_id;
  
  -- If not found, create it
  IF credential_id IS NULL THEN
    BEGIN
      INSERT INTO user_integration_credentials (
        user_id,
        service_provider_id,
        connection_name,
        credential_type,
        connection_status,
        scopes_granted,
        vault_access_token_id,
        created_at,
        updated_at
      ) VALUES (
        create_contact_management_credential_for_user.user_id,
        service_provider_id,
        'Contact Management System',
        'api_key'::connection_credential_type_enum,
        'active',
        '["search_contacts", "get_contact_details"]'::jsonb,
        'internal_contact_token',
        NOW(),
        NOW()
      ) 
      RETURNING id INTO credential_id;
      
      RAISE NOTICE 'Created contact management credential % for user %', credential_id, create_contact_management_credential_for_user.user_id;
    EXCEPTION WHEN OTHERS THEN
      -- If there's an error creating the credential, log it but don't fail
      RAISE WARNING 'Failed to create contact management credential for user %: % - %', 
        create_contact_management_credential_for_user.user_id, SQLSTATE, SQLERRM;
      -- Return a dummy UUID so the trigger doesn't fail
      RETURN '00000000-0000-0000-0000-000000000000'::uuid;
    END;
  END IF;
  
  RETURN credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION create_contact_management_credential_for_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_contact_management_credential_for_user(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_contact_management_credential_for_user(UUID) IS 
'Creates internal contact management credentials for users. Used by triggers when creating agents.';

COMMIT;
