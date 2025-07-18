import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';

async function checkActualTokenValues() {
  console.log('Checking actual token values\n');
  console.log('===========================\n');

  try {
    // Get the raw connection data
    const { data: connection, error } = await supabase
      .from('user_oauth_connections')
      .select('vault_access_token_id, vault_refresh_token_id')
      .eq('user_id', USER_ID)
      .single();

    if (error) {
      console.error('Error fetching connection:', error);
      return;
    }

    console.log('Raw vault field values:');
    console.log('- vault_access_token_id:', connection.vault_access_token_id);
    console.log('- vault_refresh_token_id:', connection.vault_refresh_token_id);
    
    // Check if they look like OAuth tokens (longer strings with dots) or UUIDs
    const accessTokenValue = connection.vault_access_token_id;
    const refreshTokenValue = connection.vault_refresh_token_id;
    
    console.log('\nToken analysis:');
    console.log('- Access token looks like UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accessTokenValue));
    console.log('- Access token looks like OAuth token:', accessTokenValue && accessTokenValue.includes('.'));
    console.log('- Access token length:', accessTokenValue?.length);
    
    console.log('\n- Refresh token looks like UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refreshTokenValue));
    console.log('- Refresh token looks like OAuth token:', refreshTokenValue && refreshTokenValue.includes('1//'));
    console.log('- Refresh token length:', refreshTokenValue?.length);

    // Check the vault.secrets table directly
    console.log('\nChecking vault.secrets table...');
    const { data: vaultSecrets, error: vaultError } = await supabase
      .from('vault.secrets')
      .select('id, name')
      .or(`id.eq.${accessTokenValue},id.eq.${refreshTokenValue}`);

    if (vaultError) {
      console.log('Cannot access vault.secrets table (expected - requires special permissions)');
    } else {
      console.log('Found vault secrets:', vaultSecrets);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkActualTokenValues(); 