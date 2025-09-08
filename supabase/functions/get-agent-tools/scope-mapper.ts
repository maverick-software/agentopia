/**
 * Scope mapping utilities for converting OAuth scopes to tool capabilities
 */

/**
 * Normalizes a scope name to a valid OpenAI tool name
 * OpenAI requires tool names to match pattern: ^[a-zA-Z0-9_-]+$
 */
function normalizeToolName(scope: string): string {
  // Remove URLs and convert to valid tool name
  return scope
    .replace(/^https?:\/\/[^\/]+\//, '') // Remove URL prefix
    .replace(/[^a-zA-Z0-9_-]/g, '_')     // Replace invalid chars with underscore
    .replace(/_+/g, '_')                 // Collapse multiple underscores
    .replace(/^_|_$/g, '')               // Remove leading/trailing underscores
    .toLowerCase();
}

/**
 * Maps OAuth scopes to integration capabilities for different providers
 */
export function mapScopeToCapability(scope: string, providerName: string): string[] {
  // Gmail scope mappings
  if (providerName === 'gmail') {
    const gmailMappings: Record<string, string[]> = {
      'email.send': ['send_email'],
      'email.read': ['read_emails', 'search_emails'],
      'email.modify': ['email_actions'],
      'https://www.googleapis.com/auth/gmail.send': ['send_email'],
      'https://www.googleapis.com/auth/gmail.readonly': ['read_emails', 'search_emails'],
      'https://www.googleapis.com/auth/gmail.modify': ['email_actions']
    };
    return gmailMappings[scope] || [scope];
  }
  
  // SMTP scope mappings
  if (providerName === 'smtp') {
    const smtpMappings: Record<string, string[]> = {
      'email.send': ['smtp_send_email'],
      'email.templates': ['smtp_email_templates'],
      'email.stats': ['smtp_email_stats']
    };
    return smtpMappings[scope] || [scope];
  }
  
  // Microsoft OneDrive scope mappings
  if (providerName === 'microsoft-onedrive') {
    const onedriveMappings: Record<string, string[]> = {
      'files.read': ['onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'files.write': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'sites.read': ['onedrive_list_files', 'onedrive_search_files'],
      'sites.write': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'Files.Read': ['onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'Files.ReadWrite': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'Files.Read.All': ['onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'Files.ReadWrite.All': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files', 'onedrive_share_file'],
      'Sites.Read.All': ['onedrive_list_files', 'onedrive_search_files'],
      'Sites.ReadWrite.All': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files', 'onedrive_share_file'],
      'User.Read': ['onedrive_get_user_info'],
      // Full URL scopes (these are what's actually being passed)
      'https://graph.microsoft.com/Files.Read': ['onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'https://graph.microsoft.com/Files.ReadWrite': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'https://graph.microsoft.com/Files.Read.All': ['onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files'],
      'https://graph.microsoft.com/Files.ReadWrite.All': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files', 'onedrive_share_file'],
      'https://graph.microsoft.com/Sites.Read.All': ['onedrive_list_files', 'onedrive_search_files'],
      'https://graph.microsoft.com/Sites.ReadWrite.All': ['onedrive_upload_file', 'onedrive_list_files', 'onedrive_download_file', 'onedrive_search_files', 'onedrive_share_file'],
      'https://graph.microsoft.com/User.Read': ['onedrive_get_user_info']
    };
    return onedriveMappings[scope] || [normalizeToolName(scope)];
  }

  // Serper API scope mappings
  if (providerName === 'serper_api') {
    const serperMappings: Record<string, string[]> = {
      'web_search': ['web_search'],
      'news_search': ['news_search'],
      'image_search': ['image_search'],
      'local_search': ['local_search']
    };
    return serperMappings[scope] || [scope];
  }

  // Internal System scope mappings
  if (providerName === 'internal_system') {
    const internalMappings: Record<string, string[]> = {
      'agent_management': ['manage_agents'],
      'user_management': ['manage_users'],
      'integration_management': ['manage_integrations'],
      'system_monitoring': ['monitor_system'],
      'data_export': ['export_data'],
      'audit_logs': ['view_audit_logs'],
      'backup_restore': ['backup_restore'],
      'api_access': ['api_access']
    };
    return internalMappings[scope] || [scope];
  }
  
  // Default: normalize the scope name to be OpenAI-compatible
  return [normalizeToolName(scope)];
}

/**
 * Checks if agent scope allows a specific capability
 */
export function isScopeAllowed(capability: string, allowedScopes: string[], providerName: string): boolean {
  // Direct match
  if (allowedScopes.includes(capability)) {
    return true;
  }
  
  // Check mapped scopes
  for (const scope of allowedScopes) {
    const mappedCapabilities = mapScopeToCapability(scope, providerName);
    if (mappedCapabilities.includes(capability)) {
      return true;
    }
  }
  
  return false;
}
