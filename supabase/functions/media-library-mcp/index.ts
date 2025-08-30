/**
 * Media Library MCP Tools Edge Function
 * 
 * Provides MCP tool functionality for document search, retrieval, and management
 * Integrates with the universal tool executor system
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MCPToolRequest {
  action: string;
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
  tool_name?: string;
}

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool_name?: string;
    execution_time_ms?: number;
    results_count?: number;
  };
}

// =============================================
// MCP Tool Handlers
// =============================================

async function handleSearchDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      query, 
      search_type = 'semantic', 
      category, 
      assignment_type, 
      limit = 10 
    } = params;
    
    if (!query) {
      throw new Error('Missing required parameter: query');
    }
    
    // Use the database function for search
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_agent_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query: query,
        p_search_type: search_type,
        p_category: category,
        p_assignment_type: assignment_type,
        p_limit: limit
      });
    
    if (searchError) throw searchError;
    
    // Format results for MCP tool response
    const formattedResults = (searchResults || []).map((doc: any) => ({
      id: doc.document_id,
      title: doc.display_name || doc.file_name,
      content_preview: doc.content_preview,
      relevance_score: doc.relevance_score,
      category: doc.category,
      assignment_type: doc.assignment_type,
      file_url: doc.file_url,
      assigned_at: doc.assigned_at
    }));
    
    return {
      success: true,
      data: {
        query: query,
        search_type: search_type,
        results: formattedResults,
        summary: `Found ${formattedResults.length} document(s) matching "${query}"`
      },
      metadata: {
        tool_name: 'search_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: formattedResults.length
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Search documents error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'search_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleGetDocumentContent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, include_metadata = true } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Use the database function to get content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: include_metadata
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    return {
      success: true,
      data: {
        document: documentContent,
        summary: `Retrieved content for document: ${documentContent.display_name || documentContent.file_name}`
      },
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document content error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleListAssignedDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      category, 
      assignment_type, 
      include_archived = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = params;
    
    // Use the database function to list documents
    const { data: documentsData, error: listError } = await supabase
      .rpc('list_agent_assigned_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_category: category,
        p_assignment_type: assignment_type,
        p_include_archived: include_archived,
        p_sort_by: sort_by,
        p_sort_order: sort_order
      });
    
    if (listError) throw listError;
    
    const documents = documentsData?.documents || [];
    const totalCount = documentsData?.total_count || 0;
    
    return {
      success: true,
      data: {
        total_count: totalCount,
        documents: documents,
        summary: `Agent has ${totalCount} assigned document(s)${category ? ` in category "${category}"` : ''}${assignment_type ? ` of type "${assignment_type}"` : ''}`
      },
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: totalCount
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] List assigned documents error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleGetDocumentSummary(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, summary_type = 'brief', max_length = 200 } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // First, get the document content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    // Generate summary based on type
    let summary: string;
    const textContent = documentContent.text_content || '';
    
    switch (summary_type) {
      case 'brief':
        summary = textContent.length > max_length 
          ? textContent.substring(0, max_length) + '...'
          : textContent;
        break;
        
      case 'key_points':
        // Extract first few sentences as key points
        const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
        summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
        break;
        
      case 'executive':
        // Executive summary - first paragraph
        const paragraphs = textContent.split('\n\n').filter(p => p.trim().length > 0);
        summary = paragraphs[0] || textContent.substring(0, max_length) + '...';
        break;
        
      case 'detailed':
      default:
        summary = textContent.length > max_length * 2 
          ? textContent.substring(0, max_length * 2) + '...'
          : textContent;
        break;
    }
    
    return {
      success: true,
      data: {
        document_id: document_id,
        document_name: documentContent.display_name || documentContent.file_name,
        summary_type: summary_type,
        summary: summary,
        original_length: textContent.length,
        summary_length: summary.length,
        document_metadata: {
          category: documentContent.category,
          file_type: documentContent.file_type,
          created_at: documentContent.created_at,
          assignment_type: documentContent.assignment_info?.assignment_type
        }
      },
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document summary error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleFindRelatedDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      reference_document_id, 
      topic, 
      similarity_threshold = 0.7, 
      limit = 5 
    } = params;
    
    if (!reference_document_id && !topic) {
      throw new Error('Either reference_document_id or topic must be provided');
    }
    
    let searchQuery: string;
    
    if (reference_document_id) {
      // Get reference document content to find similar documents
      const { data: refDoc, error: refError } = await supabase
        .rpc('get_agent_document_content', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_document_id: reference_document_id,
          p_include_metadata: false
        });
      
      if (refError || !refDoc) {
        throw new Error('Reference document not found or access denied');
      }
      
      // Extract key terms from the document for similarity search
      searchQuery = refDoc.text_content?.substring(0, 500) || refDoc.file_name;
    } else {
      searchQuery = topic;
    }
    
    // Search for related documents
    const { data: relatedResults, error: searchError } = await supabase
      .rpc('search_agent_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query: searchQuery,
        p_search_type: 'semantic',
        p_category: null,
        p_assignment_type: null,
        p_limit: limit + 1 // Get one extra to exclude reference doc if needed
      });
    
    if (searchError) throw searchError;
    
    // Filter out the reference document if it was provided
    const filteredResults = reference_document_id 
      ? (relatedResults || []).filter((doc: any) => doc.document_id !== reference_document_id)
      : (relatedResults || []);
    
    // Apply similarity threshold
    const relevantResults = filteredResults
      .filter((doc: any) => doc.relevance_score >= similarity_threshold)
      .slice(0, limit);
    
    return {
      success: true,
      data: {
        reference_document_id: reference_document_id,
        topic: topic,
        similarity_threshold: similarity_threshold,
        related_documents: relevantResults,
        summary: `Found ${relevantResults.length} related document(s)${reference_document_id ? ' to the reference document' : ` about "${topic}"`}`
      },
      metadata: {
        tool_name: 'find_related_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: relevantResults.length
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Find related documents error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'find_related_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: MCPToolRequest = await req.json();
    console.log('[MediaLibrary MCP] Received request:', JSON.stringify(body, null, 2));
    
    const { action, agent_id, user_id, params } = body;

    // Validate required fields
    if (!action || !agent_id || !user_id || !params) {
      throw new Error('Missing required fields: action, agent_id, user_id, params');
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    let result: MCPToolResponse;

    // Route to appropriate MCP tool handler
    switch (action) {
      case 'search_documents':
        result = await handleSearchDocuments(supabase, agent_id, user_id, params);
        break;
        
      case 'get_document_content':
        result = await handleGetDocumentContent(supabase, agent_id, user_id, params);
        break;
        
      case 'list_assigned_documents':
        result = await handleListAssignedDocuments(supabase, agent_id, user_id, params);
        break;
        
      case 'get_document_summary':
        result = await handleGetDocumentSummary(supabase, agent_id, user_id, params);
        break;
        
      case 'find_related_documents':
        result = await handleFindRelatedDocuments(supabase, agent_id, user_id, params);
        break;

      default:
        throw new Error(`Unknown MCP tool action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[MediaLibrary MCP] Tool execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// =============================================
// Helper Functions (shared with media-library-api)
// =============================================

async function handleGetDocumentContent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, include_metadata = true } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Use the database function to get content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: include_metadata
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    return {
      success: true,
      data: {
        document: documentContent,
        summary: `Retrieved full content for: ${documentContent.display_name || documentContent.file_name}`
      },
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document content error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'get_document_content',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleListAssignedDocuments(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      category, 
      assignment_type, 
      include_archived = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = params;
    
    // Use the database function to list documents
    const { data: documentsData, error: listError } = await supabase
      .rpc('list_agent_assigned_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_category: category,
        p_assignment_type: assignment_type,
        p_include_archived: include_archived,
        p_sort_by: sort_by,
        p_sort_order: sort_order
      });
    
    if (listError) throw listError;
    
    const documents = documentsData?.documents || [];
    const totalCount = documentsData?.total_count || 0;
    
    return {
      success: true,
      data: {
        total_count: totalCount,
        documents: documents,
        summary: `Agent has ${totalCount} assigned document(s)${category ? ` in category "${category}"` : ''}${assignment_type ? ` of type "${assignment_type}"` : ''}`
      },
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: totalCount
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] List assigned documents error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleGetDocumentSummary(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, summary_type = 'brief', max_length = 200 } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // First, get the document content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    // Generate summary based on type
    let summary: string;
    const textContent = documentContent.text_content || '';
    
    switch (summary_type) {
      case 'brief':
        summary = textContent.length > max_length 
          ? textContent.substring(0, max_length) + '...'
          : textContent;
        break;
        
      case 'key_points':
        // Extract first few sentences as key points
        const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
        summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
        break;
        
      case 'executive':
        // Executive summary - first paragraph
        const paragraphs = textContent.split('\n\n').filter(p => p.trim().length > 0);
        summary = paragraphs[0] || textContent.substring(0, max_length) + '...';
        break;
        
      case 'detailed':
      default:
        summary = textContent.length > max_length * 2 
          ? textContent.substring(0, max_length * 2) + '...'
          : textContent;
        break;
    }
    
    return {
      success: true,
      data: {
        document_id: document_id,
        document_name: documentContent.display_name || documentContent.file_name,
        summary_type: summary_type,
        summary: summary,
        original_length: textContent.length,
        summary_length: summary.length,
        document_metadata: {
          category: documentContent.category,
          file_type: documentContent.file_type,
          created_at: documentContent.created_at,
          assignment_type: documentContent.assignment_info?.assignment_type
        }
      },
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Get document summary error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'get_document_summary',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}
