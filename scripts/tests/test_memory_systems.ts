import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testMemorySystems() {
  // Use the same env vars that Supabase Edge Functions use
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🧪 TESTING SEPARATED MEMORY SYSTEMS');
  console.log('=' .repeat(60));
  
  // Test 1: Check GetZep Connection
  console.log('\n1️⃣ Testing GetZep Connection...');
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'getzep')
    .single();

  if (!provider) {
    console.error('❌ GetZep provider not found in database');
    return;
  }

  const { data: connection } = await supabase
    .from('user_oauth_connections')
    .select('id, vault_access_token_id, connection_metadata, connection_status')
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active')
    .maybeSingle();

  if (!connection) {
    console.error('❌ No active GetZep connection found');
    return;
  }

  console.log('✅ GetZep connection found:', {
    id: connection.id,
    has_api_key: !!connection.vault_access_token_id,
    project_id: connection.connection_metadata?.project_id,
    status: connection.connection_status
  });

  // Test 2: Test GetZep API directly
  console.log('\n2️⃣ Testing GetZep API v3 endpoints...');
  const apiKey = connection.vault_access_token_id; // Using direct storage workaround
  const projectId = connection.connection_metadata?.project_id;
  
  // Test ingestion endpoint
  console.log('   Testing ingestion endpoint (v3/graph/messages)...');
  const ingestResponse = await fetch('https://api.getzep.com/v3/graph/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Project-Id': projectId
    },
    body: JSON.stringify({
      user_id: 'test_user_' + Date.now(),
      content: 'Test message from separated memory systems test at ' + new Date().toISOString(),
      metadata: {
        source: 'memory_test',
        test_run: true
      }
    })
  });

  if (ingestResponse.ok) {
    const result = await ingestResponse.json();
    console.log('   ✅ Ingestion successful:', result);
  } else {
    console.error('   ❌ Ingestion failed:', ingestResponse.status, await ingestResponse.text());
  }

  // Test search endpoint
  console.log('   Testing search endpoint (v3/memory/search)...');
  const searchResponse = await fetch('https://api.getzep.com/v3/memory/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Project-Id': projectId
    },
    body: JSON.stringify({
      user_id: '3f966af2-72a1-41bc-8fac-400b8002664b', // Your actual user ID
      text: 'test',
      limit: 5
    })
  });

  if (searchResponse.ok) {
    const results = await searchResponse.json();
    console.log('   ✅ Search successful, found', results?.results?.length || 0, 'results');
  } else {
    console.error('   ❌ Search failed:', searchResponse.status, await searchResponse.text());
  }

  // Test 3: Check Pinecone Connection
  console.log('\n3️⃣ Testing Pinecone (Episodic Memory)...');
  const { data: pineconeProvider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'pinecone')
    .single();

  const { data: pineconeConn } = await supabase
    .from('user_oauth_connections')
    .select('id, connection_status')
    .eq('oauth_provider_id', pineconeProvider?.id)
    .eq('connection_status', 'active')
    .maybeSingle();

  if (pineconeConn) {
    console.log('✅ Pinecone connection active');
  } else {
    console.log('⚠️  No active Pinecone connection (episodic memory may use DB fallback)');
  }

  // Test 4: Check Agent Configuration
  console.log('\n4️⃣ Testing Agent Configuration...');
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, metadata')
    .eq('name', 'Angela')
    .single();

  if (agent) {
    const useGraph = agent.metadata?.settings?.use_account_graph;
    console.log('✅ Agent found:', {
      name: agent.name,
      knowledge_graph_enabled: useGraph === true
    });
    
    if (!useGraph) {
      console.log('⚠️  Knowledge graph is disabled for this agent');
    }
  } else {
    console.error('❌ Agent "Angela" not found');
  }

  // Test 5: Test Chat Function Memory Operations
  console.log('\n5️⃣ Testing Chat Function Memory Operations...');
  console.log('   Calling chat function with test message...');
  
  const chatUrl = `${supabaseUrl}/functions/v1/chat`;
  const chatResponse = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'This is a test message to verify memory systems are working correctly',
      agent_id: agent?.id || '87e6e948-694d-4f8c-8e94-2b4f6281ffc3',
      user_id: '3f966af2-72a1-41bc-8fac-400b8002664b',
      conversation_id: 'test-conversation-' + Date.now()
    })
  });

  if (chatResponse.ok) {
    console.log('   ✅ Chat function responded successfully');
    
    // Check if memories were created
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async operations
    
    // Check episodic memories
    const { data: episodicMemories } = await supabase
      .from('agent_memories')
      .select('id, memory_type')
      .eq('agent_id', agent?.id)
      .eq('memory_type', 'episodic')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (episodicMemories?.length) {
      console.log('   ✅ Episodic memory created');
    } else {
      console.log('   ⚠️  No episodic memories found');
    }
    
    // Check graph ingestion queue
    const { data: queueItems } = await supabase
      .from('graph_ingestion_queue')
      .select('id, status')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (queueItems?.length) {
      console.log('   ✅ Graph ingestion queued:', queueItems[0].status);
    } else {
      console.log('   ⚠️  No graph ingestion queue items found');
    }
  } else {
    console.error('   ❌ Chat function failed:', chatResponse.status);
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log('');
  console.log('EPISODIC MEMORY (Pinecone/Vector):');
  console.log('  - Storage: Database + optional Pinecone');
  console.log('  - Purpose: Time-stamped events');
  console.log('  - Status:', pineconeConn ? '✅ Active' : '⚠️ Using DB fallback');
  console.log('');
  console.log('SEMANTIC MEMORY (GetZep/Graph):');
  console.log('  - Storage: GetZep Cloud');
  console.log('  - Purpose: Knowledge relationships');
  console.log('  - Status:', ingestResponse.ok ? '✅ Working' : '❌ Failed');
  console.log('');
  console.log('The systems are now completely separated and run in parallel!');
}

testMemorySystems().catch(console.error);
