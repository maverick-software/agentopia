-- Create missing handle_integration_deletion_cascade function
-- This function was referenced in earlier migrations but never created
-- Purpose: Handle cleanup when service providers are deleted

CREATE OR REPLACE FUNCTION handle_integration_deletion_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the deletion for debugging
    RAISE NOTICE 'Service provider deleted: % (ID: %)', OLD.name, OLD.id;
    
    -- Clean up related integration_capabilities
    DELETE FROM integration_capabilities 
    WHERE integration_id = OLD.id;
    
    -- Clean up related user_integration_credentials
    DELETE FROM user_integration_credentials 
    WHERE oauth_provider_id = OLD.id;
    
    -- Clean up related agent_integration_permissions
    DELETE FROM agent_integration_permissions 
    WHERE user_oauth_connection_id IN (
        SELECT id FROM user_integration_credentials 
        WHERE oauth_provider_id = OLD.id
    );
    
    -- Log completion
    RAISE NOTICE 'Cleanup completed for service provider: %', OLD.name;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_integration_deletion_cascade() TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION handle_integration_deletion_cascade() IS 
'Handles cascade deletion cleanup when service providers are removed';

-- Verify the function was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_integration_deletion_cascade'
    ) THEN
        RAISE NOTICE '✅ Function handle_integration_deletion_cascade() created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create handle_integration_deletion_cascade() function';
    END IF;
END $$;
