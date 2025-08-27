// Debug script to check agent knowledge setup
// Run this in browser console on the agent chat page

async function debugAgentKnowledge() {
  console.log('🔍 DEBUGGING AGENT KNOWLEDGE SETUP');
  console.log('=====================================');
  
  // Get agent data from the page
  const agentName = 'Angela'; // Change this to match your agent
  
  console.log(`📋 Checking setup for agent: ${agentName}`);
  
  try {
    // This assumes you're on a page where supabase client is available
    // You might need to adjust this based on your app structure
    
    if (typeof supabase === 'undefined') {
      console.error('❌ Supabase client not found. Run this on a page where supabase is loaded.');
      return;
    }

    // 1. Find the agent ID
    console.log('\n1️⃣ Finding agent...');
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('name', agentName);
    
    if (agentError) {
      console.error('❌ Error finding agent:', agentError);
      return;
    }
    
    if (!agents || agents.length === 0) {
      console.error(`❌ Agent "${agentName}" not found`);
      return;
    }
    
    const agent = agents[0];
    console.log('✅ Agent found:', agent);
    
    // 2. Check datastore connections
    console.log('\n2️⃣ Checking datastore connections...');
    const { data: connections, error: connectionError } = await supabase
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          name,
          type,
          config,
          similarity_threshold,
          max_results
        )
      `)
      .eq('agent_id', agent.id);
    
    if (connectionError) {
      console.error('❌ Error checking connections:', connectionError);
      return;
    }
    
    console.log('📊 Datastore connections:', connections);
    
    // Check for Pinecone specifically
    const pineconeConnections = connections?.filter(c => c.datastores?.type === 'pinecone') || [];
    const getzepConnections = connections?.filter(c => c.datastores?.type === 'getzep') || [];
    
    console.log(`📈 Pinecone datastores: ${pineconeConnections.length}`);
    console.log(`🧠 GetZep datastores: ${getzepConnections.length}`);
    
    if (pineconeConnections.length === 0) {
      console.warn('⚠️  NO PINECONE DATASTORE CONNECTED!');
      console.log('💡 This is likely why document knowledge isn\'t working.');
      console.log('💡 Connect a Pinecone datastore to enable document search.');
    } else {
      console.log('✅ Pinecone datastore(s) found:');
      pineconeConnections.forEach(conn => {
        const ds = conn.datastores;
        console.log(`   - ${ds.name} (${ds.id})`);
        console.log(`     Config keys: ${Object.keys(ds.config || {}).join(', ')}`);
        console.log(`     Similarity threshold: ${ds.similarity_threshold}`);
        console.log(`     Max results: ${ds.max_results}`);
      });
    }
    
    // 3. Check processed documents
    console.log('\n3️⃣ Checking processed documents...');
    const { data: documents, error: docError } = await supabase
      .from('datastore_documents')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (docError) {
      console.error('❌ Error checking documents:', docError);
    } else {
      console.log(`📄 Processed documents: ${documents?.length || 0}`);
      if (documents && documents.length > 0) {
        documents.forEach(doc => {
          console.log(`   - ${doc.file_name} (${doc.processing_status})`);
          if (doc.error_message) {
            console.log(`     Error: ${doc.error_message}`);
          }
        });
      } else {
        console.warn('⚠️  No processed documents found!');
      }
    }
    
    // 4. Test vector search if Pinecone is connected
    if (pineconeConnections.length > 0) {
      console.log('\n4️⃣ Testing vector search...');
      console.log('💭 Try asking the agent about your uploaded document content.');
      console.log('💭 Check the network tab for chat requests to see vector search logs.');
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('===================');
    
    if (pineconeConnections.length === 0) {
      console.log('🔧 TO FIX: Connect a Pinecone vector datastore to the agent');
      console.log('   1. Go to Memory/Datastores page');
      console.log('   2. Create or select a Pinecone datastore');
      console.log('   3. Connect it to your agent via the knowledge modal');
    } else if (!documents || documents.length === 0) {
      console.log('🔧 TO FIX: Upload and process documents');
      console.log('   1. Open the "What I Know" modal (lightbulb icon)');
      console.log('   2. Upload documents in the file upload section');
      console.log('   3. Wait for processing to complete');
    } else {
      console.log('✅ Setup looks good! Check the chat logs for vector search details.');
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug function
debugAgentKnowledge();