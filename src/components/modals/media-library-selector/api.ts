import { SupabaseClient } from '@supabase/supabase-js';
import { MediaCategory, MediaFile } from './types';

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`;

const authedFetch = async (token: string, body: Record<string, unknown>) =>
  fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

export const getAccessToken = async (supabase: SupabaseClient): Promise<string> => {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error('No authenticated session');
  return token;
};

export const fetchMediaCategories = async (token: string): Promise<MediaCategory[]> => {
  const response = await authedFetch(token, { action: 'get_categories' });
  if (!response.ok) return [];
  const payload = await response.json();
  return payload.success ? payload.data?.categories || [] : [];
};

export const fetchCompletedMediaFiles = async (token: string): Promise<MediaFile[]> => {
  const response = await authedFetch(token, {
    action: 'list_documents',
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  if (!response.ok) return [];
  const payload = await response.json();
  if (!payload.success) return [];
  return (payload.data?.documents || []).filter((file: MediaFile) => file.processing_status === 'completed');
};

export const prepareMediaUpload = async (
  token: string,
  file: File,
  uploadCategory: string,
  uploadDescription: string,
) => {
  const response = await authedFetch(token, {
    action: 'upload',
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    category: uploadCategory,
    description: uploadDescription,
  });
  if (!response.ok) throw new Error('Upload preparation failed');
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || 'Upload failed');
  if (!payload.data?.storage_path || !payload.data?.bucket) {
    throw new Error('Storage path not provided by server');
  }
  return payload.data as { storage_path: string; bucket: string; media_id: string };
};

export const processUploadedMedia = async (token: string, mediaId: string) => {
  const response = await authedFetch(token, {
    action: 'process',
    document_id: mediaId,
  });
  if (!response.ok) return { success: false, error: 'Processing failed' };
  const payload = await response.json();
  return { success: payload.success, error: payload.error as string | undefined };
};

export const assignMediaToAgent = async (
  token: string,
  agentId: string,
  mediaId: string,
  assignmentType: 'training_data' | 'reference' | 'sop' | 'knowledge_base',
) => {
  const response = await authedFetch(token, {
    action: 'assign_to_agent',
    agent_id: agentId,
    document_id: mediaId,
    assignment_type: assignmentType,
    include_in_vector_search: true,
    include_in_knowledge_graph: true,
    priority_level: 1,
  });
  if (!response.ok) throw new Error(`Failed to assign document ${mediaId}`);
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || `Assignment failed for document ${mediaId}`);
  }
};
