import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTokenValues() {
  console.log('Checking actual token values in database...\n');
  
  // Check the actual token values
  const { data: connections, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('id, vault_access_token_id, vault_refresh_token_id, connection_status, external_username')
    .eq('connection_status', 'active');
    
  if (connError) {
    console.error('Error fetching connections:', connError);
    return;
  }
    
  if (connections && connections.length > 0) {
    const conn = connections[0];
    console.log('Connection ID:', conn.id);
    console.log('External username:', conn.external_username);
    console.log('Connection status:', conn.connection_status);
    console.log('\nToken values:');
    console.log('Access token ID:', conn.vault_access_token_id);
    console.log('Refresh token ID:', conn.vault_refresh_token_id);
    
    // Check if they're UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    console.log('\nAccess token is UUID:', uuidRegex.test(conn.vault_access_token_id));
    console.log('Refresh token is UUID:', uuidRegex.test(conn.vault_refresh_token_id));
    
    // If they're UUIDs, try to get from vault
    if (uuidRegex.test(conn.vault_access_token_id)) {
      console.log('\nTokens appear to be vault IDs. The gmail-api function needs to decrypt them.');
      console.log('This means we need the vault system to be properly configured.');
    } else {
      console.log('\nTokens appear to be stored directly (not UUIDs).');
    }
  }
  
  process.exit(0);
}

checkTokenValues().catch(console.error); 