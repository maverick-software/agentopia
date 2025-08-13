-- Ensure tool catalog entries exist for Gmail tools (idempotent)
DO $$
DECLARE
  v_catalog_id uuid;
  v_gmail_integration uuid;
BEGIN
  -- Optional: link to tool_catalog if your schema uses it
  SELECT id INTO v_catalog_id FROM tool_catalog WHERE name = 'Gmail' LIMIT 1;
  SELECT id INTO v_gmail_integration FROM integrations WHERE name = 'Gmail' LIMIT 1;

  -- Create catalog if missing
  IF v_catalog_id IS NULL THEN
    INSERT INTO tool_catalog (id, name, description)
    VALUES (gen_random_uuid(), 'Gmail', 'Gmail provider tools')
    RETURNING id INTO v_catalog_id;
  END IF;

  -- Upsert tool definitions (schema-agnostic: adjust columns if different)
  INSERT INTO tool_definitions (name, provider, integration_id, catalog_id, description)
  VALUES
    ('send_email', 'gmail', v_gmail_integration, v_catalog_id, 'Send email via Gmail'),
    ('read_emails', 'gmail', v_gmail_integration, v_catalog_id, 'Read emails'),
    ('search_emails', 'gmail', v_gmail_integration, v_catalog_id, 'Search emails'),
    ('email_actions', 'gmail', v_gmail_integration, v_catalog_id, 'Modify emails (read, archive, delete)')
  ON CONFLICT (name, provider) DO UPDATE SET
    integration_id = EXCLUDED.integration_id,
    catalog_id = EXCLUDED.catalog_id,
    description = EXCLUDED.description;
END $$;


