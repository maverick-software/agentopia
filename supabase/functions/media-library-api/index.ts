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
  action: 'upload' | 'process' | 'search' | 'get_content' | 'list_documents' | 'assign_to_agent' | 'get_categories' | 'get_signed_url';
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

  // For signed URL generation
  storage_path?: string;
  expiry_seconds?: number;
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
// Text Processing Utilities
// =============================================

/**
 * Extract text content from various document types
 */
async function extractTextFromDocument(supabase: any, storagePath: string, fileType: string): Promise<string> {
  try {
    console.log(`[MediaLibrary] Extracting text from ${fileType}: ${storagePath}`);
    
    // Download the file from Supabase Storage using the client (handles auth)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('media-library')
      .download(storagePath);
    
    if (downloadError) {
      throw new Error(`Failed to download file from storage: ${downloadError.message}`);
    }
    
    if (!fileData) {
      throw new Error('No file data received from storage');
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Handle different file types
    if (fileType === 'application/pdf' || storagePath.toLowerCase().endsWith('.pdf')) {
      return await extractTextFromPDF(uint8Array);
    } else if (fileType.startsWith('text/') || storagePath.toLowerCase().endsWith('.txt')) {
      return new TextDecoder('utf-8').decode(uint8Array);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               storagePath.toLowerCase().endsWith('.docx')) {
      // For now, return a placeholder - DOCX extraction requires additional libraries
      return '[DOCX document - text extraction not yet implemented]';
    } else if (fileType.startsWith('image/')) {
      // For now, return a placeholder - OCR would be needed for images
      return '[Image document - OCR extraction not yet implemented]';
    } else {
      console.warn(`[MediaLibrary] Unsupported file type for text extraction: ${fileType}`);
      return '';
    }
  } catch (error: any) {
    console.error(`[MediaLibrary] Text extraction error:`, error);
    throw error;
  }
}

/**
 * Extract text from PDF using a simple PDF parser
 * Note: This is a basic implementation. For production, consider using pdf-parse or similar
 */
async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  try {
    // For now, we'll use a very basic PDF text extraction
    // This is a simplified approach - in production you'd want to use a proper PDF library
    const pdfString = new TextDecoder('latin1').decode(pdfData);
    
    // Simple regex to extract text between BT/ET pairs (text objects in PDF)
    const textRegex = /BT\s*.*?ET/gs;
    const matches = pdfString.match(textRegex) || [];
    
    let extractedText = '';
    for (const match of matches) {
      // Extract text from Tj operations
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(match)) !== null) {
        extractedText += tjMatch[1] + ' ';
      }
      
      // Extract text from TJ operations (array format)
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = tjArrayRegex.exec(match)) !== null) {
        // Parse the array content
        const arrayContent = tjArrayMatch[1];
        const stringRegex = /\((.*?)\)/g;
        let stringMatch;
        while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
          extractedText += stringMatch[1] + ' ';
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\\)/g, ')')
      .replace(/\\\(/g, '(')
      .trim();
    
    if (extractedText.length < 10) {
      // If we didn't extract much text, it might be a complex PDF
      // Return a placeholder indicating the file type
      return `[PDF document: ${pdfData.length} bytes - complex PDF format, text extraction may be incomplete]`;
    }
    
    return extractedText;
  } catch (error: any) {
    console.error(`[MediaLibrary] PDF text extraction error:`, error);
    return `[PDF document: ${pdfData.length} bytes - text extraction failed: ${error.message}]`;
  }
}

/**
 * Split text into chunks for better search and RAG performance
 */
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // If we're not at the end of the text, try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence endings first
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const sentenceBoundary = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      
      if (sentenceBoundary > start + chunkSize * 0.5) {
        // If we found a sentence boundary in the second half of the chunk, use it
        end = sentenceBoundary + 1;
      } else {
        // Otherwise, look for word boundaries
        const wordBoundary = text.lastIndexOf(' ', end);
        if (wordBoundary > start + chunkSize * 0.5) {
          end = wordBoundary;
        }
      }
    }
    
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move start position with overlap
    start = Math.max(start + 1, end - overlap);
  }
  
  return chunks;
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
    
    console.log(`[MediaLibrary] Starting text extraction for document ${document_id}: ${mediaFile.file_name}`);
    
    // Extract text content from the document
    let textContent = '';
    let chunkCount = 0;
    
    try {
      textContent = await extractTextFromDocument(supabase, mediaFile.storage_path, mediaFile.file_type);
      
      if (textContent && textContent.trim().length > 0) {
        // Create chunks for better search and RAG performance
        const chunks = chunkText(textContent, 1000, 200); // 1000 chars with 200 char overlap
        chunkCount = chunks.length;
        
        console.log(`[MediaLibrary] Extracted ${textContent.length} characters, created ${chunkCount} chunks`);
      } else {
        console.log(`[MediaLibrary] No text content extracted from ${mediaFile.file_name}`);
      }
    } catch (extractError: any) {
      console.error(`[MediaLibrary] Text extraction failed for ${document_id}:`, extractError);
      // Continue with processing but mark that extraction failed
      textContent = '';
      chunkCount = 0;
    }
    
    // Update document with extracted content
    await supabase
      .from('media_library')
      .update({ 
        processing_status: 'completed',
        text_content: textContent || null,
        chunk_count: chunkCount,
        processed_at: new Date().toISOString()
      })
      .eq('id', document_id);
    
    return {
      success: true,
      data: {
        media_id: document_id,
        processing_status: 'completed',
        text_content_length: textContent.length,
        chunk_count: chunkCount,
        message: chunkCount > 0 
          ? `Document processed successfully. Extracted ${textContent.length} characters into ${chunkCount} chunks.`
          : 'Document uploaded successfully. No text content could be extracted from this file type.'
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

async function handleGetSignedUrl(
  supabase: any,
  userId: string,
  request: MediaUploadRequest
): Promise<MediaLibraryResponse> {
  try {
    const { document_id, storage_path, expiry_seconds = 3600 } = request;
    
    if (!document_id && !storage_path) {
      throw new Error('Either document_id or storage_path is required');
    }

    let finalStoragePath = storage_path;
    
    // If document_id provided, get storage path from database
    if (document_id) {
      const { data: mediaFile, error: fetchError } = await supabase
        .from('media_library')
        .select('storage_path')
        .eq('id', document_id)
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !mediaFile) {
        throw new Error('Media file not found or access denied');
      }
      
      finalStoragePath = mediaFile.storage_path;
    }

    // Generate signed URL using service role (bypasses RLS)
    // Create a service role client specifically for storage operations
    const serviceRoleClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const { data: signedUrlData, error: signedUrlError } = await serviceRoleClient.storage
      .from('media-library')
      .createSignedUrl(finalStoragePath, expiry_seconds);
    
    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError);
      throw signedUrlError;
    }
    
    return {
      success: true,
      data: {
        signed_url: signedUrlData.signedUrl,
        expires_in: expiry_seconds,
        storage_path: finalStoragePath
      },
      metadata: {
        action_performed: 'signed_url_generated'
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary] Get signed URL error:', error);
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
    return new Response('ok', { headers: corsHeaders });
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
        
      case 'get_signed_url':
        result = await handleGetSignedUrl(supabase, user.id, body);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
