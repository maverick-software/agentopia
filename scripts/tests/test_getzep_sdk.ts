import 'dotenv/config';

async function testGetZepSDK() {
  console.log('🧪 TESTING GETZEP SDK IMPORT AND USAGE');
  console.log('=' .repeat(60));
  
  const GETZEP_API_KEY = 'z_1dWlkIjoiODc3YjM0MWMtMzU1ZC00MWNmLTkxYjctZmM1NTgwNzJiYjFmIn0.FCMtWV9aCU5NiIvRgDdKjeqAhRuWyD3EdT_IsgrMOHQIm-FBF4K4bRTDuKK3JDBalKIPVL7GiFRIX_vs2EsADA';
  const PROJECT_ID = '877b341c-355d-41cf-91b7-fc558072bb1f';
  const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';
  
  console.log('1️⃣ Testing SDK import...');
  
  try {
    // Try importing the SDK like our Edge Function does
    const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
    console.log('   Module imported:', Object.keys(mod));
    
    const ZepClient = (mod as any)?.ZepClient || (mod as any)?.default;
    
    if (!ZepClient) {
      console.error('   ❌ ZepClient not found in module');
      return;
    }
    
    console.log('   ✅ ZepClient found');
    
    console.log('\n2️⃣ Testing client initialization...');
    
    const client = new ZepClient({ 
      apiKey: GETZEP_API_KEY,
      projectId: PROJECT_ID
    });
    
    console.log('   ✅ Client initialized');
    console.log('   Client methods:', Object.getOwnPropertyNames(client));
    
    if (client.graph) {
      console.log('   Graph methods:', Object.getOwnPropertyNames(client.graph));
    }
    
    if (client.memory) {
      console.log('   Memory methods:', Object.getOwnPropertyNames(client.memory));
    }
    
    console.log('\n3️⃣ Testing graph.add method...');
    
    if (client?.graph?.add) {
      try {
        const episode = await client.graph.add({
          userId: USER_ID,
          type: 'text',
          data: 'Test message from SDK test script at ' + new Date().toISOString()
        });
        
        console.log('   ✅ Graph add successful!');
        console.log('   Episode:', episode);
      } catch (addError: any) {
        console.error('   ❌ Graph add failed:', addError.message);
        if (addError.statusCode) {
          console.log('      Status:', addError.statusCode);
          console.log('      Body:', addError.body);
        }
      }
    } else {
      console.error('   ❌ client.graph.add method not found');
    }
    
    console.log('\n4️⃣ Testing memory search...');
    
    if (client?.memory?.searchMemory) {
      try {
        const results = await client.memory.searchMemory(
          USER_ID,
          { text: 'test message', limit: 5, searchType: 'similarity' }
        );
        
        console.log('   ✅ Memory search successful!');
        console.log('   Results:', results);
      } catch (searchError: any) {
        console.error('   ❌ Memory search failed:', searchError.message);
        if (searchError.statusCode) {
          console.log('      Status:', searchError.statusCode);
          console.log('      Body:', searchError.body);
        }
      }
    } else {
      console.error('   ❌ client.memory.searchMemory method not found');
    }
    
  } catch (importError) {
    console.error('   ❌ SDK import failed:', importError);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SDK TEST SUMMARY');
  console.log('');
  console.log('This test verifies that:');
  console.log('1. The GetZep SDK can be imported via ESM');
  console.log('2. The client can be initialized with API key');
  console.log('3. The graph.add and memory.searchMemory methods work');
  console.log('');
  console.log('If successful, the Edge Function should work correctly.');
}

testGetZepSDK().catch(console.error);
