# Integration Catalog Update (2026-04-24)

## Removed integrations

The following integrations were removed end-to-end from UI, frontend wiring, Supabase edge functions, and catalog data migration paths:

- ClickSend SMS
- Azure Document Intelligence
- Anthropic (integration-facing provider wiring)
- DigitalOcean (integration-facing provider wiring)
- GetZep
- Gmail
- Mailgun
- Microsoft OneDrive
- Microsoft Outlook
- Microsoft Teams
- SendGrid

## Current supported catalog (post-removal)

- SMTP
- Discord
- Web Search providers (Serper API, SerpAPI, Brave Search API)
- Pinecone
- Mistral OCR

## Rollback guide

1. Restore code from pre-removal snapshot:
   - Branch: `backup/integration-removal-pre-20260424-074119`
   - Tag: `integration-removal-pre-20260424-074119`
2. Restore data backup in SQL:
   - Preferred dump (if regenerated in your environment): `backups/integration-removal/20260424-074129/integration_data_backup.sql`
   - Fallback script to snapshot integration tables before destructive migration:
     `backups/integration-removal/20260424-074129/integration_data_backup_fallback.sql`
3. Revert migration effects:
   - Re-run provider seed migrations (or restore from DB backup) for removed providers.
   - Reinsert removed `service_providers`, integration catalog rows, capability rows, and credential/permission rows from backup schema.
4. Re-enable deleted Supabase functions by restoring from snapshot branch/tag and redeploying functions.
5. Rebuild and validate:
   - `npm run build`
   - smoke test `/integrations` and agent settings.

