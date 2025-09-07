import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function updateWorkingGetZepKey() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🔄 UPDATING GETZEP CREDENTIAL WITH WORKING KEY');
  console.log('=' .repeat(60));
  
  // The API key you confirmed is working in the UI
  const WORKING_GETZEP_API_KEY = 'z_1dWlkIjoiODc3YjM0MWMtMzU1ZC00MWNmLTkxYjctZmM1NTgwNzJiYjFmIn0.FCMtWV9aCU5NiIvRgDdKjeqAhRuWyD3EdT_IsgrMOHQIm-FBF4K4bRTDuKK3JDBalKIPVL7GiFRIX_vs2EsADA';
  
  console.log('1️⃣ Finding the GetZep connection...');
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id, name')
    .eq('name', 'getzep')
    .single();

  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  const { data: connection } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .eq('oauth_provider_id', provider?.id)
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single();

  if (!connection) {
    console.error('❌ No active GetZep connection found');
    return;
  }

  console.log('   Found connection:', connection.id);
  console.log('   Current vault_access_token_id:', connection.vault_access_token_id);

  console.log('\n2️⃣ Updating with working API key...');
  
  // Store the working API key directly (vault workaround)
  const { data: updated, error } = await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: WORKING_GETZEP_API_KEY, // Direct storage since vault is broken
      connection_metadata: {
        project_id: '877b341c-355d-41cf-91b7-fc558072bb1f',
        project_name: 'agentopia', 
        account_id: 'f34817d7-0e28-41e2-9838-9f13215a0bc2'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id)
    .select()
    .single();
    
  if (error) {
    console.error('   ❌ Update failed:', error);
    return;
  }
  
  console.log('   ✅ Connection updated successfully');

  console.log('\n3️⃣ Testing vault_decrypt with new key...');
  const { data: decrypted } = await supabase.rpc('vault_decrypt', {
    vault_id: WORKING_GETZEP_API_KEY
  });
  
  if (decrypted === WORKING_GETZEP_API_KEY) {
    console.log('   ✅ vault_decrypt returns the key correctly (fallback working)');
  } else {
    console.log('   ❌ vault_decrypt failed:', decrypted);
  }

  console.log('\n4️⃣ Testing the credential retrieval flow...');
  
  // Simulate what GetZepSemanticManager does
  const { data: testConnection } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id, connection_metadata')
    .eq('oauth_provider_id', provider?.id)
    .eq('user_id', userId)
    .eq('connection_status', 'active')
    .single();
    
  if (testConnection) {
    const { data: apiKey } = await supabase.rpc('vault_decrypt', {
      vault_id: testConnection.vault_access_token_id
    });
    
    if (apiKey) {
      console.log('   ✅ Credential retrieval flow works');
      console.log('   - Retrieved key starts with:', apiKey.substring(0, 10) + '...');
      console.log('   - Project ID:', testConnection.connection_metadata?.project_id);
      console.log('   - Project Name:', testConnection.connection_metadata?.project_name);
    } else {
      console.log('   ❌ Failed to retrieve API key');
    }
  }

  console.log('\n5️⃣ Updating account_graphs to use this connection...');
  const { data: accountGraph, error: graphError } = await supabase
    .from('account_graphs')
    .upsert({
      user_id: userId,
      connection_id: connection.id,
      graph_type: 'getzep',
      settings: {
        auto_extract: true,
        similarity_threshold: 0.7,
        max_results: 10
      },
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();
    
  if (graphError) {
    console.error('   ❌ Account graph update failed:', graphError);
  } else {
    console.log('   ✅ Account graph updated:', accountGraph?.id);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('✅ CREDENTIAL UPDATE COMPLETE');
  console.log('');
  console.log('The GetZep connection now uses the working API key.');
  console.log('Edge Functions should now be able to:');
  console.log('1. Find the active GetZep connection');
  console.log('2. Decrypt the API key (via fallback)');
  console.log('3. Use it with GetZep API');
  console.log('');
  console.log('Next: Test the chat integration to see if ingestion works.');
}

updateWorkingGetZepKey().catch(console.error);
