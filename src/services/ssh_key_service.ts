import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Service for managing SSH keys securely in Supabase Vault
 */
export class SSHKeyService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Store an SSH key pair securely in Supabase Vault
   * @param userId - User ID who owns the keys
   * @param publicKey - SSH public key content
   * @param privateKey - SSH private key content  
   * @param keyName - Optional name for the key pair
   * @returns Object with vault IDs for both keys
   */
  async storeSSHKeyPair(
    userId: string, 
    publicKey: string, 
    privateKey: string, 
    keyName?: string
  ): Promise<{ publicKeyId: string; privateKeyId: string }> {
    try {
      // Store public key in vault
      const { data: publicKeyData, error: publicError } = await this.supabase
        .rpc('create_vault_secret', {
          secret_value: publicKey,
          name: `ssh_public_key_${keyName || 'default'}_${userId}`,
          description: `SSH public key for user ${userId}${keyName ? ` (${keyName})` : ''}`
        });

      if (publicError) throw new Error(`Failed to store public key: ${publicError.message}`);

      // Store private key in vault (more sensitive)
      const { data: privateKeyData, error: privateError } = await this.supabase
        .rpc('create_vault_secret', {
          secret_value: privateKey,
          name: `ssh_private_key_${keyName || 'default'}_${userId}`,
          description: `SSH private key for user ${userId}${keyName ? ` (${keyName})` : ''}`
        });

      if (privateError) {
        // Clean up public key if private key fails
        await this.deleteSSHKey(publicKeyData);
        throw new Error(`Failed to store private key: ${privateError.message}`);
      }

      // Store metadata in database
      await this.storeSSHKeyMetadata(userId, {
        public_key_vault_id: publicKeyData,
        private_key_vault_id: privateKeyData,
        key_name: keyName || 'default',
        fingerprint: this.generateKeyFingerprint(publicKey),
        created_at: new Date().toISOString()
      });

      return {
        publicKeyId: publicKeyData,
        privateKeyId: privateKeyData
      };
    } catch (error) {
      console.error('Error storing SSH key pair:', error);
      throw error;
    }
  }

  /**
   * Retrieve SSH keys from Supabase Vault
   * @param userId - User ID
   * @param keyName - Optional key name to retrieve specific key
   * @returns SSH key pair content
   */
  async getSSHKeyPair(
    userId: string, 
    keyName: string = 'default'
  ): Promise<{ publicKey: string; privateKey: string } | null> {
    try {
      // Get key metadata first
      const metadata = await this.getSSHKeyMetadata(userId, keyName);
      if (!metadata) return null;

      // Retrieve public key from vault
      const { data: publicKey, error: publicError } = await this.supabase
        .rpc('get_secret', { secret_id: metadata.public_key_vault_id });

      if (publicError) throw new Error(`Failed to retrieve public key: ${publicError.message}`);

      // Retrieve private key from vault
      const { data: privateKey, error: privateError } = await this.supabase
        .rpc('get_secret', { secret_id: metadata.private_key_vault_id });

      if (privateError) throw new Error(`Failed to retrieve private key: ${privateError.message}`);

      return {
        publicKey: publicKey.key || publicKey,
        privateKey: privateKey.key || privateKey
      };
    } catch (error) {
      console.error('Error retrieving SSH key pair:', error);
      return null;
    }
  }

  /**
   * Generate a new SSH key pair and store it securely
   * @param userId - User ID
   * @param keyName - Optional name for the key pair
   * @param keyType - Type of key (rsa, ed25519)
   * @returns Object with vault IDs and public key content
   */
  async generateAndStoreSSHKeyPair(
    userId: string,
    keyName: string = 'default',
    keyType: 'rsa' | 'ed25519' = 'rsa'
  ): Promise<{ publicKeyId: string; privateKeyId: string; publicKey: string; fingerprint: string }> {
    const keyPair = this.generateSSHKeyPair(keyType);
    
    const vaultIds = await this.storeSSHKeyPair(
      userId, 
      keyPair.publicKey, 
      keyPair.privateKey, 
      keyName
    );

    return {
      ...vaultIds,
      publicKey: keyPair.publicKey,
      fingerprint: this.generateKeyFingerprint(keyPair.publicKey)
    };
  }

  /**
   * Delete SSH keys from vault and metadata
   * @param userId - User ID
   * @param keyName - Key name to delete
   */
  async deleteSSHKeyPair(userId: string, keyName: string = 'default'): Promise<boolean> {
    try {
      const metadata = await this.getSSHKeyMetadata(userId, keyName);
      if (!metadata) return false;

      // Delete from vault
      await this.deleteSSHKey(metadata.public_key_vault_id);
      await this.deleteSSHKey(metadata.private_key_vault_id);

      // Delete metadata
      await this.deleteSSHKeyMetadata(userId, keyName);

      return true;
    } catch (error) {
      console.error('Error deleting SSH key pair:', error);
      return false;
    }
  }

  /**
   * List SSH keys for a user
   * @param userId - User ID
   * @returns Array of SSH key metadata
   */
  async listUserSSHKeys(userId: string): Promise<SSHKeyMetadata[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_ssh_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing SSH keys:', error);
      return [];
    }
  }

  // Private helper methods
  private generateSSHKeyPair(keyType: 'rsa' | 'ed25519' = 'rsa') {
    // Note: In a real implementation, you'd use a proper SSH key generation library
    // This is a simplified example using Node.js crypto
    if (keyType === 'rsa') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      // Convert to SSH format (this is simplified - real implementation would use ssh-keygen equivalent)
      const sshPublicKey = this.convertToSSHPublicKey(publicKey, 'rsa');
      
      return { publicKey: sshPublicKey, privateKey };
    }
    
    throw new Error(`Key type ${keyType} not implemented`);
  }

  private convertToSSHPublicKey(pemKey: string, keyType: string): string {
    // Simplified conversion - real implementation would properly format SSH keys
    // For now, return a placeholder that follows SSH key format
    const keyData = Buffer.from(pemKey).toString('base64').replace(/\n/g, '');
    return `ssh-${keyType} ${keyData} generated-key`;
  }

  private generateKeyFingerprint(publicKey: string): string {
    return crypto.createHash('sha256').update(publicKey).digest('hex').substr(0, 16);
  }

  private async deleteSSHKey(vaultId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('delete_vault_secret', { secret_id: vaultId });
    
    if (error) {
      console.warn(`Failed to delete vault secret ${vaultId}:`, error);
    }
  }

  private async storeSSHKeyMetadata(userId: string, metadata: Omit<SSHKeyMetadata, 'id' | 'user_id'>): Promise<void> {
    const { error } = await this.supabase
      .from('user_ssh_keys')
      .insert({
        user_id: userId,
        ...metadata
      });

    if (error) throw error;
  }

  private async getSSHKeyMetadata(userId: string, keyName: string): Promise<SSHKeyMetadata | null> {
    const { data, error } = await this.supabase
      .from('user_ssh_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error) return null;
    return data;
  }

  private async deleteSSHKeyMetadata(userId: string, keyName: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_ssh_keys')
      .delete()
      .eq('user_id', userId)
      .eq('key_name', keyName);

    if (error) throw error;
  }
}

// Types
export interface SSHKeyMetadata {
  id: string;
  user_id: string;
  public_key_vault_id: string;
  private_key_vault_id: string;
  key_name: string;
  fingerprint: string;
  created_at: string;
}

// Export convenience functions
export async function storeUserSSHKey(
  userId: string, 
  publicKey: string, 
  privateKey: string, 
  keyName?: string
) {
  const service = new SSHKeyService(
    process.env.SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return service.storeSSHKeyPair(userId, publicKey, privateKey, keyName);
}

export async function getUserSSHKey(userId: string, keyName?: string) {
  const service = new SSHKeyService(
    process.env.SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return service.getSSHKeyPair(userId, keyName);
} 