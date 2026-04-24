/**
 * Scope mapping utilities for converting OAuth scopes to tool capabilities
 */

/**
 * Normalizes a scope name to a valid OpenAI tool name
 * OpenAI requires tool names to match pattern: ^[a-zA-Z0-9_-]+$
 */
export function normalizeToolName(scope: string): string {
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
  // SMTP scope mappings
  if (providerName === 'smtp') {
    const smtpMappings: Record<string, string[]> = {
      'email.send': ['smtp_send_email'],
      'email.templates': ['smtp_email_templates'],
      'email.stats': ['smtp_email_stats']
    };
    return smtpMappings[scope] || [scope];
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

  // Contact Management scope mappings
  if (providerName === 'contact_management') {
    const contactMappings: Record<string, string[]> = {
      'search_contacts': ['search_contacts'],
      'get_contact_details': ['get_contact_details'],
      'view_contact_channels': ['get_contact_details'], // Channel info included in details
      'contact_permissions': ['search_contacts'] // Permission info available through search
    };
    return contactMappings[scope] || [scope];
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
