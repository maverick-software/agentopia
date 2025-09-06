-- Add OCR.Space provider to oauth_providers table
INSERT INTO "public"."oauth_providers" (
  "name", 
  "display_name", 
  "provider_type", 
  "auth_url", 
  "token_url", 
  "scope", 
  "client_id", 
  "client_secret", 
  "redirect_uri"
) VALUES (
  'ocr_space',
  'OCR.Space API',
  'api_key',
  NULL,  -- No OAuth URLs for API key providers
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider_type = EXCLUDED.provider_type;

-- Add integration capabilities for OCR.Space
INSERT INTO "public"."integration_capabilities" (
  "integration_id",
  "capability_key", 
  "display_label",
  "display_order"
) 
SELECT 
  p.id,
  'ocr_text_extraction',
  'Text Extraction',
  1
FROM "public"."oauth_providers" p
WHERE p.name = 'ocr_space'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order;

INSERT INTO "public"."integration_capabilities" (
  "integration_id",
  "capability_key", 
  "display_label",
  "display_order"
) 
SELECT 
  p.id,
  'pdf_ocr_processing',
  'PDF OCR Processing',
  2
FROM "public"."oauth_providers" p
WHERE p.name = 'ocr_space'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order;

INSERT INTO "public"."integration_capabilities" (
  "integration_id",
  "capability_key", 
  "display_label",
  "display_order"
) 
SELECT 
  p.id,
  'image_text_recognition',
  'Image Text Recognition',
  3
FROM "public"."oauth_providers" p
WHERE p.name = 'ocr_space'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order;
