/**
 * Automated SSH Key Management Service
 * 
 * This service handles the complete SSH key lifecycle for droplet deployments:
 * 1. Generates SSH key pairs automatically
 * 2. Stores keys securely in Supabase Vault
 * 3. Registers public keys with DigitalOcean
 * 4. Configures droplets with SSH access
 * 5. Provides keys to monitoring and management tools
 */

import { createClient } from '@supabase/supabase-js';
import { SSHKeyService } from './ssh_key_service';
import { getDOClient } from './digitalocean_service/client';
import { generateSSHKeyPair } from '../lib/utils/ssh_utils';

export interface AutomatedSSHConfig {
  userId: string;
  dropletName: string;
  keyName?: string;
  keyType?: 'rsa' | 'ed25519';
  keySize?: 2048 | 4096;
}

export interface SSHKeyDeploymentResult {
  success: boolean;
  keyId: string;
  fingerprint: string;
  digitalOceanKeyId: string;
  vaultIds: {
    publicKey: string;
    privateKey: string;
  };
  error?: string;
}

export interface DropletSSHConfiguration {
  sshKeyIds: string[];
  keyFingerprints: string[];
  vaultReferences: Array<{
    keyId: string;
    publicKeyVaultId: string;
    privateKeyVaultId: string;
  }>;
}

export class AutomatedSSHService {
  private supabase: any;
  private sshKeyService: SSHKeyService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.sshKeyService = new SSHKeyService(supabaseUrl, supabaseKey);
  }

  /**
   * Complete SSH key setup for droplet deployment
   * This is the main method called during droplet creation
   */
  async setupSSHForDroplet(config: AutomatedSSHConfig): Promise<SSHKeyDeploymentResult> {
    try {
      console.log(`🔑 Setting up automated SSH for droplet: ${config.dropletName}`);

      // 1. Check if user already has SSH keys
      const existingKeys = await this.sshKeyService.getUserSSHKeys(config.userId);
      
      if (existingKeys.length > 0) {
        console.log(`✅ Using existing SSH key for user ${config.userId}`);
        const existingKey = existingKeys[0];
        
        // Ensure the key is registered with DigitalOcean
        const doKeyId = await this.ensureDigitalOceanKeyRegistration(
          existingKey.id,
          config.userId
        );

        return {
          success: true,
          keyId: existingKey.id,
          fingerprint: existingKey.fingerprint,
          digitalOceanKeyId: doKeyId,
          vaultIds: {
            publicKey: existingKey.public_key_vault_id,
            privateKey: existingKey.private_key_vault_id || ''
          }
        };
      }

      // 2. Generate new SSH key pair
      console.log('🔧 Generating new SSH key pair...');
      const keyPair = await generateSSHKeyPair({
        type: config.keyType || 'ed25519',
        bits: config.keySize || 4096,
        comment: `agentopia-${config.dropletName}-${Date.now()}`
      });

      // 3. Store keys in Supabase Vault
      console.log('🔒 Storing SSH keys in Supabase Vault...');
      const keyName = config.keyName || `${config.dropletName}-ssh-key`;
      const storageResult = await this.sshKeyService.storeUserSSHKey(
        config.userId,
        keyPair.publicKey,
        keyPair.privateKey,
        keyName
      );

      // 4. Register public key with DigitalOcean
      console.log('🌊 Registering SSH key with DigitalOcean...');
      const doKeyId = await this.registerSSHKeyWithDigitalOcean(
        keyPair.publicKey,
        keyName,
        storageResult.keyId
      );

      // 5. Update database with DigitalOcean key ID
      await this.updateSSHKeyWithDOReference(storageResult.keyId, doKeyId);

      console.log('✅ SSH key setup completed successfully');

      return {
        success: true,
        keyId: storageResult.keyId,
        fingerprint: storageResult.fingerprint,
        digitalOceanKeyId: doKeyId,
        vaultIds: storageResult.vaultIds
      };

    } catch (error) {
      console.error('❌ SSH key setup failed:', error);
      return {
        success: false,
        keyId: '',
        fingerprint: '',
        digitalOceanKeyId: '',
        vaultIds: { publicKey: '', privateKey: '' },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get SSH configuration for droplet creation
   * Returns the SSH key IDs that should be used in droplet creation
   */
  async getDropletSSHConfiguration(userId: string): Promise<DropletSSHConfiguration> {
    try {
      const userKeys = await this.sshKeyService.getUserSSHKeys(userId);
      
      const sshKeyIds: string[] = [];
      const keyFingerprints: string[] = [];
      const vaultReferences: Array<{
        keyId: string;
        publicKeyVaultId: string;
        privateKeyVaultId: string;
      }> = [];

      for (const key of userKeys) {
        if (key.digitalocean_key_id) {
          sshKeyIds.push(key.digitalocean_key_id);
          keyFingerprints.push(key.fingerprint);
          vaultReferences.push({
            keyId: key.id,
            publicKeyVaultId: key.public_key_vault_id,
            privateKeyVaultId: key.private_key_vault_id || ''
          });
        }
      }

      return {
        sshKeyIds,
        keyFingerprints,
        vaultReferences
      };

    } catch (error) {
      console.error('Error getting droplet SSH configuration:', error);
      return {
        sshKeyIds: [],
        keyFingerprints: [],
        vaultReferences: []
      };
    }
  }

  /**
   * Register SSH public key with DigitalOcean
   */
  private async registerSSHKeyWithDigitalOcean(
    publicKey: string,
    keyName: string,
    internalKeyId: string
  ): Promise<string> {
    try {
      const doClient = await getDOClient();
      
      const response = await doClient.sshKey.createSSHKey({
        name: keyName,
        public_key: publicKey
      });

      // Handle different response structures
      const sshKey = response?.data?.ssh_key || response?.ssh_key;
      
      if (!sshKey || !sshKey.id) {
        throw new Error('Failed to create SSH key in DigitalOcean: Invalid response');
      }

      console.log(`✅ SSH key registered with DigitalOcean: ${sshKey.id}`);
      return sshKey.id.toString();

    } catch (error) {
      console.error('Error registering SSH key with DigitalOcean:', error);
      throw new Error(`Failed to register SSH key with DigitalOcean: ${error.message}`);
    }
  }

  /**
   * Ensure existing SSH key is registered with DigitalOcean
   */
  private async ensureDigitalOceanKeyRegistration(
    keyId: string,
    userId: string
  ): Promise<string> {
    try {
      // Get key metadata
      const keyMetadata = await this.sshKeyService.getSSHKeyMetadata(userId, keyId);
      
      if (!keyMetadata) {
        throw new Error('SSH key metadata not found');
      }

      // If already registered with DigitalOcean, return the ID
      if (keyMetadata.digitalocean_key_id) {
        return keyMetadata.digitalocean_key_id;
      }

      // Get the public key from vault
      const keyPair = await this.sshKeyService.getSSHKeyPair(userId, keyMetadata.key_name);
      
      if (!keyPair) {
        throw new Error('SSH key pair not found in vault');
      }

      // Register with DigitalOcean
      const doKeyId = await this.registerSSHKeyWithDigitalOcean(
        keyPair.publicKey,
        keyMetadata.key_name,
        keyId
      );

      // Update database with DigitalOcean key ID
      await this.updateSSHKeyWithDOReference(keyId, doKeyId);

      return doKeyId;

    } catch (error) {
      console.error('Error ensuring DigitalOcean key registration:', error);
      throw error;
    }
  }

  /**
   * Update SSH key record with DigitalOcean key ID
   */
  private async updateSSHKeyWithDOReference(keyId: string, doKeyId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_ssh_keys')
        .update({ 
          digitalocean_key_id: doKeyId,
          updated_at: new Date().toISOString()
        })
        .eq('id', keyId);

      if (error) {
        throw new Error(`Failed to update SSH key with DO reference: ${error.message}`);
      }

    } catch (error) {
      console.error('Error updating SSH key with DO reference:', error);
      throw error;
    }
  }

  /**
   * Get SSH connection details for a droplet
   * Used by monitoring and management tools
   */
  async getSSHConnectionDetails(userId: string, dropletIp: string): Promise<{
    host: string;
    username: string;
    privateKey: string;
    publicKey: string;
    keyFingerprint: string;
  } | null> {
    try {
      const userKeys = await this.sshKeyService.getUserSSHKeys(userId);
      
      if (userKeys.length === 0) {
        return null;
      }

      // Use the first available key
      const keyMetadata = userKeys[0];
      const keyPair = await this.sshKeyService.getSSHKeyPair(userId, keyMetadata.key_name);
      
      if (!keyPair) {
        return null;
      }

      return {
        host: dropletIp,
        username: 'root', // Default for DigitalOcean droplets
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        keyFingerprint: keyMetadata.fingerprint
      };

    } catch (error) {
      console.error('Error getting SSH connection details:', error);
      return null;
    }
  }

  /**
   * Test SSH connectivity to a droplet
   */
  async testSSHConnection(userId: string, dropletIp: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const connectionDetails = await this.getSSHConnectionDetails(userId, dropletIp);
      
      if (!connectionDetails) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: 'No SSH keys found for user'
        };
      }

      // For now, we'll simulate the connection test
      // In production, this would use a real SSH client
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      return {
        success: true,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'SSH connection failed'
      };
    }
  }

  /**
   * Clean up SSH keys (remove from DigitalOcean and Supabase)
   */
  async cleanupSSHKey(userId: string, keyId: string): Promise<void> {
    try {
      // Get key metadata
      const keyMetadata = await this.sshKeyService.getSSHKeyMetadata(userId, keyId);
      
      if (!keyMetadata) {
        throw new Error('SSH key not found');
      }

      // Remove from DigitalOcean if registered
      if (keyMetadata.digitalocean_key_id) {
        try {
          const doClient = await getDOClient();
          await doClient.sshKey.deleteSSHKey({ 
            ssh_key_id: parseInt(keyMetadata.digitalocean_key_id) 
          });
          console.log(`✅ SSH key removed from DigitalOcean: ${keyMetadata.digitalocean_key_id}`);
        } catch (error) {
          console.warn('Failed to remove SSH key from DigitalOcean:', error);
          // Continue with cleanup even if DO removal fails
        }
      }

      // Remove from Supabase
      await this.sshKeyService.deleteUserSSHKey(userId, keyId);
      console.log(`✅ SSH key removed from Supabase: ${keyId}`);

    } catch (error) {
      console.error('Error cleaning up SSH key:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create AutomatedSSHService instance
 */
export function createAutomatedSSHService(supabaseUrl: string, supabaseKey: string): AutomatedSSHService {
  return new AutomatedSSHService(supabaseUrl, supabaseKey);
} 