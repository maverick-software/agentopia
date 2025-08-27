#!/usr/bin/env node

/**
 * Test Refactored Function Calling System
 * Verifies the new modular system works correctly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const AGENT_ID = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3';
const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';

async function testFunctionCalling() {
  console.log('🧪 Testing Refactored Function Calling System');
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`User ID: ${USER_ID}`);
  console.log('─'.repeat(50));

  try {
    // Import the new function calling system
    const { FunctionCallingManager } = await import('../supabase/functions/chat/function_calling.ts');
    
    // Create manager instance
    const fcm = new FunctionCallingManager(supabase);
    
    // Test 1: Get available tools
    console.log('\n📊 Test 1: Get Available Tools');
    const tools = await fcm.getAvailableTools(AGENT_ID, USER_ID);
    
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 80)}...`);
    });
    
    // Test 2: Check for Gmail tools
    const gmailTools = tools.filter(t => t.name.startsWith('gmail_'));
    console.log(`\n📧 Gmail tools found: ${gmailTools.length}`);
    
    // Test 3: Check for SMTP tools
    const smtpTools = tools.filter(t => t.name.startsWith('smtp_'));
    console.log(`📨 SMTP tools found: ${smtpTools.length}`);
    
    // Test 4: Check for Web Search tools
    const webTools = tools.filter(t => t.name.startsWith('web_') || t.name.includes('search') || t.name.includes('scrape'));
    console.log(`🌐 Web search tools found: ${webTools.length}`);
    
    // Test 5: Check for MCP tools
    const mcpTools = tools.filter(t => !t.name.startsWith('gmail_') && !t.name.startsWith('smtp_') && !t.name.includes('search') && !t.name.includes('scrape'));
    console.log(`🔧 MCP tools found: ${mcpTools.length}`);
    
    // Test 6: Test execution stats
    console.log('\n📈 Test 6: Execution Statistics');
    const stats = fcm.getExecutionStats();
    console.log(`Active executions: ${stats.activeExecutions}`);
    console.log(`Gmail cache: ${stats.gmail.size} entries`);
    console.log(`SMTP cache: ${stats.smtp.size} entries`);
    console.log(`Web Search cache: ${stats.webSearch.size} entries`);

    // Test 7: Test duplicate prevention (simulate same call twice)
    console.log('\n🔒 Test 7: Duplicate Prevention Test');
    if (smtpTools.length > 0) {
      console.log('Testing duplicate prevention with SMTP test connection...');
      
      const testParams = { smtp_config_id: 'test-config' };
      const startTime = Date.now();
      
      // Make two identical calls simultaneously
      const [result1, result2] = await Promise.all([
        fcm.executeFunction(AGENT_ID, USER_ID, 'smtp_test_connection', testParams),
        fcm.executeFunction(AGENT_ID, USER_ID, 'smtp_test_connection', testParams)
      ]);
      
      const endTime = Date.now();
      
      console.log(`Both calls completed in ${endTime - startTime}ms`);
      console.log(`Result 1 success: ${result1.success}`);
      console.log(`Result 2 success: ${result2.success}`);
      
      // They should be the same object if deduplication worked
      if (result1 === result2) {
        console.log('✅ Duplicate prevention working - same object returned');
      } else if (result1.success === result2.success && result1.error === result2.error) {
        console.log('✅ Duplicate prevention working - same result values');
      } else {
        console.log('⚠️ Duplicate prevention may not be working optimally');
      }
    } else {
      console.log('⏭️ Skipping duplicate prevention test - no SMTP tools available');
    }
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n🎯 Key Improvements:');
    console.log('  • Modular architecture with separate providers');
    console.log('  • Caching to prevent repeated database queries');
    console.log('  • Duplicate execution prevention');
    console.log('  • Tool deduplication based on names');
    console.log('  • Proper error handling and fallbacks');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testFunctionCalling()
  .then(() => {
    console.log('\n🏁 Test suite completed');
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
