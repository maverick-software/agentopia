-- Migration: Add Mistral OCR Integration
-- Purpose: Add Mistral AI as a service provider for OCR capabilities
-- Date: January 9, 2025

-- Step 1: Add Mistral AI as a service provider
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  discovery_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'mistral_ai',
  'Mistral AI',
  'https://api.mistral.ai/v1/oauth/authorize', -- Placeholder - Mistral uses API keys
  'https://api.mistral.ai/v1/oauth/token',     -- Placeholder - Mistral uses API keys
  'https://api.mistral.ai/v1/oauth/revoke',    -- Placeholder - Mistral uses API keys
  null,
  '["ocr", "document_processing"]'::jsonb,
  false, -- API key based, no PKCE
  'header',
  true,
  '{
    "api_base_url": "https://api.mistral.ai/v1",
    "ocr_endpoint": "/ocr",
    "supported_formats": ["pdf", "png", "jpg", "jpeg", "gif", "bmp", "tiff", "docx", "pptx"],
    "max_file_size_mb": 20,
    "max_pages": 100,
    "authentication_type": "api_key",
    "header_format": "Bearer {api_key}",
    "pricing_model": "per_page",
    "features": {
      "structured_output": true,
      "image_extraction": true,
      "bbox_annotation": true,
      "document_annotation": true,
      "markdown_output": true,
      "multi_page_support": true
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Step 2: Get the AI/ML category ID or create it
DO $$
DECLARE
    ai_category_id UUID;
BEGIN
    -- Try to get existing AI/ML category
    SELECT id INTO ai_category_id
    FROM integration_categories
    WHERE name = 'AI & Machine Learning'
    LIMIT 1;
    
    -- If not found, create it
    IF ai_category_id IS NULL THEN
        INSERT INTO integration_categories (
            name,
            description,
            icon_name,
            display_order,
            is_active
        ) VALUES (
            'AI & Machine Learning',
            'AI-powered tools for document processing, OCR, and intelligent analysis',
            'Brain',
            50,
            true
        ) RETURNING id INTO ai_category_id;
    END IF;
    
    -- Add Mistral OCR integration
    INSERT INTO integrations (
        category_id,
        name,
        description,
        icon_name,
        status,
        is_popular,
        documentation_url,
        configuration_schema,
        required_oauth_provider_id,
        required_tool_catalog_id,
        display_order,
        is_active,
        agent_classification
    ) VALUES (
        ai_category_id,
        'Mistral OCR',
        'Advanced OCR and document processing using Mistral AI''s state-of-the-art models. Extract text from PDFs, images, and documents with high accuracy.',
        'FileText',
        'available',
        true,
        'https://docs.mistral.ai/api/#tag/ocr',
        '{
          "type": "object",
          "properties": {
            "api_key": {
              "type": "string",
              "title": "Mistral AI API Key",
              "description": "Your Mistral AI API key from https://console.mistral.ai",
              "format": "password"
            },
            "connection_name": {
              "type": "string",
              "title": "Connection Name",
              "description": "A friendly name for this connection",
              "default": "Mistral OCR Connection"
            },
            "model": {
              "type": "string",
              "title": "OCR Model",
              "description": "Mistral OCR model to use",
              "default": "mistral-ocr-latest",
              "enum": ["mistral-ocr-latest", "mistral-ocr-v1"]
            },
            "max_pages": {
              "type": "integer",
              "title": "Max Pages per Request",
              "description": "Maximum number of pages to process in a single request",
              "default": 10,
              "minimum": 1,
              "maximum": 100
            },
            "include_images": {
              "type": "boolean",
              "title": "Extract Images",
              "description": "Extract and include images from documents",
              "default": false
            }
          },
          "required": ["api_key", "connection_name"]
        }'::jsonb,
        (SELECT id FROM service_providers WHERE name = 'mistral_ai'),
        null,
        10,
        true,
        'tool'
    ) ON CONFLICT (category_id, name) DO UPDATE SET
        description = EXCLUDED.description,
        configuration_schema = EXCLUDED.configuration_schema,
        documentation_url = EXCLUDED.documentation_url,
        updated_at = now();
END $$;

-- Step 3: Create helpful views for Mistral OCR integration
CREATE OR REPLACE VIEW mistral_ocr_connections AS
SELECT 
    uic.id,
    uic.user_id,
    uic.connection_name,
    uic.connection_status,
    uic.connection_metadata,
    uic.created_at,
    uic.updated_at,
    sp.display_name as provider_name,
    sp.configuration_metadata as provider_config
FROM user_integration_credentials uic
JOIN service_providers sp ON uic.oauth_provider_id = sp.id
WHERE sp.name = 'mistral_ai'
  AND uic.credential_type = 'api_key';

COMMENT ON VIEW mistral_ocr_connections IS 'View for Mistral OCR connections with provider details';

-- Step 4: Add RLS policies for Mistral OCR
ALTER TABLE user_integration_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see their own Mistral OCR connections
CREATE POLICY "Users can view own Mistral OCR connections" ON user_integration_credentials
    FOR SELECT USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
    );

-- Users can create their own Mistral OCR connections
CREATE POLICY "Users can create own Mistral OCR connections" ON user_integration_credentials
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
    );

-- Users can update their own Mistral OCR connections
CREATE POLICY "Users can update own Mistral OCR connections" ON user_integration_credentials
    FOR UPDATE USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
    );

-- Users can delete their own Mistral OCR connections
CREATE POLICY "Users can delete own Mistral OCR connections" ON user_integration_credentials
    FOR DELETE USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
    );
