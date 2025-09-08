/**
 * Scope mapping utilities for converting OAuth scopes to tool capabilities
 */

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
      'files.read': ['list_files', 'download_file', 'search_files'],
      'files.write': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'sites.read': ['list_files', 'search_files'],
      'sites.write': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'Files.Read': ['list_files', 'download_file', 'search_files'],
      'Files.ReadWrite': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'Files.Read.All': ['list_files', 'download_file', 'search_files'],
      'Files.ReadWrite.All': ['upload_file', 'list_files', 'download_file', 'search_files', 'share_file'],
      'Sites.Read.All': ['list_files', 'search_files'],
      'Sites.ReadWrite.All': ['upload_file', 'list_files', 'download_file', 'search_files', 'share_file'],
      'User.Read': ['read_profile']
    };
    return onedriveMappings[scope] || [scope];
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
  
  // Default: return the scope as-is
  return [scope];
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
