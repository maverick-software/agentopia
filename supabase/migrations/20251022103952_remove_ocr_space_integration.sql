-- Migration: Remove OCR.Space Integration
-- Description: Removes OCR.Space service provider, system API keys, and integration credentials
-- Date: October 22, 2025

-- Remove OCR.Space from system_api_keys table
DELETE FROM system_api_keys 
WHERE provider_name = 'ocr_space';

-- Remove OCR.Space from user_integration_credentials
-- This will remove any user-level OCR.Space connections
DELETE FROM user_integration_credentials 
WHERE service_provider_id IN (
  SELECT id FROM service_providers WHERE name = 'ocr_space'
);

-- Remove OCR.Space from service_providers table
DELETE FROM service_providers 
WHERE name = 'ocr_space';

-- Note: Integration capabilities will be automatically cleaned up via CASCADE
-- if foreign key constraints are properly set up

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ OCR.Space integration removed successfully';
  RAISE NOTICE '   - Removed from system_api_keys';
  RAISE NOTICE '   - Removed from user_integration_credentials';
  RAISE NOTICE '   - Removed from service_providers';
END $$;

