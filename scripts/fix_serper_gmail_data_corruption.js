#!/usr/bin/env node

/**
 * Fix data corruption: Serper API connections wrongly linked to Gmail provider ID
 * Issue: Records in user_integration_credentials have serper_api in connection_name 
 *        but Gmail's oauth_provider_id instead of Serper API's provider ID
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findCorruptedRecords() {
  console.log('🔍 Investigating corrupted data in user_integration_credentials...\n');

  try {
    // Step 1: Get provider IDs for reference
    const { data: providers, error: providersError } = await supabase
      .from('oauth_providers')
      .select('id, name, display_name')
      .in('name', ['gmail', 'serper_api'])
      .order('name');

    if (providersError) {
      console.error('❌ Error fetching OAuth providers:', providersError);
      return;
    }

    const gmailProvider = providers.find(p => p.name === 'gmail');
    const serperProvider = providers.find(p => p.name === 'serper_api');

    console.log('📋 OAuth Provider IDs:');
    console.log(`   Gmail: ${gmailProvider.id}`);
    console.log(`   Serper API: ${serperProvider.id}\n`);

    // Step 2: Find corrupted records - connection names suggesting serper but gmail provider ID
    const { data: corruptedRecords, error: corruptedError } = await supabase
      .from('user_integration_credentials')
      .select(`
        id,
        user_id,
        connection_name,
        external_username,
        oauth_provider_id,
        oauth_providers!inner (
          name,
          display_name
        )
      `)
      .eq('oauth_provider_id', gmailProvider.id)
      .or(`connection_name.ilike.%serper%,external_username.ilike.%serper%`);

    if (corruptedError) {
      console.error('❌ Error finding corrupted records:', corruptedError);
      return;
    }

    console.log(`🚨 Found ${corruptedRecords.length} potentially corrupted records:\n`);
    
    corruptedRecords.forEach((record, index) => {
      console.log(`${index + 1}. Record ID: ${record.id}`);
      console.log(`   Connection Name: "${record.connection_name}"`);
      console.log(`   External Username: "${record.external_username}"`);
      console.log(`   Current Provider: ${record.oauth_providers.name} (${record.oauth_providers.display_name})`);
      console.log(`   Should be: serper_api (Serper API)`);
      console.log('');
    });

    // Step 3: Check agent_integration_permissions that reference these corrupted connections
    if (corruptedRecords.length > 0) {
      const corruptedConnectionIds = corruptedRecords.map(r => r.id);
      
      const { data: affectedPermissions, error: permissionsError } = await supabase
        .from('agent_integration_permissions')
        .select(`
          id,
          agent_id,
          user_oauth_connection_id,
          agents!inner (
            name
          )
        `)
        .in('user_oauth_connection_id', corruptedConnectionIds);

      if (permissionsError) {
        console.error('❌ Error finding affected permissions:', permissionsError);
        return;
      }

      console.log(`🔗 Found ${affectedPermissions.length} agent permissions affected by corrupted connections:\n`);
      
      affectedPermissions.forEach((perm, index) => {
        console.log(`${index + 1}. Agent: "${perm.agents.name}" (${perm.agent_id})`);
        console.log(`   Permission ID: ${perm.id}`);
        console.log(`   Corrupted Connection ID: ${perm.user_oauth_connection_id}`);
        console.log('');
      });
    }

    return {
      gmailProviderId: gmailProvider.id,
      serperProviderId: serperProvider.id,
      corruptedRecords,
      totalCorrupted: corruptedRecords.length
    };

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

async function fixCorruptedRecords(gmailProviderId, serperProviderId, corruptedRecords) {
  if (corruptedRecords.length === 0) {
    console.log('✅ No corrupted records found to fix.');
    return;
  }

  console.log(`🔧 Fixing ${corruptedRecords.length} corrupted records...\n`);

  for (const record of corruptedRecords) {
    try {
      console.log(`Fixing record ${record.id}: "${record.connection_name}"`);
      
      const { error: updateError } = await supabase
        .from('user_integration_credentials')
        .update({
          oauth_provider_id: serperProviderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (updateError) {
        console.error(`❌ Failed to fix record ${record.id}:`, updateError.message);
      } else {
        console.log(`✅ Fixed record ${record.id}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing record ${record.id}:`, error.message);
    }
  }

  console.log('\n🎉 Data corruption fix completed!');
}

async function main() {
  console.log('🚀 Starting Serper API data corruption fix...\n');
  
  const result = await findCorruptedRecords();
  
  if (!result) {
    console.log('❌ Could not complete investigation. Exiting.');
    return;
  }

  if (result.totalCorrupted > 0) {
    console.log('🔧 Proceeding with fixes...\n');
    await fixCorruptedRecords(result.gmailProviderId, result.serperProviderId, result.corruptedRecords);
    
    console.log('\n✅ Fix completed! Please test the channels modal now.');
    console.log('   Serper API connections should now show as "Serper API" instead of "Gmail"');
  } else {
    console.log('✅ No data corruption found. The issue might be elsewhere.');
  }
}

main().catch(console.error);
