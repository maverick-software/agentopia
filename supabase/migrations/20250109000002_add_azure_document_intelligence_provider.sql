-- =====================================================
-- ADD AZURE DOCUMENT INTELLIGENCE SERVICE PROVIDER
-- =====================================================
-- Add Azure Document Intelligence as a service provider for document processing

INSERT INTO public.service_providers (
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
  'azure-document-intelligence',
  'Azure Document Intelligence',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', -- Not used for API key auth
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',       -- Not used for API key auth
  null,
  null,
  '["https://cognitiveservices.azure.com/.default"]'::jsonb,
  false, -- API key based, not OAuth
  'header',
  true,
  '{
    "auth_type": "api_key",
    "api_key_header": "Ocp-Apim-Subscription-Key",
    "base_url_template": "https://{region}.api.cognitive.microsoft.com/formrecognizer/documentModels/prebuilt-read:analyze",
    "supported_regions": [
      "eastus", "eastus2", "westus", "westus2", "centralus", "northcentralus", "southcentralus", "westcentralus",
      "canadacentral", "canadaeast", "brazilsouth", "northeurope", "westeurope", "uksouth", "ukwest",
      "francecentral", "switzerlandnorth", "germanywestcentral", "norwayeast", "uaenorth", "southafricanorth",
      "australiaeast", "australiasoutheast", "eastasia", "southeastasia", "japaneast", "japanwest",
      "koreacentral", "centralindia", "southindia", "westindia"
    ],
    "api_version": "2023-07-31",
    "features": [
      "document_analysis",
      "layout_analysis", 
      "table_extraction",
      "form_recognition",
      "receipt_processing",
      "invoice_processing",
      "business_card_processing",
      "id_document_processing"
    ],
    "supported_formats": [
      "pdf", "jpeg", "png", "bmp", "tiff", "heif", "docx", "xlsx", "pptx", "html"
    ],
    "pricing_tier": "premium",
    "documentation_url": "https://docs.microsoft.com/en-us/azure/cognitive-services/form-recognizer/",
    "setup_instructions": {
      "step1": "Create an Azure Cognitive Services resource in the Azure portal",
      "step2": "Navigate to your Form Recognizer resource",
      "step3": "Copy the API key from Keys and Endpoint section", 
      "step4": "Copy the endpoint URL (e.g., https://your-resource.cognitiveservices.azure.com/)",
      "step5": "Enter both the API key and endpoint in the setup form"
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Create integration category for document processing if it doesn't exist
INSERT INTO public.integration_categories (
  name,
  description,
  icon_name,
  display_order,
  is_active
) VALUES (
  'document-processing',
  'Advanced document analysis and text extraction services',
  'FileText',
  50,
  true
) ON CONFLICT (name) DO NOTHING;

-- Add Azure Document Intelligence to integrations table
INSERT INTO public.integrations (
  name,
  description,
  category_id,
  icon_name,
  status,
  agent_classification,
  is_popular,
  documentation_url,
  configuration_schema,
  required_oauth_provider_id,
  display_order,
  is_active
) VALUES (
  'azure-document-intelligence',
  'Microsoft''s premium document analysis service for advanced text extraction, layout analysis, and form processing with enterprise-grade accuracy.',
  (SELECT id FROM public.integration_categories WHERE name = 'document-processing'),
  'FileText',
  'available',
  'tool',
  false,
  'https://docs.microsoft.com/en-us/azure/cognitive-services/form-recognizer/',
  '{
    "required_fields": [
      {
        "name": "api_key",
        "label": "API Key",
        "type": "password",
        "description": "Your Azure Form Recognizer API key from the Azure portal",
        "validation": {
          "required": true,
          "minLength": 32
        }
      },
      {
        "name": "endpoint",
        "label": "Endpoint URL", 
        "type": "url",
        "description": "Your Azure Form Recognizer endpoint (e.g., https://your-resource.cognitiveservices.azure.com/)",
        "validation": {
          "required": true,
          "pattern": "^https://[a-zA-Z0-9-]+\\.cognitiveservices\\.azure\\.com/?$"
        }
      },
      {
        "name": "region",
        "label": "Azure Region",
        "type": "select",
        "description": "The Azure region where your resource is deployed",
        "options": [
          {"value": "eastus", "label": "East US"},
          {"value": "eastus2", "label": "East US 2"},
          {"value": "westus", "label": "West US"},
          {"value": "westus2", "label": "West US 2"},
          {"value": "centralus", "label": "Central US"},
          {"value": "northeurope", "label": "North Europe"},
          {"value": "westeurope", "label": "West Europe"},
          {"value": "uksouth", "label": "UK South"},
          {"value": "eastasia", "label": "East Asia"},
          {"value": "southeastasia", "label": "Southeast Asia"},
          {"value": "japaneast", "label": "Japan East"},
          {"value": "australiaeast", "label": "Australia East"}
        ],
        "validation": {
          "required": true
        }
      }
    ],
    "optional_fields": [
      {
        "name": "connection_name",
        "label": "Connection Name",
        "type": "text",
        "description": "A friendly name for this connection",
        "default": "Azure Document Intelligence"
      }
    ]
  }'::jsonb,
  (SELECT id FROM public.service_providers WHERE name = 'azure-document-intelligence'),
  60,
  true
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  configuration_schema = EXCLUDED.configuration_schema,
  updated_at = now();

-- Azure Document Intelligence integration setup complete
-- Permissions will be managed through the agent_integration_permissions table
-- when users configure their agents to use this integration
