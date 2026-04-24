/**
 * Enhanced DigitalOcean Service with Automated SSH Integration
 * 
 * This service extends the basic DigitalOcean droplet service to include
 * automated SSH key management, ensuring every droplet is created with
 * proper SSH access configured automatically.
 */

import { createDigitalOceanDroplet } from './digitalocean_service/droplets';
import type { CreateDropletServiceOptions } from './digitalocean_service/types';
import { AutomatedSSHService, type AutomatedSSHConfig, type SSHKeyDeploymentResult } from './automated_ssh_service';
import { SSHKeyService } from './ssh_key_service';

export interface EnhancedDropletConfig extends Omit<CreateDropletServiceOptions, 'ssh_keys'> {
  userId: string;
  autoGenerateSSHKeys?: boolean;
  sshKeyConfig?: Partial<AutomatedSSHConfig>;
}

export interface EnhancedDropletCreationResult {
  success: boolean;
  droplet?: any;
  sshKeyResult?: SSHKeyDeploymentResult;
  error?: string;
  dropletId?: number;
  publicIpAddress?: string;
  sshConnectionDetails?: {
    host: string;
    username: string;
    keyFingerprint: string;
  };
}

export class EnhancedDigitalOceanService {
  private automatedSSHService: AutomatedSSHService;
  private sshKeyService: SSHKeyService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.automatedSSHService = new AutomatedSSHService(supabaseUrl, supabaseKey);
    this.sshKeyService = new SSHKeyService(supabaseUrl, supabaseKey);
  }

  /**
   * Create a droplet with automated SSH key setup
   * This is the main method that replaces the basic createDigitalOceanDroplet
   */
  async createDropletWithSSH(config: EnhancedDropletConfig): Promise<EnhancedDropletCreationResult> {
    try {
      console.log(`🚀 Creating droplet with automated SSH setup: ${config.name}`);

      // 1. Setup SSH keys for the user
      let sshKeyResult: SSHKeyDeploymentResult;
      
      if (config.autoGenerateSSHKeys !== false) {
        console.log('🔑 Setting up SSH keys...');
        
        const sshConfig: AutomatedSSHConfig = {
          userId: config.userId,
          dropletName: config.name,
          keyName: config.sshKeyConfig?.keyName,
          keyType: config.sshKeyConfig?.keyType || 'ed25519',
          keySize: config.sshKeyConfig?.keySize || 4096
        };

        sshKeyResult = await this.automatedSSHService.setupSSHForDroplet(sshConfig);

        if (!sshKeyResult.success) {
          return {
            success: false,
            error: `SSH key setup failed: ${sshKeyResult.error}`,
            sshKeyResult
          };
        }

        console.log('✅ SSH keys configured successfully');
      } else {
        // Get existing SSH configuration
        const existingConfig = await this.automatedSSHService.getDropletSSHConfiguration(config.userId);
        
        if (existingConfig.sshKeyIds.length === 0) {
          return {
            success: false,
            error: 'No SSH keys found for user and autoGenerateSSHKeys is disabled'
          };
        }

        sshKeyResult = {
          success: true,
          keyId: existingConfig.vaultReferences[0]?.keyId || '',
          fingerprint: existingConfig.keyFingerprints[0] || '',
          digitalOceanKeyId: existingConfig.sshKeyIds[0] || '',
          vaultIds: {
            publicKey: existingConfig.vaultReferences[0]?.publicKeyVaultId || '',
            privateKey: existingConfig.vaultReferences[0]?.privateKeyVaultId || ''
          }
        };
      }

      // 2. Get SSH key IDs for droplet creation
      const sshConfig = await this.automatedSSHService.getDropletSSHConfiguration(config.userId);
      
      if (sshConfig.sshKeyIds.length === 0) {
        return {
          success: false,
          error: 'No DigitalOcean SSH keys available for droplet creation',
          sshKeyResult
        };
      }

      // 3. Create droplet with SSH keys
      console.log('🌊 Creating DigitalOcean droplet...');
      
      const dropletConfig: CreateDropletServiceOptions = {
        ...config,
        ssh_keys: sshConfig.sshKeyIds
      };

      const droplet = await createDigitalOceanDroplet(dropletConfig);

      console.log(`✅ Droplet created successfully: ${droplet.id}`);

      // 4. Extract public IP address
      const publicIpAddress = this.extractPublicIpAddress(droplet);

      // 5. Prepare SSH connection details
      const sshConnectionDetails = {
        host: publicIpAddress || 'pending',
        username: 'root',
        keyFingerprint: sshKeyResult.fingerprint
      };

             // 6. Store droplet-SSH association in database
       await this.storeDropletSSHAssociation(
         droplet.id,
         config.userId,
         sshKeyResult.keyId,
         publicIpAddress || undefined
       );

      console.log('🎉 Droplet with SSH setup completed successfully!');

      return {
        success: true,
        droplet,
        sshKeyResult,
        dropletId: droplet.id,
        publicIpAddress,
        sshConnectionDetails
      };

    } catch (error) {
      console.error('❌ Enhanced droplet creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get SSH connection details for an existing droplet
   */
  async getDropletSSHDetails(userId: string, dropletIp: string): Promise<{
    host: string;
    username: string;
    privateKey: string;
    publicKey: string;
    keyFingerprint: string;
  } | null> {
    return await this.automatedSSHService.getSSHConnectionDetails(userId, dropletIp);
  }

  /**
   * Test SSH connectivity to a droplet
   */
  async testDropletSSHConnection(userId: string, dropletIp: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    return await this.automatedSSHService.testSSHConnection(userId, dropletIp);
  }

  /**
   * Extract public IP address from droplet object
   */
  private extractPublicIpAddress(droplet: any): string | null {
    try {
      // Handle different possible response structures
      const networks = droplet.networks || droplet.data?.networks;
      
      if (!networks) {
        return null;
      }

      // Look for public IPv4 address
      const publicV4 = networks.v4?.find((net: any) => net.type === 'public');
      if (publicV4?.ip_address) {
        return publicV4.ip_address;
      }

      // Fallback: look in different structure
      if (Array.isArray(networks)) {
        const publicNetwork = networks.find((net: any) => net.type === 'public' && net.ip_address);
        if (publicNetwork) {
          return publicNetwork.ip_address;
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract public IP address:', error);
      return null;
    }
  }

  /**
   * Store the association between droplet and SSH key in database
   */
     private async storeDropletSSHAssociation(
     dropletId: number,
     userId: string,
     sshKeyId: string,
     publicIpAddress?: string | null | undefined
   ): Promise<void> {
    try {
      // This would store the association in a database table
      // For now, we'll log it as the table structure isn't defined yet
      console.log('📝 Storing droplet-SSH association:', {
        dropletId,
        userId,
        sshKeyId,
        publicIpAddress,
        timestamp: new Date().toISOString()
      });

      // TODO: Implement actual database storage when table is created
      // await this.supabase
      //   .from('droplet_ssh_associations')
      //   .insert({
      //     droplet_id: dropletId,
      //     user_id: userId,
      //     ssh_key_id: sshKeyId,
      //     public_ip_address: publicIpAddress,
      //     created_at: new Date().toISOString()
      //   });

    } catch (error) {
      console.warn('Failed to store droplet-SSH association:', error);
      // Don't throw error as this is not critical for droplet creation
    }
  }

  /**
   * Clean up resources when droplet is deleted
   */
  async cleanupDropletResources(userId: string, dropletId: number, cleanupSSHKeys: boolean = false): Promise<void> {
    try {
      console.log(`🧹 Cleaning up resources for droplet: ${dropletId}`);

      if (cleanupSSHKeys) {
                 // Get SSH keys associated with this droplet
         const userKeys = await this.sshKeyService.listUserSSHKeys(userId);
        
        // For now, we'll clean up all user SSH keys if requested
        // In production, you might want more granular control
        for (const key of userKeys) {
          try {
            await this.automatedSSHService.cleanupSSHKey(userId, key.id);
            console.log(`✅ Cleaned up SSH key: ${key.id}`);
          } catch (error) {
            console.warn(`Failed to cleanup SSH key ${key.id}:`, error);
          }
        }
      }

      // TODO: Clean up droplet-SSH association records
      console.log('✅ Resource cleanup completed');

    } catch (error) {
      console.error('Error during resource cleanup:', error);
      throw error;
    }
  }

  /**
   * Get all droplets for a user with SSH details
   */
  async getUserDropletsWithSSH(userId: string): Promise<Array<{
    dropletId: number;
    name: string;
    status: string;
    publicIpAddress?: string;
    sshConfigured: boolean;
    sshKeyFingerprint?: string;
  }>> {
    try {
      // This would query droplets associated with the user
      // For now, return empty array as the implementation depends on your droplet tracking
      console.log(`📋 Getting droplets with SSH details for user: ${userId}`);
      
      // TODO: Implement actual droplet listing with SSH details
      return [];

    } catch (error) {
      console.error('Error getting user droplets with SSH:', error);
      return [];
    }
  }
}

/**
 * Factory function to create EnhancedDigitalOceanService instance
 */
export function createEnhancedDigitalOceanService(supabaseUrl: string, supabaseKey: string): EnhancedDigitalOceanService {
  return new EnhancedDigitalOceanService(supabaseUrl, supabaseKey);
}

/**
 * Convenience function for creating droplets with SSH
 */
export async function createDropletWithAutomatedSSH(
  config: EnhancedDropletConfig,
  supabaseUrl: string,
  supabaseKey: string
): Promise<EnhancedDropletCreationResult> {
  const service = createEnhancedDigitalOceanService(supabaseUrl, supabaseKey);
  return await service.createDropletWithSSH(config);
} 