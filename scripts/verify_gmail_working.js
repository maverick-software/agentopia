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

async function verifyGmailWorking() {
  console.log('Gmail Integration Status Check\n');
  console.log('==============================\n');

  try {
    // 1. Check OAuth connection
    console.log('1. Checking OAuth Connection...');
    const { data: connection, error: connError } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', USER_ID)
      .single();

    if (connError) {
      console.error('  ❌ Error fetching connection:', connError);
      return;
    }

    console.log('  ✅ OAuth connection found');
    console.log(`  - Email: ${connection.external_username}`);
    console.log(`  - Status: ${connection.connection_status}`);
    console.log(`  - Token expires: ${connection.token_expires_at}`);
    
    const tokenExpiry = new Date(connection.token_expires_at);
    const now = new Date();
    const isExpired = tokenExpiry < now;
    
    console.log(`  - Token status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    
    // 2. Check Gmail agent
    console.log('\n2. Checking Gmail Agent...');
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', USER_ID)
      .ilike('name', '%gmail%');
    
    if (agentsError || !agents || agents.length === 0) {
      console.error('  ❌ No Gmail agent found');
      return;
    }

    const gmailAgent = agents[0];
    console.log(`  ✅ Found agent: ${gmailAgent.name} (ID: ${gmailAgent.id})`);

    // 3. Check agent permissions
    console.log('\n3. Checking Agent Permissions...');
    const { data: permissions, error: permError } = await supabase
      .from('agent_oauth_permissions')
      .select('*')
      .eq('agent_id', gmailAgent.id)
      .eq('user_oauth_connection_id', connection.id);

    if (permError || !permissions || permissions.length === 0) {
      console.error('  ❌ No permissions found for agent');
      return;
    }

    console.log(`  ✅ Found ${permissions.length} permission record(s)`);
    permissions.forEach(perm => {
      console.log(`  - Scopes: ${perm.allowed_scopes.join(', ')}`);
      console.log(`  - Active: ${perm.is_active ? '✅ Yes' : '❌ No'}`);
    });

    // 4. Check available tools via RPC
    console.log('\n4. Checking Available Tools...');
    const { data: tools, error: toolsError } = await supabase.rpc('get_gmail_tools', {
      p_agent_id: gmailAgent.id,
      p_user_id: USER_ID
    });

    if (toolsError) {
      console.error('  ❌ Error fetching tools:', toolsError);
      return;
    }

    if (!tools || tools.length === 0) {
      console.error('  ❌ No tools available');
      return;
    }

    console.log(`  ✅ ${tools.length} Gmail tools available:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 50)}...`);
    });

    // 5. Check recent tool executions
    console.log('\n5. Recent Tool Executions...');
    const { data: logs, error: logsError } = await supabase
      .from('tool_execution_logs')
      .select('*')
      .eq('agent_id', gmailAgent.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.error('  ❌ Error fetching logs:', logsError);
    } else if (logs && logs.length > 0) {
      console.log(`  Found ${logs.length} recent executions:`);
      logs.forEach(log => {
        const time = new Date(log.created_at).toLocaleString();
        console.log(`  - ${time}: ${log.tool_name} (${log.status})`);
        if (log.error_message) {
          console.log(`    Error: ${log.error_message}`);
        }
      });
    } else {
      console.log('  No recent tool executions found.');
    }

    console.log('\n✅ Gmail integration appears to be properly configured!');
    console.log('\nTo send an email, chat with your Gmail agent and ask it to send an email.');
    console.log('Make sure to use the exact phrase "send an email" or "send_email".');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

verifyGmailWorking(); 