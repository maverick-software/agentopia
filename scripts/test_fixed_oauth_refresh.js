#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create two clients: one for admin operations, one for user operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFixedOAuthRefresh() {
  console.log('🧪 Testing Fixed OAuth Refresh Function');
  console.log('======================================\n');

  try {
    // Get the user's Gmail connection from the error logs
    const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
    const connectionId = 'bf521b7d-07a5-4197-a861-f0b0bd07fe1e';
    
    console.log('📋 Test Parameters:');
    console.log(`   User ID: ${userId}`);
    console.log(`   Connection ID: ${connectionId}`);
    console.log('');

    // First, authenticate as the user (using a user session token)
    // For testing purposes, we'll need to sign in as the user
    console.log('🔐 Authenticating as user...');
    
    // Note: In a real scenario, you'd have the user's session token
    // For testing, we'll use the admin client to get connection details
    const { data: connection, error: connError } = await supabaseAdmin
      .from('user_oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      console.error('❌ Error fetching connection:', connError);
      return;
    }

    console.log('📊 Current Connection State:');
    console.log(`   Status: ${connection.connection_status}`);
    console.log(`   Token expires: ${connection.token_expires_at}`);
    console.log(`   Refresh token ID: ${connection.vault_refresh_token_id}`);
    console.log(`   Last refresh: ${connection.last_token_refresh || 'Never'}`);
    console.log('');

    // Check if token is actually expired
    const tokenExpiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const isExpired = tokenExpiresAt <= now;
    
    console.log('⏰ Token Status:');
    console.log(`   Current time: ${now.toISOString()}`);
    console.log(`   Token expires: ${tokenExpiresAt.toISOString()}`);
    console.log(`   Is expired: ${isExpired ? '❌ YES' : '✅ NO'}`);
    console.log('');

    // Test the fixed oauth-refresh function
    console.log('🚀 Calling fixed oauth-refresh function...');
    console.log('');
    
    const { data, error } = await supabase.functions.invoke('oauth-refresh', {
      body: {
        connection_id: connectionId
      }
    });

    if (error) {
      console.error('❌ OAuth refresh error:', error);
      
      // Try to get more details from the error
      if (error.context) {
        console.error('Error context:', error.context);
      }
      return;
    }

    console.log('✅ OAuth refresh SUCCESS!');
    console.log('📋 Response:', data);
    console.log('');
    
    // Check the updated connection
    const { data: updatedConnection, error: updateError } = await supabaseAdmin
      .from('user_oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (updateError || !updatedConnection) {
      console.error('❌ Error fetching updated connection:', updateError);
      return;
    }

    console.log('📊 Updated Connection State:');
    console.log(`   Status: ${updatedConnection.connection_status}`);
    console.log(`   Token expires: ${updatedConnection.token_expires_at}`);
    console.log(`   Last refresh: ${updatedConnection.last_token_refresh}`);
    
    const newTokenExpiresAt = new Date(updatedConnection.token_expires_at);
    const refreshSuccessful = newTokenExpiresAt > now;
    
    console.log(`   New expiry valid: ${refreshSuccessful ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    if (refreshSuccessful) {
      console.log('🎉 TOKEN REFRESH FIXED SUCCESSFULLY!');
      console.log(`   New token valid until: ${newTokenExpiresAt.toLocaleString()}`);
    } else {
      console.log('⚠️  Token refresh may not have worked correctly');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
testFixedOAuthRefresh().catch(console.error);
