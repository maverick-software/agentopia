import type { SupabaseClient } from '@supabase/supabase-js';

export interface PipedreamApp {
  id?: string | null;
  name_slug: string;
  name: string;
  description?: string | null;
  img_src?: string | null;
  categories?: string[];
  auth_type?: 'keys' | 'oauth' | 'none' | null;
  featured_weight?: number;
}

export interface PipedreamAccount {
  account_id: string;
  account_name: string | null;
  app_slug: string;
  app_name: string;
  healthy: boolean;
  dead: boolean;
}

export async function fetchPipedreamApps(
  supabase: SupabaseClient,
  options: {
    q?: string;
    limit?: number;
    after?: string;
    has_actions?: boolean;
  } = {},
): Promise<{ apps: PipedreamApp[]; pageInfo?: unknown }> {
  const { data, error } = await supabase.functions.invoke('pipedream-apps', {
    body: {
      q: options.q,
      limit: options.limit || 50,
      after: options.after,
      has_actions: options.has_actions ?? true,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to load Pipedream apps');

  return {
    apps: data.data || [],
    pageInfo: data.page_info,
  };
}

export async function syncPipedreamAccounts(
  supabase: SupabaseClient,
  appSlug?: string,
): Promise<PipedreamAccount[]> {
  const { data, error } = await supabase.functions.invoke('pipedream-accounts', {
    body: { app: appSlug },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to sync Pipedream accounts');

  return data.accounts || [];
}

export async function createPipedreamConnectToken(supabase: SupabaseClient): Promise<{
  token: string;
  external_user_id: string;
  environment: 'development' | 'production';
}> {
  const { data, error } = await supabase.functions.invoke('pipedream-connect-token', {
    body: {},
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to create Pipedream Connect token');

  return data;
}

export async function createPipedreamMcpConnection(
  supabase: SupabaseClient,
  options: {
    agentId: string;
    appSlug: string;
    accountId?: string;
    connectionName?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke('create-pipedream-mcp-connection', {
    body: options,
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Failed to create Pipedream MCP connection');

  return data;
}
