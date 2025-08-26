#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugGrantPermission() {
  const testUserId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  const testAgentId = 'b4aa3e37-b21d-49ce-bfd8-bc2c7b74439d';
  const testCredentialId = '9b7ff8d9-14a8-40ca-8fe1-6fd4c668aab4';

  console.log('🔍 Debugging Grant Permission Function\n');

  // 1. Check if the credential exists
  console.log('1. Checking if credential exists...');
  const { data: credential, error: credError } = await supabase
    .from('user_integration_credentials')
    .select('*')
    .eq('id', testCredentialId)
    .eq('user_id', testUserId)
    .single();

  if (credError) {
    console.log('❌ Credential query error:', credError);
    return;
  }
  console.log('✅ Credential found:', credential?.connection_name, credential?.connection_status);

  // 2. Check if agent exists
  console.log('\n2. Checking if agent exists...');
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', testAgentId)
    .eq('user_id', testUserId)
    .single();

  if (agentError) {
    console.log('❌ Agent query error:', agentError);
    return;
  }
  console.log('✅ Agent found:', agent?.name);

  // 3. Test auth.uid() with service role
  console.log('\n3. Testing auth.uid() with service role...');
  const { data: authTest, error: authError } = await supabase
    .rpc('auth_uid_test');

  console.log('Auth test result:', authTest, 'Error:', authError);

  // 4. Try calling the function directly with explicit user context
  console.log('\n4. Testing function call with explicit user_id...');
  const { data: grantResult, error: grantError } = await supabase
    .rpc('grant_agent_integration_permission', {
      p_agent_id: testAgentId,
      p_connection_id: testCredentialId,
      p_allowed_scopes: ['send_email'],
      p_permission_level: 'custom',
      p_user_id: testUserId  // ← ADD THE USER ID PARAMETER
    });

  if (grantError) {
    console.log('❌ Grant function error:', JSON.stringify(grantError, null, 2));
  } else {
    console.log('✅ Grant function success:', grantResult);
  }
}

debugGrantPermission().catch(console.error);
