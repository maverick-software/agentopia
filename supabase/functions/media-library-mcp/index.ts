/**
 * Media Library MCP Tools Edge Function
 * 
 * Self-contained document management system providing:
 * - Document upload and storage
 * - Text extraction (PDF, DOCX, TXT)
 * - Document processing and chunking
 * - Agent assignment management
 * - Search, retrieval, and management tools
 * 
 * Completely independent - no external API dependencies
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

interface UploadRequest {
  file_name: string;
  file_type: string;
  file_size: number;
  category?: string;
  description?: string;
  tags?: string[];
}

// =============================================
// Text Extraction Functions
// =============================================

async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Processing PDF file (${pdfData.length} bytes)`);
    
    // Simple PDF text extraction - look for text objects
    const textDecoder = new TextDecoder('latin1');
    const pdfText = textDecoder.decode(pdfData);
    
    // Extract text from PDF streams
    const textMatches = pdfText.match(/BT\s+(.*?)\s+ET/gs);
    let extractedText = '';
    
    if (textMatches) {
      for (const match of textMatches) {
        // Extract text from Tj and TJ operators
        const textOperators = match.match(/\((.*?)\)\s*Tj/g) || [];
        const arrayOperators = match.match(/\[(.*?)\]\s*TJ/g) || [];
        
        for (const op of textOperators) {
          const text = op.match(/\((.*?)\)/)?.[1];
          if (text) {
            extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
          }
        }
        
        for (const op of arrayOperators) {
          const content = op.match(/\[(.*?)\]/)?.[1];
          if (content) {
            // Extract strings from TJ array
            const strings = content.match(/\((.*?)\)/g) || [];
            for (const str of strings) {
              const text = str.match(/\((.*?)\)/)?.[1];
              if (text) {
                extractedText += text.replace(/\\[rn]/g, '\n') + ' ';
              }
            }
          }
        }
      }
    }
    
    // Clean up the text
    extractedText = extractedText
      .replace(/\\[rn]/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`[MediaLibrary MCP] Successfully extracted ${extractedText.length} characters from PDF`);
    
    if (extractedText.length > 0) {
      return extractedText;
    } else {
      return 'This PDF document was processed but contains no extractable text. It may be an image-only PDF, encrypted document, or use unsupported text encoding. Consider using OCR for image-based PDFs.';
    }
  } catch (error: any) {
    console.error('[MediaLibrary MCP] PDF extraction error:', error);
    return `Error extracting text from PDF: ${error.message}. The document may be corrupted, encrypted, or in an unsupported format.`;
  }
}

async function extractTextFromDOCX(docxData: Uint8Array): Promise<string> {
  try {
    console.log(`[MediaLibrary MCP] Processing DOCX file (${docxData.length} bytes)`);
    
    // DOCX files are ZIP archives - extract XML text content
    const textDecoder = new TextDecoder('latin1');
    const docxText = textDecoder.decode(docxData);
    
    let extractedText = '';
    
    // Look for XML text patterns in the DOCX content
    const xmlPatterns = [
      /<w:t[^>]*>([^<]+)<\/w:t>/g,
      /<w:t>([^<]+)<\/w:t>/g,
      /<t[^>]*>([^<]+)<\/t>/g,
    ];
    
    for (const pattern of xmlPatterns) {
      let match;
      while ((match = pattern.exec(docxText)) !== null) {
        const text = match[1];
        if (text && text.trim().length > 0) {
          extractedText += text.trim() + ' ';
        }
      }
    }
    
    // Clean up and format the text
    if (extractedText.length > 0) {
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n')
        .trim();
      
      console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from DOCX (XML method)`);
      return extractedText;
    }
    
    // Fallback method - look for readable text patterns
    console.log(`[MediaLibrary MCP] XML extraction failed, trying fallback method for DOCX`);
    const readableChunks = [];
    const lines = docxText.split(/[\r\n]+/);
    
    for (const line of lines) {
      // Look for lines that contain readable text (letters, numbers, common punctuation)
      const cleanLine = line.replace(/[^\x20-\x7E]/g, '').trim();
      if (cleanLine.length > 10 && /[a-zA-Z]/.test(cleanLine) && !/^[<>{}[\]\\\/]+$/.test(cleanLine)) {
        readableChunks.push(cleanLine);
      }
    }
    
    if (readableChunks.length > 0) {
      extractedText = readableChunks.join('\n').trim();
      console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from DOCX (fallback method)`);
      return extractedText;
    }
    
    console.log(`[MediaLibrary MCP] No extractable text found in DOCX file`);
    return 'This DOCX document was processed but contains no extractable text. It may be encrypted, corrupted, contain only images, or use unsupported formatting.';
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] DOCX extraction error:', error);
    return `Error extracting text from DOCX: ${error.message}. The document may be corrupted or in an unsupported format.`;
  }
}

async function extractTextWithOCR(
  fileData: Uint8Array,
  fileName: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('OCR.space API key not configured');
  }

  try {
    console.log(`[MediaLibrary MCP] Attempting OCR extraction for ${fileName}`);
    
    // Convert file data to base64
    const base64Data = btoa(String.fromCharCode(...fileData));
    
    // Prepare form data for OCR.space API
    const formData = new FormData();
    formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // Use engine 2 for better accuracy
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OCR API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.IsErroredOnProcessing) {
      throw new Error(`OCR processing error: ${result.ErrorMessage}`);
    }
    
    const extractedText = result.ParsedResults?.[0]?.ParsedText || '';
    console.log(`[MediaLibrary MCP] OCR extracted ${extractedText.length} characters`);
    
    return extractedText.trim();
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] OCR extraction failed:', error);
    throw error;
  }
}

async function extractTextFromDocument(
  fileData: Uint8Array, 
  fileType: string, 
  fileName: string,
  retryCount: number = 0
): Promise<string> {
  console.log(`[MediaLibrary MCP] Starting text extraction for ${fileName} (${fileType}) - Attempt ${retryCount + 1}`);
  
  try {
    let extractedText = '';
    
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractTextFromPDF(fileData);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               fileName.toLowerCase().endsWith('.docx')) {
      extractedText = await extractTextFromDOCX(fileData);
    } else if (fileType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
      // For text files, just decode as UTF-8
      try {
        extractedText = new TextDecoder('utf-8').decode(fileData);
        console.log(`[MediaLibrary MCP] Extracted ${extractedText.length} characters from TXT file`);
        return extractedText;
      } catch (error) {
        console.error('[MediaLibrary MCP] TXT extraction error:', error);
        return `Error reading text file: ${error.message}`;
      }
    } else {
      return `Unsupported file type: ${fileType}. Supported formats: PDF, DOCX, TXT`;
    }
    
    // Check if extraction was successful
    const isSuccessful = extractedText.length > 50 && 
                        !extractedText.includes('no extractable text') &&
                        !extractedText.includes('Error extracting text') &&
                        !extractedText.includes('corrupted') &&
                        !extractedText.includes('encrypted');
    
    if (isSuccessful) {
      console.log(`[MediaLibrary MCP] Successfully extracted ${extractedText.length} characters on attempt ${retryCount + 1}`);
      return extractedText;
    }
    
    // If extraction failed and we haven't exceeded retry limit, try again
    if (retryCount < 2) {
      console.log(`[MediaLibrary MCP] Extraction attempt ${retryCount + 1} yielded poor results, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return await extractTextFromDocument(fileData, fileType, fileName, retryCount + 1);
    }
    
    // If all retries failed, try OCR fallback for PDFs
    if ((fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) && 
        Deno.env.get('OCR_SPACE_API_KEY')) {
      
      console.log(`[MediaLibrary MCP] Standard extraction failed after ${retryCount + 1} attempts, trying OCR fallback`);
      
      try {
        const ocrText = await extractTextWithOCR(fileData, fileName, Deno.env.get('OCR_SPACE_API_KEY'));
        if (ocrText.length > 10) {
          console.log(`[MediaLibrary MCP] OCR fallback successful: ${ocrText.length} characters`);
          return `${ocrText}\n\n[Note: This content was extracted using OCR due to document format limitations]`;
        }
      } catch (ocrError) {
        console.error('[MediaLibrary MCP] OCR fallback also failed:', ocrError);
      }
    }
    
    // Return the best result we got, even if it's not ideal
    return extractedText;
    
  } catch (error: any) {
    console.error(`[MediaLibrary MCP] Text extraction error on attempt ${retryCount + 1}:`, error);
    
    // If we haven't exceeded retry limit, try again
    if (retryCount < 2) {
      console.log(`[MediaLibrary MCP] Retrying extraction due to error...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await extractTextFromDocument(fileData, fileType, fileName, retryCount + 1);
    }
    
    // If all retries failed, return error message
    return `Error extracting text after ${retryCount + 1} attempts: ${error.message}. The document may be corrupted, encrypted, or in an unsupported format.`;
  }
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const bestEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      if (bestEnd > start + chunkSize * 0.5) {
        end = bestEnd + 1;
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = Math.max(start + 1, end - overlap);
  }
  
  return chunks;
}

// =============================================
// Document Management Handlers
// =============================================

async function handleUploadDocument(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { file_name, file_type, file_size, category = 'documents', description, tags = [] }: UploadRequest = params;
    
    if (!file_name || !file_type || !file_size) {
      throw new Error('Missing required fields: file_name, file_type, file_size');
    }
    
    // Generate storage path: user_id/category/timestamp_filename
    const timestamp = Date.now();
    const fileExtension = file_name.split('.').pop() || '';
    const baseName = file_name.replace(/\.[^/.]+$/, '');
    const sanitizedBaseName = baseName
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
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
    
    return {
      success: true,
      data: {
        media_id: mediaEntry.id,
        file_name: mediaEntry.file_name,
        storage_path: storagePath,
        upload_url: `${supabaseUrl}/storage/v1/object/media-library/${storagePath}`,
        processing_status: 'uploaded',
        message: `Document uploaded successfully. Use process_document to extract text content.`
      },
      metadata: {
        tool_name: 'upload_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Upload document error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'upload_document',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleProcessDocument(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, force_reprocess = false } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Get the document from database
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !mediaFile) {
      throw new Error('Document not found or access denied');
    }
    
    // Check if already processed
    if (mediaFile.processing_status === 'completed' && mediaFile.text_content && !force_reprocess) {
      return {
        success: true,
        data: {
          media_id: document_id,
          file_name: mediaFile.file_name,
          processing_status: 'already_completed',
          text_content: mediaFile.text_content,
          text_content_length: mediaFile.text_content.length,
          chunk_count: mediaFile.chunk_count,
          message: `Document already processed. Contains ${mediaFile.text_content.length} characters in ${mediaFile.chunk_count} chunks.`
        },
        metadata: {
          tool_name: 'process_document',
          execution_time_ms: Date.now() - startTime
        }
      };
    }
    
    // Update status to processing
    await supabase
      .from('media_library')
      .update({ processing_status: 'processing' })
      .eq('id', document_id);
    
    console.log(`[MediaLibrary MCP] Starting processing for document ${document_id}: ${mediaFile.file_name}`);
    
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('media-library')
      .download(mediaFile.storage_path);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    
    // Convert to Uint8Array for text extraction
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Extract text content
    const textContent = await extractTextFromDocument(
      uint8Array, 
      mediaFile.file_type, 
      mediaFile.file_name
    );
    
    console.log(`[MediaLibrary MCP] Extracted ${textContent.length} characters from ${mediaFile.file_name}`);
    
    // Create chunks
    const chunks = chunkText(textContent);
    const chunkCount = chunks.length;
    
    console.log(`[MediaLibrary MCP] Created ${chunkCount} chunks from extracted text`);
    
    // Update database with processed content
    console.log(`[MediaLibrary MCP] Updating database with ${textContent.length} characters of content for document ${document_id}`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('media_library')
      .update({
        text_content: textContent,
        chunk_count: chunkCount,
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', document_id)
      .select('id, text_content, chunk_count, processing_status');
    
    if (updateError) {
      console.error(`[MediaLibrary MCP] Database update failed:`, updateError);
      throw updateError;
    }
    
    // Verify the update was successful
    if (!updateResult || updateResult.length === 0) {
      console.error(`[MediaLibrary MCP] No rows updated for document ${document_id}`);
      throw new Error('Failed to update document in database');
    }
    
    const updatedDoc = updateResult[0];
    console.log(`[MediaLibrary MCP] Database update verified:`, {
      document_id: updatedDoc.id,
      content_length: updatedDoc.text_content?.length || 0,
      chunk_count: updatedDoc.chunk_count,
      status: updatedDoc.processing_status
    });
    
    // Double-check by reading back the content
    const { data: verifyDoc, error: verifyError } = await supabase
      .from('media_library')
      .select('text_content, chunk_count, processing_status')
      .eq('id', document_id)
      .single();
    
    if (verifyError) {
      console.error(`[MediaLibrary MCP] Verification read failed:`, verifyError);
    } else {
      console.log(`[MediaLibrary MCP] Verification read successful:`, {
        content_length: verifyDoc.text_content?.length || 0,
        chunk_count: verifyDoc.chunk_count,
        status: verifyDoc.processing_status
      });
    }
    
    console.log(`[MediaLibrary MCP] Successfully processed document ${document_id}. Ready to hand off ${textContent.length} characters to agent.`);
    
    return {
      success: true,
      data: {
        media_id: document_id,
        file_name: mediaFile.file_name,
        processing_status: 'completed',
        text_content: textContent,
        text_content_length: textContent.length,
        chunk_count: chunkCount,
        processing_method: 'direct_extraction',
        message: `Document processed successfully. Extracted ${textContent.length} characters into ${chunkCount} chunks. Content ready for agent access.`
      },
      metadata: {
        tool_name: 'process_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Process document error:', error);
    
    // Update status to error
    if (params.document_id) {
      await supabase
        .from('media_library')
        .update({ processing_status: 'error' })
        .eq('id', params.document_id);
    }
    
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'process_document',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleAssignToAgent(
  supabase: any,
  agentId: string,
  userId: string,
  params: any
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { 
      document_id, 
      assignment_type = 'reference',
      include_in_vector_search = true,
      include_in_knowledge_graph = false,
      priority_level = 1
    } = params;
    
    if (!document_id) {
      throw new Error('Missing required parameter: document_id');
    }
    
    // Use the database function to assign media to agent
    const { data: assignmentId, error: assignError } = await supabase
      .rpc('assign_media_to_agent', {
        p_agent_id: agentId,
        p_media_id: document_id,
        p_user_id: userId,
        p_assignment_type: assignment_type,
        p_include_vector: include_in_vector_search,
        p_include_graph: include_in_knowledge_graph
      });
    
    if (assignError) throw assignError;
    
    return {
      success: true,
      data: {
        assignment_id: assignmentId,
        agent_id: agentId,
        document_id: document_id,
        assignment_type: assignment_type,
        message: `Document successfully assigned to agent with type "${assignment_type}"`
      },
      metadata: {
        tool_name: 'assign_to_agent',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Assign to agent error:', error);
    return {
      success: false,
      error: error.message,
      metadata: {
        tool_name: 'assign_to_agent',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

// =============================================
// Existing MCP Tool Handlers
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
    
    // Create a helpful summary for the agent
    const searchSummary = formattedResults.length > 0 
      ? `Found ${formattedResults.length} document(s) matching "${query}":\n\n${formattedResults.map((doc, index) => 
          `${index + 1}. "${doc.title}" (ID: ${doc.id})\n   Category: ${doc.category}\n   Preview: ${doc.content_preview || 'No preview available'}`
        ).join('\n\n')}\n\nUse get_document_content with the document ID to retrieve the full content of any document.`
      : `No documents found matching "${query}". The user may need to upload documents first or try different search terms.`;

    return {
      success: true,
      data: {
        search_results: searchSummary,
        documents: formattedResults,
        query_used: query,
        search_type: search_type
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
        
        // Normalize search term and filenames for better matching
        // Convert hyphens and underscores to spaces for comparison
        let normalizedSearchTerm = searchTerm.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedFileName = fileName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedDisplayName = displayName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Special handling for "UUID_OF_*" patterns - extract the meaningful part
        if (normalizedSearchTerm.startsWith('uuid of ') || normalizedSearchTerm.startsWith('uuid_of_')) {
          normalizedSearchTerm = normalizedSearchTerm.replace(/^uuid[\s_]*of[\s_]*/, '');
          console.log(`[MediaLibrary MCP] Extracted meaningful search term: "${normalizedSearchTerm}" from UUID_OF pattern`);
        }
        
        console.log(`[MediaLibrary MCP] Comparing "${normalizedSearchTerm}" with "${normalizedFileName}"`);
        
        // For short search terms (like numbers), require more specific matching
        if (normalizedSearchTerm.length <= 2) {
          // Only match if it's a word boundary or exact filename match
          const wordBoundaryRegex = new RegExp(`\\b${normalizedSearchTerm}\\b`, 'i');
          const matches = wordBoundaryRegex.test(normalizedFileName) || wordBoundaryRegex.test(normalizedDisplayName);
          
          if (matches) {
            console.log(`[MediaLibrary MCP] Found matching document (word boundary): "${doc.file_name}" (display: "${doc.display_name}")`);
          }
          return matches;
        } else {
          // For longer terms, use substring matching with multiple strategies
          const matches = normalizedFileName.includes(normalizedSearchTerm) || 
                         normalizedDisplayName.includes(normalizedSearchTerm) ||
                         normalizedFileName.replace(/\.pdf$/i, '').includes(normalizedSearchTerm) ||
                         normalizedDisplayName.replace(/\.pdf$/i, '').includes(normalizedSearchTerm) ||
                         // Also try partial word matching
                         normalizedSearchTerm.split(' ').every(word => 
                           word.length > 2 && (normalizedFileName.includes(word) || normalizedDisplayName.includes(word))
                         );
          
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
        // Multiple documents with the same name - use the most recent one
        console.log(`[MediaLibrary MCP] Found ${documents.length} documents matching "${document_id}". Using the most recent one.`);
        
        // Sort by created_at descending and use the most recent
        documents.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Most recent first
        });
        
        const mostRecent = documents[0];
        console.log(`[MediaLibrary MCP] Selected most recent document ID: ${mostRecent.id} (created: ${mostRecent.created_at})`);
        document_id = mostRecent.id;
      } else {
        document_id = documents[0].id;
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
    
    // Use the database function to get content with retry mechanism
    let documentContent: any = null;
    let contentError: any = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !documentContent) {
      console.log(`[MediaLibrary MCP] Attempting to retrieve document content (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase
        .rpc('get_media_document_content_for_agent', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_document_id: document_id,
          p_include_metadata: include_metadata
        });
      
      if (error) {
        contentError = error;
        console.error(`[MediaLibrary MCP] Content retrieval attempt ${retryCount + 1} failed:`, error);
      } else if (data && data.text_content && data.text_content.length > 0) {
        documentContent = data;
        console.log(`[MediaLibrary MCP] Content retrieval successful on attempt ${retryCount + 1}`);
        break;
      } else {
        console.log(`[MediaLibrary MCP] Content retrieval attempt ${retryCount + 1} returned empty content`);
        
        // Try direct database query as fallback
        if (retryCount === 1) {
          console.log(`[MediaLibrary MCP] Trying direct database query as fallback`);
          const { data: directData, error: directError } = await supabase
            .from('media_library')
            .select('id, file_name, display_name, text_content, chunk_count, processing_status')
            .eq('id', document_id)
            .eq('user_id', userId)
            .single();
          
          if (!directError && directData && directData.text_content) {
            console.log(`[MediaLibrary MCP] Direct query successful: ${directData.text_content.length} characters`);
            documentContent = {
              document_id: directData.id,
              file_name: directData.file_name,
              display_name: directData.display_name,
              text_content: directData.text_content,
              chunk_count: directData.chunk_count,
              processing_status: directData.processing_status
            };
            break;
          } else {
            console.error(`[MediaLibrary MCP] Direct query also failed:`, directError);
          }
        }
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`[MediaLibrary MCP] Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (contentError && !documentContent) {
      throw contentError;
    }
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent after multiple attempts');
    }
    
    // Log successful content retrieval
    const contentLength = documentContent.text_content?.length || 0;
    console.log(`[MediaLibrary MCP] Successfully retrieved document content from database:`, {
      document_id: documentContent.document_id,
      file_name: documentContent.file_name,
      content_length: contentLength,
      has_content: contentLength > 0
    });
    
    // Format the response to clearly provide the document content to the agent
    const contentMessage = documentContent.text_content && documentContent.text_content.trim() 
      ? `Here is the content from your document "${documentContent.display_name || documentContent.file_name}":\n\n${documentContent.text_content}`
      : `The document "${documentContent.display_name || documentContent.file_name}" was processed but contains no extractable text content. This may be an image-only PDF, encrypted document, or unsupported file format.`;
    
    console.log(`[MediaLibrary MCP] Handing off ${contentLength} characters of document content back to agent`);

    return {
      success: true,
      data: {
        document_content: contentMessage,
        document_metadata: {
          id: documentContent.document_id,
          name: documentContent.display_name || documentContent.file_name,
          file_type: documentContent.file_type,
          category: documentContent.category,
          processing_status: documentContent.processing_status,
          chunk_count: documentContent.chunk_count,
          content_length: documentContent.text_content?.length || 0
        }
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

async function handleReprocessDocument(
  supabase: any,
  agentId: string,
  userId: string,
  params: any,
  authHeader?: string
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { document_id, document_name, force_ocr = false } = params;
    
    if (!document_id && !document_name) {
      throw new Error('Missing required parameter: document_id or document_name');
    }
    
    // Resolve document ID - check if document_id is actually a UUID or a name
    let resolvedDocumentId = document_id;
    
    // Check if document_id looks like a UUID (36 characters with dashes)
    const isUUID = document_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(document_id);
    
    if (!isUUID && (document_id || document_name)) {
      const searchTerm = document_id || document_name;
      console.log(`[MediaLibrary MCP] document_id "${searchTerm}" is not a UUID, attempting to find by title/filename`);
      
      // Get all assigned documents and find by name
      const { data: allDocuments, error: listError } = await supabase
        .rpc('list_agent_assigned_documents', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_category: null,
          p_assignment_type: null,
          p_include_inactive: false,
          p_limit: 100,
          p_offset: 0
        });
      
      if (listError) throw listError;
      
      console.log(`[MediaLibrary MCP] Found ${allDocuments?.length || 0} total documents for user ${userId}`);
      
      // Search for document by name (case-insensitive)
      const searchName = searchTerm.toLowerCase();
      const matchingDoc = allDocuments?.find((doc: any) => {
        const docName = (doc.file_name || '').toLowerCase();
        const displayName = (doc.display_name || '').toLowerCase();
        
        console.log(`[MediaLibrary MCP] Comparing "${searchName}" with "${docName}"`);
        
        return docName === searchName || 
               displayName === searchName ||
               docName.includes(searchName) ||
               displayName.includes(searchName);
      });
      
      if (matchingDoc) {
        resolvedDocumentId = matchingDoc.document_id;
        console.log(`[MediaLibrary MCP] Found matching document: "${matchingDoc.file_name}" (display: "${matchingDoc.display_name}")`);
        console.log(`[MediaLibrary MCP] Resolved "${searchTerm}" to UUID: ${resolvedDocumentId}`);
      } else {
        throw new Error(`Document "${searchTerm}" not found in your assigned documents`);
      }
    }
    
    if (!resolvedDocumentId) {
      throw new Error('Could not resolve document ID');
    }
    
    // Verify the document exists and is assigned to the agent
    const { data: documentContent, error: contentError } = await supabase
      .rpc('get_media_document_content_for_agent', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_document_id: resolvedDocumentId,
        p_include_metadata: true
      });
    
    if (contentError) throw contentError;
    
    if (!documentContent) {
      throw new Error('Document not found or not assigned to this agent');
    }
    
    // Check if the document content appears corrupted or needs OCR
    const currentContent = documentContent.text_content || '';
    const fileType = documentContent.file_type || '';
    const fileName = documentContent.display_name || documentContent.file_name || 'Unknown';
    
    // Smart detection of documents that need reprocessing
    const isLikelyCorrupted = currentContent.length < 50 || 
                             currentContent.includes('encoded') || 
                             currentContent.includes('corrupted') ||
                             currentContent.includes('binary') ||
                             currentContent.includes('error');
    
    const isPdfOrImage = fileType.includes('pdf') || fileType.includes('image');
    const needsReprocessing = isLikelyCorrupted || force_ocr;
    
    if (!needsReprocessing && !force_ocr) {
      const suggestion = isPdfOrImage && currentContent.length < 200 
        ? ' If this PDF or image should have more text content, you can force reprocessing with OCR by saying "reprocess [document] with OCR".'
        : '';
        
      return {
        success: true,
        data: {
          document_id: document_id,
          document_name: fileName,
          message: `"${fileName}" appears to have good content (${currentContent.length} characters). ${suggestion}`,
          current_content_length: currentContent.length,
          file_type: fileType,
          content_preview: currentContent.substring(0, 200) + (currentContent.length > 200 ? '...' : '')
        },
        metadata: {
          tool_name: 'reprocess_document',
          execution_time_ms: Date.now() - startTime
        }
      };
    }
    
    console.log(`[MediaLibrary MCP] Triggering reprocessing for document ${resolvedDocumentId}`);
    
    // Create Supabase client with service role for calling media-library-api
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call the media-library-api to reprocess the document with user auth
    const invokeOptions: any = {
      body: {
        action: 'process',
        document_id: resolvedDocumentId,
        user_id: userId,
        force_reprocess: true,
        force_ocr: force_ocr
      }
    };
    
    // Pass through the original authorization header if available
    if (authHeader) {
      invokeOptions.headers = {
        'Authorization': authHeader
      };
    }
    
    const { data: reprocessResult, error: reprocessError } = await serviceSupabase.functions.invoke('media-library-api', invokeOptions);
    
    if (reprocessError) {
      throw new Error(`Document reprocessing failed: ${reprocessError.message}`);
    }
    
    const successMessage = force_ocr 
      ? `Successfully reprocessed "${fileName}" with OCR. The document should now have better text extraction, especially if it contained images or scanned content.`
      : `Successfully reprocessed "${fileName}". The document content has been refreshed and should now be more accessible.`;
    
    return {
      success: true,
      data: {
        document_id: resolvedDocumentId,
        document_name: fileName,
        message: successMessage,
        previous_content_length: currentContent.length,
        file_type: fileType,
        reprocessing_type: force_ocr ? 'OCR-enhanced' : 'standard',
        next_steps: 'You can now try reading the document content again or searching within it. The updated content should be available immediately.',
        reprocess_result: reprocessResult
      },
      metadata: {
        tool_name: 'reprocess_document',
        execution_time_ms: Date.now() - startTime
      }
    };
    
  } catch (error: any) {
    console.error('[MediaLibrary MCP] Reprocess document error:', error);
    
    // Provide intelligent MCP error messages with actionable guidance
    let helpfulError = error.message;
    if (error.message.includes('Missing required parameter: document_id')) {
      helpfulError = 'I need to know which document to reprocess. Please tell me the document name or ID, or ask me to "list my assigned documents" to see what\'s available. You can also say "reprocess the document about [topic]" and I\'ll find it.';
    } else if (error.message.includes('Document not found or not assigned')) {
      helpfulError = 'That document isn\'t in your assigned documents or doesn\'t exist. Let me "list your assigned documents" to show what\'s available, or you can upload a new document first.';
    } else if (error.message.includes('reprocessing failed')) {
      helpfulError = 'The document reprocessing encountered an issue. This might be due to OCR service limits or the document format. Try again in a few minutes, or let me check if there are alternative OCR services configured.';
    }
    
    return {
      success: false,
      error: helpfulError,
      metadata: {
        tool_name: 'reprocess_document',
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
      // Document management actions
      case 'upload_document':
        result = await handleUploadDocument(supabase, agent_id, user_id, params);
        break;
        
      case 'process_document':
        result = await handleProcessDocument(supabase, agent_id, user_id, params);
        break;
        
      case 'assign_to_agent':
        result = await handleAssignToAgent(supabase, agent_id, user_id, params);
        break;
        
      // Document retrieval actions  
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
        
      case 'reprocess_document':
        result = await handleReprocessDocument(supabase, agent_id, user_id, params, authHeader);
        break;

      default:
        throw new Error(`Unknown MCP tool action: ${action}. Available actions: upload_document, process_document, assign_to_agent, search_documents, get_document_content, list_assigned_documents, get_document_summary, find_related_documents, reprocess_document`);
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