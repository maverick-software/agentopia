import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    source?: string;
    timestamp?: string;
  };
}

// Rate limiter: 30 requests per minute
const limiter = new RateLimiter({
  tokensPerInterval: 30,
  interval: 'minute',
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: { persistSession: false },
  }
);

async function getVectorSearchResults(message: string, agentId: string): Promise<string | null> {
  try {
    const { data: connection, error: connectionError } = await supabaseClient
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          type,
          config,
          similarity_metric,
          similarity_threshold,
          max_results
        )
      `)
      .eq('agent_id', agentId)
      .eq('datastores.type', 'pinecone')
      .single();

    if (connectionError) {
      console.error('Vector store connection error:', {
        error: connectionError,
        message: connectionError.message,
        details: connectionError.details
      });
      return null;
    }

    if (!connection?.datastores) {
      return null;
    }

    const datastore = connection.datastores;

    // Validate necessary config fields exist
    if (!datastore.config?.apiKey || !datastore.config?.region || !datastore.config?.indexName) {
        console.error('Incomplete Pinecone configuration found in datastore:', datastore.id);
        return null;
    }

    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      encoding_format: 'float',
    });

    // Instantiate Pinecone client with ONLY required fields
    const pinecone = new Pinecone({
      apiKey: datastore.config.apiKey, 
      environment: datastore.config.region 
    });

    // Get index name separately
    const indexName = datastore.config.indexName;
    const index = pinecone.Index(indexName);

    // Query vector store
    const results = await index.query({
      vector: embedding.data[0].embedding,
      topK: datastore.max_results,
      includeMetadata: true,
      includeValues: false,
    });

    if (!results.matches?.length) {
      return null;
    }

    // Filter and format results
    const relevantResults = results.matches
      .filter(match => match.score >= datastore.similarity_threshold)
      .map((match) => {
        const metadata = match.metadata as VectorSearchResult['metadata'];
        return {
          text: metadata.text,
          score: match.score,
          source: metadata.source,
          timestamp: metadata.timestamp,
        };
      });

    if (!relevantResults.length) {
      return null;
    }

    // Format context message
    const memories = relevantResults
      .map(result => {
        let memory = `Memory (similarity: ${(result.score * 100).toFixed(1)}%):\n${result.text}`;
        if (result.source) {
          memory += `\nSource: ${result.source}`;
        }
        if (result.timestamp) {
          memory += `\nTimestamp: ${result.timestamp}`;
        }
        return memory;
      })
      .join('\n\n');

    return `Here are some relevant memories that might help with your response:\n\n${memories}\n\nPlease consider these memories when formulating your response, but maintain a natural conversation flow.`;
  } catch (error) {
    console.error('Vector search error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle Health Check GET request
    if (req.method === 'GET') {
      // Basic health check - can add more checks later if needed (e.g., OpenAI connectivity)
      const url = new URL(req.url);
      if (url.pathname.endsWith('/health')) { // Check if it's the health endpoint
        return new Response(JSON.stringify({ status: 'healthy' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      // If GET but not health, return 404 or 405
      return new Response(JSON.stringify({ error: 'Not Found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
      });
    }

    // Handle Chat POST request
    if (req.method === 'POST') {
      try {
        console.log('Chat POST request received');
        // Validate OpenAI API key
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiKey) {
          throw new Error('OpenAI API key not configured');
        }

        // Check rate limit
        const remainingRequests = await limiter.removeTokens(1);
        if (remainingRequests < 0) {
          return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later.' }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': '60',
              },
            }
          );
        }

        const { messages, agentId } = await req.json();

        if (!messages?.length || !agentId) {
          throw new Error('Missing required parameters');
        }

        // Get agent data
        const { data: agent, error: agentError } = await supabaseClient
          .from('agents')
          .select('id, name, personality, system_instructions, assistant_instructions')
          .eq('id', agentId)
          .single();

        if (agentError) {
          console.error('Error fetching agent:', {
            error: agentError,
            message: agentError.message,
            details: agentError.details
          });
          throw new Error('Failed to fetch agent data');
        }

        if (!agent) {
          throw new Error('Agent not found');
        }
        console.log(`Found agent: ${agent.id}`);

        // Get relevant context
        const latestUserMessage = messages[messages.length - 1];
        const memories = latestUserMessage.role === 'user'
          ? await getVectorSearchResults(latestUserMessage.content, agentId)
          : null;
        console.log(`Memories fetched: ${memories ? 'Yes' : 'No'}`);

        // Prepare messages
        const systemMessage: ChatMessage = {
          role: 'system',
          content: `${agent.system_instructions || ''}\n\nYou are ${agent.name}, an AI agent with the following personality: ${agent.personality}\n\n${agent.assistant_instructions || ''}`
        };

        const chatMessages = [systemMessage, ...messages];
        if (memories) {
          chatMessages.push({
            role: 'system',
            content: memories
          });
        }
        console.log(`Prepared ${chatMessages.length} messages for OpenAI.`);
        // Optional: Log the full prompt if not too large/sensitive
        // console.log('Sending messages:', JSON.stringify(chatMessages)); 

        // Create chat completion stream
        console.log('Calling OpenAI chat.completions.create...');
        const stream = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: chatMessages,
          temperature: 0.7,
          max_tokens: 500,
          stream: true,
          presence_penalty: 0.6,
          frequency_penalty: 0.5
        });
        console.log('Received stream from OpenAI');

        // Create a ReadableStream to pipe the OpenAI stream chunks
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
          async start(controller) {
            console.log("ReadableStream started, iterating OpenAI stream...");
            try {
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                // console.log('Received chunk content:', content); // Optional: log chunk content
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
                // Check if the stream is finished (OpenAI includes this in newer versions sometimes)
                if (chunk.choices[0]?.finish_reason) {
                    console.log('OpenAI stream finished with reason:', chunk.choices[0].finish_reason);
                    break; // Exit loop once finished
                }
              }
              console.log("OpenAI stream iteration finished.");
            } catch (error) {
              console.error('Error during OpenAI stream iteration:', error);
              controller.error(error); // Signal error to the stream consumer
            } finally {
              try {
                controller.close(); // Ensure the stream is closed
                console.log("ReadableStream closed.");
              } catch (closeError) {
                console.error('Error closing stream controller:', closeError); 
              }
            }
          },
          cancel(reason) {
            console.log('ReadableStream cancelled:', reason);
            // If the stream is cancelled (e.g., client disconnects), 
            // you might want to signal cancellation to the OpenAI request if possible,
            // though the SDK might not support this directly for ongoing streams.
          }
        });

        // Return the stream as the response with appropriate headers
        console.log("Returning response with custom ReadableStream.");
        return new Response(readableStream, { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          } 
        });

      } catch (error) {
        // Log the detailed error within the main catch block
        console.error('Chat processing error:', { 
          error,
          message: error.message,
          name: error.name,
          stack: error.stack 
        });
        return new Response(
          JSON.stringify({ 
            error: error.message || 'An error occurred',
            timestamp: new Date().toISOString()
          }), 
          {
            status: error.status || 500,
            headers: {
              ...corsHeaders, // Ensure CORS headers are on error responses
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Handle other methods
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405, // Method Not Allowed
    });

  } catch (error) {
    console.error('Chat error:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred',
        timestamp: new Date().toISOString()
      }), 
      {
        status: error.status || 500,
        headers: {
          ...corsHeaders, // Ensure CORS headers are on error responses
          'Content-Type': 'application/json',
        },
      }
    );
  }
});