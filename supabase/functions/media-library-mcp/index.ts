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
      .rpc('search_media_documents_for_agent', {
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
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('Missing required parameter: query')) {
      helpfulError = 'Question: What would you like me to search for in your documents? Please provide a search query or topic.';
    } else if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document search system. Please try again in a moment, or try listing your documents first with "list my assigned documents".';
    }
    
    return {
      success: false,
      error: helpfulError,
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
    let { document_id, include_metadata = true } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Check if document_id is a UUID, if not, try to find by title/filename
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(document_id)) {
      // Special case: if it's just a number, it's probably from the numbered list
      if (/^\d+$/.test(document_id.trim())) {
        throw new Error(`Document ID "${document_id}" appears to be a list number. Please use the actual document UUID from the "id" field in list_assigned_documents, not the list number. For example, use "f048957a-f417-48eb-bb5a-d5a5043e23df" instead of "2".`);
      }
      
      console.log(`[MediaLibrary MCP] document_id "${document_id}" is not a UUID, attempting to find by title/filename`);
      
      // Try to find the document by title or filename
      // First try exact matches, then partial matches
      let { data: documents, error: searchError } = await supabase
        .from('media_library')
        .select('id, file_name, display_name')
        .eq('user_id', userId)
        .eq('is_archived', false);
      
      if (searchError) throw searchError;
      
      console.log(`[MediaLibrary MCP] Found ${documents?.length || 0} total documents for user ${userId}`);
      
      // Filter documents manually for better matching
      const matchingDocs = documents?.filter(doc => {
        const searchTerm = document_id.toLowerCase().trim();
        const fileName = (doc.file_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const displayName = (doc.display_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        
        // For short search terms (like numbers), require more specific matching
        if (searchTerm.length <= 2) {
          // Only match if it's a word boundary or exact filename match
          const wordBoundaryRegex = new RegExp(`\\b${searchTerm}\\b`, 'i');
          const matches = wordBoundaryRegex.test(fileName) || wordBoundaryRegex.test(displayName);
          
          if (matches) {
            console.log(`[MediaLibrary MCP] Found matching document (word boundary): "${doc.file_name}" (display: "${doc.display_name}")`);
          }
          return matches;
        } else {
          // For longer terms, use substring matching
          const matches = fileName.includes(searchTerm) || 
                         displayName.includes(searchTerm) ||
                         fileName.replace(/\.pdf$/i, '').includes(searchTerm) ||
                         displayName.replace(/\.pdf$/i, '').includes(searchTerm);
          
          if (matches) {
            console.log(`[MediaLibrary MCP] Found matching document: "${doc.file_name}" (display: "${doc.display_name}")`);
          }
          
          return matches;
        }
      }) || [];
      
      documents = matchingDocs;
      
      if (!documents || documents.length === 0) {
        // Get all documents for debugging
        const { data: allDocs } = await supabase
          .from('media_library')
          .select('file_name, display_name')
          .eq('user_id', userId)
          .eq('is_archived', false);
        
        console.log(`[MediaLibrary MCP] No documents found matching "${document_id}". Available documents:`, 
          allDocs?.map(d => `"${d.file_name}" (display: "${d.display_name}")`) || []);
        throw new Error(`Document not found with title/filename containing "${document_id}". Please use the document UUID from list_assigned_documents instead.`);
      }
      
      if (documents.length > 1) {
        const matchedDocs = documents.map(d => `"${d.file_name}"`).join(', ');
        throw new Error(`Multiple documents found matching "${document_id}": ${matchedDocs}. Please use the specific document UUID from the "id" field in list_assigned_documents for precise identification.`);
      }
      
      // Check if this document is actually assigned to the agent
      const { data: assignment, error: assignmentError } = await supabase
        .from('agent_media_assignments')
        .select('media_id')
        .eq('agent_id', agentId)
        .eq('media_id', documents[0].id)
        .eq('is_active', true)
        .single();
      
      if (assignmentError || !assignment) {
        throw new Error(`Document "${document_id}" is not assigned to this agent. Please check your assigned documents.`);
      }
      
      // Use the found UUID
      document_id = documents[0].id;
      console.log(`[MediaLibrary MCP] Resolved "${params.document_id}" to UUID: ${document_id}`);
    }
    
    // Use the database function to get content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_media_document_content_for_agent', {
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
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('invalid input syntax for type uuid')) {
      helpfulError = 'I need the document ID (UUID) to retrieve the content, not the document name. Please use the "id" field from the document list. For example, if you want to read "Every Citizen Armed Media Kit.pdf", use its ID like "f048957a-f417-48eb-bb5a-d5a5043e23df" instead of the filename.';
    } else if (error.message.includes('Missing required parameter: document_id')) {
      helpfulError = 'Question: Which document would you like me to retrieve? Please specify the document name or ID. You can first use "list my assigned documents" to see available documents.';
    } else if (error.message.includes('Document not found or not assigned')) {
      helpfulError = 'I cannot find that document in your assigned documents. Please check the document name or use "list my assigned documents" to see what documents are available to you.';
    } else if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document retrieval system. Please try again in a moment, or try listing your documents first.';
    }
    
    return {
      success: false,
      error: helpfulError,
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
      include_inactive = false,
      limit = 100,
      offset = 0
    } = params;
    
    // Use the database function to list documents
    const { data: documentsData, error: listError } = await supabase
      .rpc('list_agent_assigned_documents', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_category: category,
        p_assignment_type: assignment_type,
        p_include_inactive: include_inactive,
        p_limit: limit,
        p_offset: offset
      });
    
    if (listError) throw listError;
    
    // The database function returns an array of documents directly, not an object
    const documents = documentsData || [];
    const totalCount = documents.length;
    
    // Format documents for MCP response
    const formattedDocuments = documents.map((doc: any) => ({
      id: doc.document_id,
      title: doc.display_name || doc.file_name,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size: doc.file_size,
      category: doc.category,
      assignment_type: doc.assignment_type,
      processing_status: doc.processing_status,
      tags: doc.tags,
      description: doc.description,
      chunk_count: doc.chunk_count,
      assigned_at: doc.assigned_at,
      last_accessed_at: doc.last_accessed_at,
      access_count: doc.access_count,
      is_active: doc.is_active
    }));
    
    return {
      success: true,
      data: {
        total_count: totalCount,
        documents: formattedDocuments,
        summary: `Agent has ${totalCount} assigned document(s)${category ? ` in category "${category}"` : ''}${assignment_type ? ` of type "${assignment_type}"` : ''}. To read a document's content, use the 'id' field (UUID) from the document list, not the title or filename.`
      },
      metadata: {
        tool_name: 'list_assigned_documents',
        execution_time_ms: Date.now() - startTime,
        results_count: totalCount
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] List assigned documents error:', error);
    
    // Provide helpful MCP error messages for the LLM to retry
    let helpfulError = error.message;
    if (error.message.includes('Could not find the function')) {
      helpfulError = 'I apologize, but there seems to be an issue with the document listing system. This might be a temporary issue - please try again in a moment.';
    } else if (error.message.includes('parameters')) {
      helpfulError = 'I encountered an issue with the document listing. Please try asking "show me my documents" or "what documents do I have access to?"';
    }
    
    return {
      success: false,
      error: helpfulError,
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
      .rpc('get_media_document_content_for_agent', {
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
        .rpc('get_media_document_content_for_agent', {
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
      .rpc('search_media_documents_for_agent', {
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