-- Hard-delete cleanup for removed integrations:
-- ClickSend SMS, Azure Document Intelligence, Anthropic, DigitalOcean, GetZep,
-- Gmail, Mailgun, OneDrive, Outlook, Teams, SendGrid.
--
-- Verification block (run after migration):
--   select name from public.service_providers
--   where lower(name) in (
--     'clicksend', 'clicksend_sms', 'azure document intelligence', 'azure-document-intelligence',
--     'anthropic', 'digitalocean', 'getzep', 'gmail', 'mailgun', 'onedrive',
--     'microsoft-onedrive', 'outlook', 'microsoft-outlook', 'teams', 'microsoft-teams', 'sendgrid'
--   );
--
--   select count(*) from public.user_integration_credentials uic
--   join public.service_providers sp on sp.id = uic.oauth_provider_id
--   where lower(sp.name) in (
--     'clicksend', 'clicksend_sms', 'azure document intelligence', 'azure-document-intelligence',
--     'anthropic', 'digitalocean', 'getzep', 'gmail', 'mailgun', 'onedrive',
--     'microsoft-onedrive', 'outlook', 'microsoft-outlook', 'teams', 'microsoft-teams', 'sendgrid'
--   );

begin;

do $$
declare
  target_provider_names text[] := array[
    'clicksend',
    'clicksend_sms',
    'azure document intelligence',
    'azure-document-intelligence',
    'anthropic',
    'digitalocean',
    'getzep',
    'gmail',
    'mailgun',
    'onedrive',
    'microsoft-onedrive',
    'outlook',
    'microsoft-outlook',
    'teams',
    'microsoft-teams',
    'sendgrid'
  ];
begin
  -- 1) Delete permission/join records tied to target providers.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agent_integration_permissions'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_integration_credentials'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_providers'
  ) then
    execute $sql$
      delete from public.agent_integration_permissions aip
      using public.user_integration_credentials uic, public.service_providers sp
      where aip.user_integration_credential_id = uic.id
        and uic.oauth_provider_id = sp.id
        and lower(sp.name) = any ($1)
    $sql$ using target_provider_names;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agent_oauth_permissions'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_integration_credentials'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_providers'
  ) then
    execute $sql$
      delete from public.agent_oauth_permissions aop
      using public.user_integration_credentials uic, public.service_providers sp
      where aop.oauth_credential_id = uic.id
        and uic.oauth_provider_id = sp.id
        and lower(sp.name) = any ($1)
    $sql$ using target_provider_names;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agent_sendgrid_permissions'
  ) then
    execute 'delete from public.agent_sendgrid_permissions';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agent_mailgun_permissions'
  ) then
    execute 'delete from public.agent_mailgun_permissions';
  end if;

  -- 2) Delete logs/usage rows tied to removed providers.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tool_execution_logs'
  ) then
    execute $sql$
      delete from public.tool_execution_logs
      where lower(coalesce(tool_provider, '')) = any ($1)
         or lower(coalesce(tool_name, '')) ~ '(gmail|mailgun|sendgrid|clicksend|digitalocean|getzep|microsoft|onedrive|outlook|teams|anthropic|azure)'
    $sql$ using target_provider_names;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'incoming_webhooks'
  ) then
    execute $sql$
      delete from public.incoming_webhooks
      where lower(coalesce(provider_name, '')) = any ($1)
    $sql$ using target_provider_names;
  end if;

  -- 3) Delete user credential rows tied to target providers.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_integration_credentials'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_providers'
  ) then
    execute $sql$
      delete from public.user_integration_credentials uic
      using public.service_providers sp
      where uic.oauth_provider_id = sp.id
        and lower(sp.name) = any ($1)
    $sql$ using target_provider_names;
  end if;

  -- 4) Delete capabilities/catalog rows in integrations tables.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'integration_capabilities'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'integration_capabilities' and column_name = 'provider_name'
  ) then
    execute $sql$
      delete from public.integration_capabilities
      where lower(coalesce(provider_name, '')) = any ($1)
    $sql$ using target_provider_names;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'integrations'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'integrations' and column_name = 'provider_name'
    ) then
      execute $sql$
        delete from public.integrations
        where lower(coalesce(provider_name, '')) = any ($1)
      $sql$ using target_provider_names;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'integrations' and column_name = 'name'
    ) then
      execute $sql$
        delete from public.integrations
        where lower(coalesce(name, '')) = any ($1)
      $sql$ using target_provider_names;
    end if;
  end if;

  -- 5) Delete service provider catalog rows last.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_providers'
  ) then
    execute $sql$
      delete from public.service_providers
      where lower(name) = any ($1)
    $sql$ using target_provider_names;
  end if;
end $$;

-- 6) Drop provider-specific dead tables/functions/views guarded with IF EXISTS.
drop table if exists public.sendgrid_event_logs cascade;
drop table if exists public.mailgun_event_logs cascade;
drop table if exists public.gmail_watch_channels cascade;
drop table if exists public.clicksend_message_logs cascade;

drop function if exists public.get_sendgrid_stats(uuid);
drop function if exists public.get_mailgun_stats(uuid);
drop function if exists public.refresh_gmail_watch(uuid);
drop function if exists public.clicksend_send_sms(text, text, text);
drop function if exists public.clicksend_send_mms(text, text, text);

drop view if exists public.v_sendgrid_activity;
drop view if exists public.v_mailgun_activity;
drop view if exists public.v_gmail_activity;

commit;

