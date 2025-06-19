import { EventEmitter } from 'events';

// Temporary stub for sendAuthenticatedRequest - will be implemented properly later
async function sendAuthenticatedRequest(endpoint: string, options: any): Promise<any> {
  console.log(`[STUB] Would call ${endpoint} with options:`, options);
  return { success: true, data: { oauth_credentials: {} } };
}

export interface OAuthCredential {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  metadata?: Record<string, any>;
}

export interface CredentialInjectionRequest {
  accountToolInstanceId: string;
  requiredProviders: string[];
  contextMetadata?: Record<string, any>;
}

export interface InjectedCredentials {
  environmentVariables: Record<string, string>;
  configFiles?: Record<string, string>;
  secretMounts?: Record<string, string>;
}

/**
 * CredentialInjector - Securely injects OAuth credentials into MCP servers
 * 
 * Features:
 * - Zero-persistence credential injection (in-memory only)
 * - Dynamic OAuth token retrieval from Agentopia backend
 * - Multiple injection methods (env vars, config files, secret mounts)
 * - Automatic token refresh handling
 * - Audit logging for security compliance
 * - Secure cleanup and credential lifecycle management
 */
export class CredentialInjector extends EventEmitter {
  private credentialCache = new Map<string, Map<string, OAuthCredential>>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();
  private injectionHistory = new Map<string, Array<{ timestamp: Date; providers: string[]; success: boolean }>>();
  
  private readonly CREDENTIAL_CACHE_TTL = 300000; // 5 minutes
  private readonly TOKEN_REFRESH_BUFFER = 300000; // 5 minutes before expiry
  private readonly MAX_HISTORY_SIZE = 50;
  
  constructor() {
    super();
    console.log('CredentialInjector initialized with zero-persistence security model');
  }

  /**
   * Prepare OAuth credentials for an MCP server instance
   */
  async prepareOAuthCredentials(
    accountToolInstanceId: string,
    requiredProviders: string[],
    contextMetadata?: Record<string, any>
  ): Promise<Record<string, string>> {
    
    console.log(`Preparing OAuth credentials for instance ${accountToolInstanceId}, providers: ${requiredProviders.join(', ')}`);
    
    try {
      const injectionRequest: CredentialInjectionRequest = {
        accountToolInstanceId,
        requiredProviders,
        contextMetadata
      };
      
      // Retrieve credentials from Agentopia backend
      const credentials = await this.retrieveCredentials(injectionRequest);
      
      // Cache credentials in memory (temporarily)
      this.cacheCredentials(accountToolInstanceId, credentials);
      
      // Setup automatic refresh timers
      this.setupRefreshTimers(accountToolInstanceId, credentials);
      
      // Convert to environment variables format
      const environmentVariables = this.convertToEnvironmentVariables(credentials);
      
      // Log injection for audit trail
      this.logInjection(accountToolInstanceId, requiredProviders, true);
      
      this.emit('credentialsInjected', {
        accountToolInstanceId,
        providers: requiredProviders,
        injectionMethod: 'environment_variables'
      });
      
      return environmentVariables;
      
    } catch (error: any) {
      console.error(`Failed to prepare OAuth credentials for ${accountToolInstanceId}:`, error);
      
      // Log failed injection
      this.logInjection(accountToolInstanceId, requiredProviders, false);
      
      this.emit('credentialInjectionFailed', {
        accountToolInstanceId,
        providers: requiredProviders,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Retrieve OAuth credentials from Agentopia backend
   */
  private async retrieveCredentials(request: CredentialInjectionRequest): Promise<Map<string, OAuthCredential>> {
    const credentials = new Map<string, OAuthCredential>();
    
    try {
      // Call Agentopia backend to get OAuth credentials for this instance
      const response = await sendAuthenticatedRequest('/api/mcp/oauth-credentials', {
        method: 'POST',
        body: JSON.stringify({
          account_tool_instance_id: request.accountToolInstanceId,
          required_providers: request.requiredProviders,
          context_metadata: request.contextMetadata
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(`Failed to retrieve credentials: ${response.error || 'Unknown error'}`);
      }

      // Parse credentials from response
      const credentialData = response.data.oauth_credentials || {};
      
      for (const provider of request.requiredProviders) {
        const providerData = credentialData[provider];
        if (providerData) {
          const credential: OAuthCredential = {
            provider,
            accessToken: providerData.access_token,
            refreshToken: providerData.refresh_token,
            expiresAt: providerData.expires_at ? new Date(providerData.expires_at) : undefined,
            scopes: providerData.scopes || [],
            metadata: providerData.metadata || {}
          };
          
          credentials.set(provider, credential);
          console.log(`Retrieved ${provider} credential for instance ${request.accountToolInstanceId}`);
        } else {
          console.warn(`No credential available for provider ${provider} on instance ${request.accountToolInstanceId}`);
        }
      }
      
      if (credentials.size === 0) {
        throw new Error('No valid OAuth credentials retrieved for any requested provider');
      }
      
      return credentials;
      
    } catch (error: any) {
      console.error('Failed to retrieve OAuth credentials from backend:', error);
      throw error;
    }
  }

  /**
   * Cache credentials in memory with TTL
   */
  private cacheCredentials(accountToolInstanceId: string, credentials: Map<string, OAuthCredential>): void {
    this.credentialCache.set(accountToolInstanceId, credentials);
    
    // Set cache expiry
    setTimeout(() => {
      this.credentialCache.delete(accountToolInstanceId);
      console.log(`Credential cache expired for instance ${accountToolInstanceId}`);
    }, this.CREDENTIAL_CACHE_TTL);
  }

  /**
   * Setup automatic refresh timers for expiring tokens
   */
  private setupRefreshTimers(accountToolInstanceId: string, credentials: Map<string, OAuthCredential>): void {
    // Clear existing timers
    const existingTimer = this.refreshTimers.get(accountToolInstanceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Find the earliest expiry time
    let earliestExpiry: Date | undefined;
    
    for (const credential of credentials.values()) {
      if (credential.expiresAt) {
        if (!earliestExpiry || credential.expiresAt < earliestExpiry) {
          earliestExpiry = credential.expiresAt;
        }
      }
    }
    
    if (earliestExpiry) {
      const refreshTime = earliestExpiry.getTime() - Date.now() - this.TOKEN_REFRESH_BUFFER;
      
      if (refreshTime > 0) {
        const timer = setTimeout(async () => {
          await this.refreshCredentials(accountToolInstanceId);
        }, refreshTime);
        
        this.refreshTimers.set(accountToolInstanceId, timer);
        
        console.log(`Set up credential refresh timer for instance ${accountToolInstanceId} in ${Math.round(refreshTime / 1000)} seconds`);
      } else {
        console.warn(`Credential for instance ${accountToolInstanceId} expires too soon, immediate refresh needed`);
        // Trigger immediate refresh
        setTimeout(() => this.refreshCredentials(accountToolInstanceId), 1000);
      }
    }
  }

  /**
   * Refresh expired or expiring credentials
   */
  private async refreshCredentials(accountToolInstanceId: string): Promise<void> {
    console.log(`Refreshing credentials for instance ${accountToolInstanceId}`);
    
    try {
      const currentCredentials = this.credentialCache.get(accountToolInstanceId);
      if (!currentCredentials) {
        console.log(`No cached credentials found for instance ${accountToolInstanceId}, skipping refresh`);
        return;
      }
      
      const providers = Array.from(currentCredentials.keys());
      
      // Retrieve fresh credentials
      const refreshedCredentials = await this.retrieveCredentials({
        accountToolInstanceId,
        requiredProviders: providers
      });
      
      // Update cache
      this.cacheCredentials(accountToolInstanceId, refreshedCredentials);
      
      // Setup new refresh timers
      this.setupRefreshTimers(accountToolInstanceId, refreshedCredentials);
      
      this.emit('credentialUpdate', {
        accountToolInstanceId,
        providers,
        updateReason: 'automatic_refresh'
      });
      
      console.log(`Successfully refreshed credentials for instance ${accountToolInstanceId}`);
      
    } catch (error: any) {
      console.error(`Failed to refresh credentials for instance ${accountToolInstanceId}:`, error);
      
      this.emit('credentialRefreshFailed', {
        accountToolInstanceId,
        error: error.message
      });
    }
  }

  /**
   * Convert OAuth credentials to environment variables format
   */
  private convertToEnvironmentVariables(credentials: Map<string, OAuthCredential>): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    for (const [provider, credential] of credentials) {
      const providerUpper = provider.toUpperCase();
      
      // Standard OAuth environment variables
      envVars[`OAUTH_${providerUpper}_ACCESS_TOKEN`] = credential.accessToken;
      
      if (credential.refreshToken) {
        envVars[`OAUTH_${providerUpper}_REFRESH_TOKEN`] = credential.refreshToken;
      }
      
      if (credential.expiresAt) {
        envVars[`OAUTH_${providerUpper}_EXPIRES_AT`] = credential.expiresAt.toISOString();
      }
      
      if (credential.scopes.length > 0) {
        envVars[`OAUTH_${providerUpper}_SCOPES`] = credential.scopes.join(',');
      }
      
      // Provider-specific environment variables
      switch (provider) {
        case 'github':
          envVars['GITHUB_TOKEN'] = credential.accessToken;
          envVars['GH_TOKEN'] = credential.accessToken; // Alternative format
          break;
          
        case 'google':
          envVars['GOOGLE_ACCESS_TOKEN'] = credential.accessToken;
          envVars['GOOGLE_OAUTH_TOKEN'] = credential.accessToken;
          break;
          
        case 'microsoft':
          envVars['MICROSOFT_ACCESS_TOKEN'] = credential.accessToken;
          envVars['MS_GRAPH_TOKEN'] = credential.accessToken;
          break;
          
        case 'slack':
          envVars['SLACK_BOT_TOKEN'] = credential.accessToken;
          envVars['SLACK_OAUTH_TOKEN'] = credential.accessToken;
          break;
      }
      
      // Add any provider-specific metadata as environment variables
      if (credential.metadata) {
        for (const [key, value] of Object.entries(credential.metadata)) {
          if (typeof value === 'string') {
            envVars[`OAUTH_${providerUpper}_${key.toUpperCase()}`] = value;
          }
        }
      }
    }
    
    return envVars;
  }

  /**
   * Generate configuration files for credentials (alternative injection method)
   */
  async generateConfigFiles(
    accountToolInstanceId: string,
    format: 'json' | 'yaml' | 'env' = 'json'
  ): Promise<Record<string, string>> {
    
    const credentials = this.credentialCache.get(accountToolInstanceId);
    if (!credentials) {
      throw new Error(`No cached credentials found for instance ${accountToolInstanceId}`);
    }
    
    const configFiles: Record<string, string> = {};
    
    switch (format) {
      case 'json':
        const jsonConfig: Record<string, any> = {};
        for (const [provider, credential] of credentials) {
          jsonConfig[provider] = {
            access_token: credential.accessToken,
            refresh_token: credential.refreshToken,
            expires_at: credential.expiresAt?.toISOString(),
            scopes: credential.scopes,
            metadata: credential.metadata
          };
        }
        configFiles['oauth_credentials.json'] = JSON.stringify(jsonConfig, null, 2);
        break;
        
      case 'env':
        const envVars = this.convertToEnvironmentVariables(credentials);
        const envContent = Object.entries(envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        configFiles['.env.oauth'] = envContent;
        break;
        
      case 'yaml':
        // Simple YAML generation (could use a proper YAML library in production)
        let yamlContent = '';
        for (const [provider, credential] of credentials) {
          yamlContent += `${provider}:\n`;
          yamlContent += `  access_token: "${credential.accessToken}"\n`;
          if (credential.refreshToken) {
            yamlContent += `  refresh_token: "${credential.refreshToken}"\n`;
          }
          if (credential.expiresAt) {
            yamlContent += `  expires_at: "${credential.expiresAt.toISOString()}"\n`;
          }
          yamlContent += `  scopes: [${credential.scopes.map(s => `"${s}"`).join(', ')}]\n`;
          yamlContent += '\n';
        }
        configFiles['oauth_credentials.yaml'] = yamlContent;
        break;
    }
    
    return configFiles;
  }

  /**
   * Clean up credentials for an instance
   */
  async cleanupCredentials(accountToolInstanceId: string): Promise<void> {
    console.log(`Cleaning up credentials for instance ${accountToolInstanceId}`);
    
    try {
      // Clear credential cache
      this.credentialCache.delete(accountToolInstanceId);
      
      // Clear refresh timers
      const timer = this.refreshTimers.get(accountToolInstanceId);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimers.delete(accountToolInstanceId);
      }
      
      // Notify backend about credential cleanup (for audit purposes)
      try {
        await sendAuthenticatedRequest('/api/mcp/oauth-credentials/cleanup', {
          method: 'POST',
          body: JSON.stringify({
            account_tool_instance_id: accountToolInstanceId
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.warn(`Failed to notify backend about credential cleanup for ${accountToolInstanceId}:`, error);
        // Don't throw - cleanup should continue
      }
      
      this.emit('credentialsCleanup', { accountToolInstanceId });
      
      console.log(`Credential cleanup completed for instance ${accountToolInstanceId}`);
      
    } catch (error: any) {
      console.error(`Error during credential cleanup for ${accountToolInstanceId}:`, error);
      throw error;
    }
  }

  /**
   * Log credential injection for audit trail
   */
  private logInjection(accountToolInstanceId: string, providers: string[], success: boolean): void {
    const history = this.injectionHistory.get(accountToolInstanceId) || [];
    
    history.push({
      timestamp: new Date(),
      providers: [...providers],
      success
    });
    
    // Keep limited history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    this.injectionHistory.set(accountToolInstanceId, history);
  }

  /**
   * Get injection history for an instance (for audit purposes)
   */
  getInjectionHistory(accountToolInstanceId: string): Array<{ timestamp: Date; providers: string[]; success: boolean }> {
    return [...(this.injectionHistory.get(accountToolInstanceId) || [])];
  }

  /**
   * Get current credential status for an instance
   */
  getCredentialStatus(accountToolInstanceId: string): {
    hasCredentials: boolean;
    providers: string[];
    expiryStatus: Record<string, { expiresAt?: Date; isExpired: boolean; expiresInMs?: number }>;
  } {
    const credentials = this.credentialCache.get(accountToolInstanceId);
    
    if (!credentials || credentials.size === 0) {
      return {
        hasCredentials: false,
        providers: [],
        expiryStatus: {}
      };
    }
    
    const providers = Array.from(credentials.keys());
    const expiryStatus: Record<string, { expiresAt?: Date; isExpired: boolean; expiresInMs?: number }> = {};
    
    for (const [provider, credential] of credentials) {
      const now = Date.now();
      const expiresAt = credential.expiresAt;
      
      expiryStatus[provider] = {
        expiresAt,
        isExpired: expiresAt ? now > expiresAt.getTime() : false,
        expiresInMs: expiresAt ? expiresAt.getTime() - now : undefined
      };
    }
    
    return {
      hasCredentials: true,
      providers,
      expiryStatus
    };
  }

  /**
   * Manually trigger credential refresh for an instance
   */
  async forceRefreshCredentials(accountToolInstanceId: string): Promise<boolean> {
    try {
      await this.refreshCredentials(accountToolInstanceId);
      return true;
    } catch (error) {
      console.error(`Force refresh failed for instance ${accountToolInstanceId}:`, error);
      return false;
    }
  }

  /**
   * Get security audit summary
   */
  getSecurityAuditSummary(): {
    totalInstancesWithCredentials: number;
    totalActiveCredentials: number;
    credentialsByProvider: Record<string, number>;
    recentInjections: number;
    recentFailures: number;
  } {
    const summary = {
      totalInstancesWithCredentials: this.credentialCache.size,
      totalActiveCredentials: 0,
      credentialsByProvider: {} as Record<string, number>,
      recentInjections: 0,
      recentFailures: 0
    };
    
    // Count credentials by provider
    for (const credentials of this.credentialCache.values()) {
      summary.totalActiveCredentials += credentials.size;
      
      for (const provider of credentials.keys()) {
        summary.credentialsByProvider[provider] = (summary.credentialsByProvider[provider] || 0) + 1;
      }
    }
    
    // Count recent activity (last 24 hours)
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const history of this.injectionHistory.values()) {
      for (const entry of history) {
        if (entry.timestamp.getTime() > dayAgo) {
          if (entry.success) {
            summary.recentInjections++;
          } else {
            summary.recentFailures++;
          }
        }
      }
    }
    
    return summary;
  }

  /**
   * Shutdown the credential injector
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down CredentialInjector...');
    
    // Clear all refresh timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
    
    // Clear all credential caches (security cleanup)
    this.credentialCache.clear();
    
    this.removeAllListeners();
    console.log('CredentialInjector shutdown complete - all credentials cleared from memory');
  }
} 