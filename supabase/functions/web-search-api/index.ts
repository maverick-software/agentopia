/**
 * Web Search API Edge Function
 * Handles web search operations for agents including:
 * - Web search via multiple providers (Serper, SerpAPI, Brave Search)
 * - Web page scraping and summarization
 * - News search
 * - Content processing and summarization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

interface WebSearchRequest {
  agent_id: string;
  action: 'web_search' | 'news_search' | 'scrape_and_summarize';
  parameters: Record<string, any>;
}

interface WebSearchResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    provider: string;
    execution_time_ms: number;
    quota_consumed: number;
    tokens_used?: number;
  };
}

interface SearchProvider {
  name: string;
  execute: (query: string, params: any, apiKey: string) => Promise<any>;
  scrape?: (urls: string[], params: any, apiKey: string) => Promise<any>;
}

// Web scraping utility function
async function scrapeWebPage(url: string): Promise<{ title: string; content: string; error?: string }> {
  try {
    console.log(`[web-search-api] Scraping URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Basic HTML parsing to extract text content
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No title found';
    
    // Remove script, style, and other non-content tags
    let content = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
      .replace(/<header[^>]*>.*?<\/header>/gis, '')
      .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
      .replace(/<aside[^>]*>.*?<\/aside>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit content length
    if (content.length > 10000) {
      content = content.substring(0, 10000) + '...';
    }

    return { title, content };
  } catch (error) {
    console.error(`[web-search-api] Error scraping ${url}:`, error);
    return { 
      title: 'Error', 
      content: '', 
      error: error.message 
    };
  }
}

// Summarization utility using OpenAI
async function summarizeContent(content: string, focusKeywords: string[] = [], length: 'short' | 'medium' | 'long' = 'medium'): Promise<{ summary: string; tokens_used: number }> {
  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const lengthInstructions = {
      short: 'in 2-3 sentences',
      medium: 'in 1-2 paragraphs',
      long: 'in 3-4 paragraphs with detailed analysis'
    };

    const focusInstruction = focusKeywords.length > 0 
      ? `Focus particularly on these keywords: ${focusKeywords.join(', ')}.` 
      : '';

    const prompt = `Summarize the following content ${lengthInstructions[length]}. ${focusInstruction} Provide a clear, informative summary that captures the main points and key information:

${content}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: length === 'short' ? 150 : length === 'medium' ? 300 : 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      summary: result.choices[0].message.content.trim(),
      tokens_used: result.usage.total_tokens,
    };
  } catch (error) {
    console.error('[web-search-api] Summarization error:', error);
    return {
      summary: `Error generating summary: ${error.message}`,
      tokens_used: 0,
    };
  }
}

// Search providers
const searchProviders: Record<string, SearchProvider> = {
  serper: {
    name: 'Serper',
    execute: async (query: string, params: any, apiKey: string) => {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: params.num_results || 5,
          gl: params.location || 'us',
          hl: 'en',
          ...(params.time_range && params.time_range !== 'all' && {
            tbs: `qdr:${params.time_range === 'day' ? 'd' : params.time_range === 'week' ? 'w' : params.time_range === 'month' ? 'm' : 'y'}`
          }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      return await response.json();
    },
  },

  serpapi: {
    name: 'SerpAPI',
    execute: async (query: string, params: any, apiKey: string) => {
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('api_key', apiKey);
      url.searchParams.append('engine', 'google');
      url.searchParams.append('q', query);
      url.searchParams.append('num', (params.num_results || 5).toString());
      
      if (params.location) {
        url.searchParams.append('location', params.location);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
      }

      return await response.json();
    },
  },

  brave_search: {
    name: 'Brave Search',
    execute: async (query: string, params: any, apiKey: string) => {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.append('q', query);
      url.searchParams.append('count', (params.num_results || 5).toString());
      
      if (params.location) {
        url.searchParams.append('search_lang', 'en');
        url.searchParams.append('country', 'US'); // Could be enhanced to parse location
      }

      const response = await fetch(url.toString(), {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status}`);
      }

      return await response.json();
    },
  },
};

// Main request handler
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const body: WebSearchRequest = await req.json();
    const { agent_id, action, parameters } = body;

    console.log(`[web-search-api] Processing ${action} request for agent ${agent_id}`);

    // Validate permissions
    const { data: hasPermissions } = await supabase
      .rpc('validate_web_search_permissions', {
        p_agent_id: agent_id,
        p_user_id: user.id,
      });

    if (!hasPermissions) {
      throw new Error('Agent does not have web search permissions');
    }

    // Get available API keys
    const { data: connections } = await supabase
      .from('user_oauth_connections')
      .select(`
        *,
        oauth_providers!inner(name, configuration)
      `)
      .eq('user_id', user.id)
      .in('oauth_providers.name', ['serper', 'serpapi', 'brave_search'])
      .eq('is_active', true);

    if (!connections || connections.length === 0) {
      throw new Error('No web search API keys configured');
    }

    const startTime = Date.now();
    let result: WebSearchResult;

    // Try providers in order of preference
    const preferredProviders = ['serper', 'brave_search', 'serpapi'];
    let lastError: Error | null = null;

    for (const providerName of preferredProviders) {
      const connection = connections.find(c => c.oauth_providers.name === providerName);
      if (!connection) continue;

      const provider = searchProviders[providerName];
      if (!provider) continue;

      try {
        console.log(`[web-search-api] Trying provider: ${providerName}`);

        // Decrypt API key from Supabase Vault
        const { data: decryptedKey } = await supabase
          .rpc('vault_decrypt', { encrypted_data: connection.encrypted_access_token });

        if (!decryptedKey) {
          throw new Error('Failed to decrypt API key');
        }

        let data: any;
        let tokensUsed = 0;

        if (action === 'web_search' || action === 'news_search') {
          data = await provider.execute(parameters.query, parameters, decryptedKey);
          
          // Normalize response format across providers
          data = normalizeSearchResults(data, providerName);
          
        } else if (action === 'scrape_and_summarize') {
          const urls = parameters.urls || [];
          const summaryLength = parameters.summary_length || 'medium';
          const focusKeywords = parameters.focus_keywords || [];

          const scrapeResults = await Promise.all(
            urls.map(async (url: string) => {
              const scraped = await scrapeWebPage(url);
              if (scraped.content && !scraped.error) {
                const summarized = await summarizeContent(scraped.content, focusKeywords, summaryLength);
                tokensUsed += summarized.tokens_used;
                return {
                  url,
                  title: scraped.title,
                  summary: summarized.summary,
                  success: true,
                };
              } else {
                return {
                  url,
                  title: scraped.title,
                  summary: '',
                  error: scraped.error,
                  success: false,
                };
              }
            })
          );

          data = { scrape_results: scrapeResults };
        }

        const executionTime = Date.now() - startTime;

        result = {
          success: true,
          data,
          metadata: {
            provider: providerName,
            execution_time_ms: executionTime,
            quota_consumed: 1,
            tokens_used: tokensUsed,
          },
        };

        // Log successful operation
        await supabase.from('web_search_operation_logs').insert({
          agent_id,
          user_id: user.id,
          provider_name: providerName,
          operation_type: action,
          search_query: parameters.query || JSON.stringify(parameters),
          search_parameters: parameters,
          results_data: data,
          success: true,
          execution_time_ms: executionTime,
          tokens_used: tokensUsed,
          quota_consumed: 1,
        });

        break; // Success, exit the provider loop

      } catch (error) {
        console.error(`[web-search-api] Provider ${providerName} failed:`, error);
        lastError = error;
        continue; // Try next provider
      }
    }

    // If all providers failed, return error
    if (!result!) {
      throw lastError || new Error('All search providers failed');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[web-search-api] Error:', error);

    const errorResult: WebSearchResult = {
      success: false,
      error: error.message,
      metadata: {
        provider: 'none',
        execution_time_ms: 0,
        quota_consumed: 0,
      },
    };

    return new Response(JSON.stringify(errorResult), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Utility function to normalize search results across providers
function normalizeSearchResults(data: any, provider: string): any {
  switch (provider) {
    case 'serper':
      return {
        results: data.organic?.map((result: any) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          position: result.position,
        })) || [],
        total_results: data.searchInformation?.totalResults || 0,
        search_time: data.searchInformation?.searchTime || 0,
      };

    case 'serpapi':
      return {
        results: data.organic_results?.map((result: any, index: number) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          position: index + 1,
        })) || [],
        total_results: data.search_information?.total_results || 0,
        search_time: data.search_information?.time_taken_displayed || 0,
      };

    case 'brave_search':
      return {
        results: data.web?.results?.map((result: any, index: number) => ({
          title: result.title,
          url: result.url,
          snippet: result.description,
          position: index + 1,
        })) || [],
        total_results: data.web?.total_count || 0,
        search_time: 0,
      };

    default:
      return data;
  }
} 