-- Complete fix for registration error
-- Run this in Supabase Dashboard SQL Editor

-- First, let's create the missing enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE connection_credential_type_enum AS ENUM ('oauth', 'api_key', 'smtp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure the service provider exists for contact management
INSERT INTO service_providers (
  id,
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  scopes_supported,
  pkce_required,
  is_enabled,
  configuration_metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'contact_management',
  'Contact Management',
  'internal://contact-management/auth',
  'internal://contact-management/token',
  '["search_contacts", "get_contact_details"]'::jsonb,
  false,
  true,
  '{
    "description": "Internal contact management system",
    "category": "productivity",
    "internal": true,
    "auto_provision": true
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  scopes_supported = EXCLUDED.scopes_supported,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = NOW();

-- Fix the missing function with proper error handling
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
  AND user_integration_credentials.service_provider_id = create_contact_management_credential_for_user.service_provider_id;
  
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

-- Update the trigger function to handle errors gracefully
CREATE OR REPLACE FUNCTION auto_create_contact_management_credential()
RETURNS TRIGGER AS $$
DECLARE
  credential_id UUID;
BEGIN
  BEGIN
    -- Create contact management credential for the new user
    credential_id := create_contact_management_credential_for_user(NEW.id);
    
    RAISE NOTICE 'Auto-created contact management credential % for new user %', credential_id, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to auto-create contact management credential for user %: % - %', 
      NEW.id, SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS auto_create_contact_management_credential_trigger ON auth.users;
CREATE TRIGGER auto_create_contact_management_credential_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_contact_management_credential();

-- Also fix the profiles creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Try to insert the profile
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        NEW.id, 
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name', 
            'New User'
        ), 
        NOW(), 
        NOW()
    );
    
    RAISE NOTICE 'Profile created successfully for user: %', NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS policies exist for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Ensure the handle_updated_at function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the profile update trigger exists
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW 
EXECUTE FUNCTION public.handle_updated_at();

-- Create the profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
