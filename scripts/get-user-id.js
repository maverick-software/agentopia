#!/usr/bin/env node

/**
 * Script to get your Supabase User ID
 * 
 * Usage: node scripts/get-user-id.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔍 Finding your Supabase User ID');
  console.log('===============================');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users (limited to recent ones)
    const { data: users, error } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching users:', error);
      console.log('\n💡 Alternative: Check your Supabase dashboard:');
      console.log('   1. Go to https://app.supabase.com');
      console.log('   2. Select your project');
      console.log('   3. Go to Authentication -> Users');
      console.log('   4. Find your user and copy the ID');
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found in the database');
      console.log('\n💡 Please check your Supabase dashboard:');
      console.log('   1. Go to https://app.supabase.com');
      console.log('   2. Select your project');
      console.log('   3. Go to Authentication -> Users');
      process.exit(1);
    }

    console.log('📋 Recent users in your Supabase project:');
    console.log('');
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email || 'No email'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    console.log('💡 To use an ID in the next script, set it as an environment variable:');
    console.log('   set USER_ID=your-chosen-user-id');
    console.log('   OR edit the script directly');

  } catch (error) {
    console.error('💥 Script failed:', error);
    console.log('\n💡 Manual method: Check your Supabase dashboard:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. Select your project');
    console.log('   3. Go to Authentication -> Users');
    console.log('   4. Find your user and copy the ID');
  }
}

main(); 