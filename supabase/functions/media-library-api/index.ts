/**
 * Media Library API Edge Function
 * 
 * Handles document upload, processing, management, and MCP tool operations
 * for the centralized Media Library system
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MediaUploadRequest {
  action: 'upload' | 'process' | 'search' | 'get_content' | 'list_documents' | 'assign_to_agent' | 'get_categories';
  file_name?: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  description?: string;
  tags?: string[];
  
  // For MCP tool operations
  agent_id?: string;
  document_id?: string;
  query?: string;
  search_type?: 'semantic' | 'keyword' | 'exact';
  assignment_type?: 'training_data' | 'reference' | 'sop' | 'knowledge_base';
  include_metadata?: boolean;
  limit?: number;
  
  // For assignment operations
  include_in_vector_search?: boolean;
  include_in_knowledge_graph?: boolean;
  priority_level?: number;
}

interface MediaLibraryResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    total_count?: number;
    processing_time_ms?: number;
    action_performed?: string;
  };
}

// =============================================
// Handler Functions
// =============================================

async function handleUpload(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { file_name, file_type, file_size, category = 'general', description, tags = [] } = request;
    
    if (!file_name || !file_type || !file_size) {
      throw new Error('Missing required fields: file_name, file_type, file_size');
    }
    
    // Generate storage path: user_id/category/timestamp_filename
    const timestamp = Date.now();
    // Better filename sanitization: preserve extension, handle spaces properly
    const fileExtension = file_name.split('.').pop() || '';
    const baseName = file_name.replace(/\.[^/.]+$/, ''); // Remove extension
    const sanitizedBaseName = baseName
      .replace(/\s+/g, '_')           // Replace multiple spaces with single underscore
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_')            // Replace multiple underscores with single
      .replace(/^_|_$/g, '');         // Remove leading/trailing underscores
    const sanitizedFileName = fileExtension ? `${sanitizedBaseName}.${fileExtension}` : sanitizedBaseName;
    const storagePath = `${userId}/${category}/${timestamp}_${sanitizedFileName}`;
    
    // Create media library entry
    const { data: mediaEntry, error: insertError } = await supabase
      .from('media_library')
      .insert({
        user_id: userId,
        file_name,
        file_type,
        file_size,
        file_extension: file_name.split('.').pop()?.toLowerCase() || 'unknown',
        storage_bucket: 'media-library',
        storage_path: storagePath,
        category,
        description,
        tags,
        processing_status: 'uploaded'
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Return storage path for client to upload directly
    // Client will use supabase.storage.from('media-library').upload()
    return {
      success: true,
      data: {
        media_id: mediaEntry.id,
        storage_path: storagePath,
        bucket: 'media-library'
      },
      metadata: {
        action_performed: 'upload_prepared'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Upload error:', {
      error: error.message,
      stack: error.stack,
      fileName: request.file_name,
      fileSize: request.file_size,
      fileType: request.file_type
    });
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
}

async function handleProcess(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { document_id } = request;
    
    if (!document_id) {
      throw new Error('Missing required field: document_id');
    }
    
    // Get media file details
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !mediaFile) {
      throw new Error('Media file not found or access denied');
    }
    
    // Update status to processing
    await supabase
      .from('media_library')
      .update({ processing_status: 'processing' })
      .eq('id', document_id);
    
    // Get file URL for processing
    const { data: urlData } = supabase.storage
      .from('media-library')
      .getPublicUrl(mediaFile.storage_path);
    
    // Call existing document processing function
    const { data: processResult, error: processError } = await supabase.functions.invoke(
      'process-datastore-document',
      {
        body: {
          document_id: document_id,
          agent_id: null, // No specific agent for media library processing
          file_url: urlData.publicUrl,
          file_name: mediaFile.file_name,
          file_type: mediaFile.file_type
        }
      }
    );
    
    if (processError) {
      // Update status to failed
      await supabase
        .from('media_library')
        .update({ 
          processing_status: 'failed',
          processing_error: processError.message
        })
        .eq('id', document_id);
      
      throw processError;
    }
    
    // Update status to completed
    const { error: updateError } = await supabase
      .from('media_library')
      .update({
        processing_status: 'completed',
        text_content: processResult.text_content,
        chunk_count: processResult.chunks_processed,
        processed_at: new Date().toISOString(),
        file_url: urlData.publicUrl
      })
      .eq('id', document_id);
    
    if (updateError) throw updateError;
    
    return {
      success: true,
      data: {
        media_id: document_id,
        processing_result: processResult
      },
      metadata: {
        action_performed: 'document_processed'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Process error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleSearchDocuments(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      query, 
      search_type = 'semantic', 
      category, 
      assignment_type, 
      limit = 10 
    } = request;
    
    if (!agent_id || !query) {
      throw new Error('Missing required fields: agent_id, query');
    }
    
    // Use the database function for search
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_agent_documents', {
        p_agent_id: agent_id,
        p_user_id: userId,
        p_query: query,
        p_search_type: search_type,
        p_category: category,
        p_assignment_type: assignment_type,
        p_limit: limit
      });
    
    if (searchError) throw searchError;
    
    return {
      success: true,
      data: {
        results: searchResults || [],
        query_info: {
          query,
          search_type,
          category,
          assignment_type,
          limit
        }
      },
      metadata: {
        total_count: searchResults?.length || 0,
        action_performed: 'document_search'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetDocumentContent(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { agent_id, document_id, include_metadata = true } = request;
    
    if (!agent_id || !document_id) {
      throw new Error('Missing required fields: agent_id, document_id');
    }
    
    // Use the database function to get content
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_agent_document_content', {
        p_agent_id: agent_id,
        p_user_id: userId,
        p_document_id: document_id,
        p_include_metadata: include_metadata
      });
    
    if (contentError) throw contentError;
    
    return {
      success: true,
      data: documentContent,
      metadata: {
        action_performed: 'document_content_retrieved'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get content error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleListDocuments(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      category, 
      assignment_type, 
      include_archived = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = request;
    
    if (agent_id) {
      // List documents assigned to specific agent
      const { data: agentDocuments, error: agentError } = await supabase
        .rpc('list_agent_assigned_documents', {
          p_agent_id: agent_id,
          p_user_id: userId,
          p_category: category,
          p_assignment_type: assignment_type,
          p_include_archived: include_archived,
          p_sort_by: sort_by || 'created_at',
          p_sort_order: sort_order || 'desc'
        });
      
      if (agentError) throw agentError;
      
      return {
        success: true,
        data: agentDocuments,
        metadata: {
          action_performed: 'agent_documents_listed'
        }
      };
    } else {
      // List all user's media library files
      let query = supabase
        .from('media_library')
        .select(`
          id,
          file_name,
          display_name,
          file_type,
          file_size,
          category,
          tags,
          description,
          processing_status,
          assigned_agents_count,
          created_at,
          updated_at,
          file_url,
          chunk_count
        `)
        .eq('user_id', userId);
      
      // Apply filters
      if (!include_archived) {
        query = query.eq('is_archived', false);
      }
      if (category) {
        query = query.eq('category', category);
      }
      
      // Apply sorting
      const sortField = sort_by === 'file_name' ? 'file_name' : 
                       sort_by === 'file_size' ? 'file_size' :
                       sort_by === 'updated_at' ? 'updated_at' : 'created_at';
      
      query = query.order(sortField, { ascending: sort_order === 'asc' });
      
      const { data: userMedia, error: userError } = await query;
      
      if (userError) throw userError;
      
      return {
        success: true,
        data: {
          total_count: userMedia?.length || 0,
          documents: userMedia || []
        },
        metadata: {
          action_performed: 'user_media_listed'
        }
      };
    }
    
  } catch (error: any) {
    console.error('[MediaLibrary] List documents error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleAssignToAgent(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { 
      agent_id, 
      document_id, 
      assignment_type = 'training_data',
      include_in_vector_search = true,
      include_in_knowledge_graph = true,
      priority_level = 1
    } = request;
    
    if (!agent_id || !document_id) {
      throw new Error('Missing required fields: agent_id, document_id');
    }
    
    // Use the database function to assign media to agent
    const { data: assignmentId, error: assignError } = await supabase
      .rpc('assign_media_to_agent', {
        p_agent_id: agent_id,
        p_media_id: document_id,
        p_user_id: userId,
        p_assignment_type: assignment_type,
        p_include_vector: include_in_vector_search,
        p_include_graph: include_in_knowledge_graph
      });
    
    if (assignError) throw assignError;
    
    // If agent has existing datastores, trigger processing
    const { data: agentDatastores, error: datastoreError } = await supabase
      .from('agent_datastores')
      .select(`
        datastore_id,
        datastores:datastore_id (
          id,
          type,
          config
        )
      `)
      .eq('agent_id', agent_id);
    
    if (!datastoreError && agentDatastores?.length > 0) {
      // Trigger document processing for agent's datastores
      const { data: mediaFile } = await supabase
        .from('media_library')
        .select('file_url, file_name, file_type')
        .eq('id', document_id)
        .single();
      
      if (mediaFile?.file_url) {
        // Process document for agent's datastores
        await supabase.functions.invoke('process-datastore-document', {
          body: {
            document_id: document_id,
            agent_id: agent_id,
            file_url: mediaFile.file_url,
            file_name: mediaFile.file_name,
            file_type: mediaFile.file_type
          }
        });
      }
    }
    
    return {
      success: true,
      data: {
        assignment_id: assignmentId,
        agent_id,
        document_id,
        assignment_type,
        processing_triggered: agentDatastores?.length > 0
      },
      metadata: {
        action_performed: 'media_assigned_to_agent'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Assign to agent error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetCategories(
  supabase: any,
  userId: string
): Promise<MediaLibraryResponse> {
  try {
    // Ensure default categories exist
    await supabase.rpc('create_default_media_categories', {
      p_user_id: userId
    });
    
    // Get all categories for user
    const { data: categories, error: categoriesError } = await supabase
      .from('media_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
    
    if (categoriesError) throw categoriesError;
    
    // Get media stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_user_media_stats', {
        p_user_id: userId
      });
    
    if (statsError) console.warn('Stats error:', statsError);
    
    return {
      success: true,
      data: {
        categories: categories || [],
        statistics: stats || {}
      },
      metadata: {
        action_performed: 'categories_retrieved'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get categories error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  try {
    // Parse request body
    const body: MediaUploadRequest = await req.json();
    console.log('[MediaLibrary] Received request:', JSON.stringify(body, null, 2));
    
    const { action } = body;

    // Validate required fields
    if (!action) {
      throw new Error('Missing required field: action');
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user auth
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    let result: MediaLibraryResponse;

    // Route to appropriate handler
    switch (action) {
      case 'upload':
        result = await handleUpload(supabase, user.id, body);
        break;
        
      case 'process':
        result = await handleProcess(supabase, user.id, body);
        break;
        
      case 'search':
        result = await handleSearchDocuments(supabase, user.id, body);
        break;
        
      case 'get_content':
        result = await handleGetDocumentContent(supabase, user.id, body);
        break;
        
      case 'list_documents':
        result = await handleListDocuments(supabase, user.id, body);
        break;
        
      case 'assign_to_agent':
        result = await handleAssignToAgent(supabase, user.id, body);
        break;
        
      case 'get_categories':
        result = await handleGetCategories(supabase, user.id);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[MediaLibrary] API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } 
      }
    );
  }
});
