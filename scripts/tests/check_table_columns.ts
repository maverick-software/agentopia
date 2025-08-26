#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableColumns() {
  console.log('🔍 Checking agent_oauth_permissions table structure\n');

  // Try to query existing records to see what columns exist
  console.log('1. Checking existing permissions records...');
  const { data: permissions, error: permError } = await supabase
    .from('agent_oauth_permissions')
    .select('*')
    .limit(1);

  if (permError) {
    console.error('Error querying permissions:', permError);
  } else {
    console.log(`Found ${permissions?.length || 0} permission records`);
    if (permissions && permissions.length > 0) {
      console.log('✅ Existing record columns:', Object.keys(permissions[0]));
    } else {
      console.log('📝 No existing records to check columns from');
    }
  }

  // Try a simple insert to see what columns are expected
  console.log('\n2. Testing insert to discover required columns...');
  const testData = {
    agent_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    user_oauth_connection_id: '00000000-0000-0000-0000-000000000000',
    granted_scopes: ['test'],
    is_active: true
  };

  const { data: insertResult, error: insertError } = await supabase
    .from('agent_oauth_permissions')
    .insert(testData)
    .select();

  if (insertError) {
    console.log('❌ Insert error (this tells us about the table structure):');
    console.log(JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ Successful insert (will clean up):', insertResult);
    // Clean up the test record
    if (insertResult && insertResult[0]) {
      await supabase
        .from('agent_oauth_permissions')
        .delete()
        .eq('id', insertResult[0].id);
      console.log('🧹 Cleaned up test record');
    }
  }
}

checkTableColumns().catch(console.error);
