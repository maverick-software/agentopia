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

async function checkGmailAgentInstructions() {
  console.log('Checking Gmail Agent Instructions\n');
  console.log('==================================\n');

  try {
    // Find Gmail agent
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', USER_ID)
      .ilike('name', '%gmail%');
    
    if (agentsError) {
      console.error('Error finding agents:', agentsError);
      return;
    }

    if (!agents || agents.length === 0) {
      console.error('No Gmail agent found');
      return;
    }

    const gmailAgent = agents[0];
    console.log(`Gmail Agent: ${gmailAgent.name} (ID: ${gmailAgent.id})\n`);

    // Display current instructions
    console.log('=== SYSTEM INSTRUCTIONS ===');
    console.log(gmailAgent.system_instructions || '(No system instructions set)');
    console.log('\n');
    
    console.log('=== ASSISTANT INSTRUCTIONS ===');
    console.log(gmailAgent.assistant_instructions || '(No assistant instructions set)');
    console.log('\n');
    
    console.log('=== PERSONALITY ===');
    console.log(gmailAgent.personality || '(No personality set)');
    console.log('\n');

    // Check for problematic tool names in instructions
    const problematicPatterns = [
      'gmail_send_message',
      'gmail_read_messages',
      'gmail_search',
      'gmail_'
    ];

    console.log('=== CHECKING FOR PROBLEMATIC TOOL NAMES ===');
    
    const allInstructions = [
      gmailAgent.system_instructions,
      gmailAgent.assistant_instructions,
      gmailAgent.personality
    ].filter(Boolean).join(' ');

    let foundProblems = false;
    problematicPatterns.forEach(pattern => {
      if (allInstructions.includes(pattern)) {
        console.log(`❌ Found problematic pattern: "${pattern}"`);
        foundProblems = true;
      }
    });

    if (!foundProblems) {
      console.log('✅ No problematic tool names found in instructions');
    } else {
      console.log('\n⚠️  WARNING: Agent instructions contain incorrect tool names!');
      console.log('The correct tool names are:');
      console.log('- send_email (NOT gmail_send_message)');
      console.log('- read_emails (NOT gmail_read_messages)');
      console.log('- search_emails (NOT gmail_search)');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkGmailAgentInstructions(); 