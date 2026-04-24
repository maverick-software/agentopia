import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import type { MediaCategory, MediaFile, MediaStats, SortOrder, ViewMode } from '../types';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MEDIA_LIBRARY_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`;

async function getAccessToken(supabase: ReturnType<typeof useSupabaseClient>) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('No authenticated session');
  }
  return session.session.access_token;
}

export function useMediaLibrary() {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadMediaLibrary = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const accessToken = await getAccessToken(supabase);

      const categoriesResponse = await fetch(MEDIA_LIBRARY_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_categories' }),
      });

      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.success) {
          setCategories(categoriesData.data.categories || []);
          setStats(categoriesData.data.statistics || null);
        }
      }

      const mediaResponse = await fetch(MEDIA_LIBRARY_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'list_documents',
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
      });

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        if (mediaData.success) {
          setMediaFiles(mediaData.data.documents || []);
        }
      }
    } catch (error) {
      console.error('Error loading media library:', error);
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, supabase, user]);

  useEffect(() => {
    if (user) {
      void loadMediaLibrary();
      return;
    }

    setMediaFiles([]);
    setCategories([]);
    setStats(null);
    setLoading(false);
  }, [loadMediaLibrary, user]);

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (!user || files.length === 0) return;

      setUploading(true);
      try {
        const accessToken = await getAccessToken(supabase);

        for (const file of Array.from(files)) {
          if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`File ${file.name} exceeds 50MB limit`);
            continue;
          }

          const uploadResponse = await fetch(MEDIA_LIBRARY_API, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'upload',
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              category: selectedCategory === 'all' ? 'general' : selectedCategory,
              description: `Uploaded via Media Library on ${new Date().toLocaleDateString()}`,
            }),
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload preparation failed for ${file.name}`);
          }

          const uploadData = await uploadResponse.json();
          if (!uploadData.success) {
            throw new Error(uploadData.error || `Upload failed for ${file.name}`);
          }

          const { error: storageError } = await supabase.storage
            .from(uploadData.data.bucket)
            .upload(uploadData.data.storage_path, file, {
              contentType: file.type,
              duplex: 'half',
            });

          if (storageError) {
            throw new Error(`Storage upload failed for ${file.name}: ${storageError.message}`);
          }

          const processResponse = await fetch(MEDIA_LIBRARY_API, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'process',
              document_id: uploadData.data.media_id,
            }),
          });

          if (!processResponse.ok) {
            const errorText = await processResponse.text();
            console.error('Process response error:', {
              status: processResponse.status,
              statusText: processResponse.statusText,
              errorText,
              fileName: file.name,
              mediaId: uploadData.data.media_id,
            });
            toast.warn(
              `${file.name} uploaded but processing failed: ${processResponse.status} ${processResponse.statusText}`,
            );
            continue;
          }

          const processData = await processResponse.json();
          if (processData.success) {
            toast.success(`${file.name} uploaded and processed successfully`);
          } else {
            toast.warn(`${file.name} uploaded but processing failed: ${processData.error}`);
          }
        }

        await loadMediaLibrary();
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(`Upload failed: ${error.message}`);
      } finally {
        setUploading(false);
      }
    },
    [loadMediaLibrary, selectedCategory, supabase, user],
  );

  const withSignedUrl = useCallback(
    async (file: MediaFile, expirySeconds: number) => {
      const accessToken = await getAccessToken(supabase);
      const response = await fetch(MEDIA_LIBRARY_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_signed_url',
          document_id: file.id,
          expiry_seconds: expirySeconds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.data?.signed_url) {
        throw new Error(result.error || 'Failed to get signed URL');
      }

      return result.data.signed_url as string;
    },
    [supabase],
  );

  const handleViewDocument = useCallback(
    async (file: MediaFile) => {
      try {
        const signedUrl = await withSignedUrl(file, 3600);
        window.open(signedUrl, '_blank');
      } catch (error: any) {
        console.error('View document error:', error);
        toast.error(`Failed to view document: ${error.message}`);
      }
    },
    [withSignedUrl],
  );

  const handleDownloadDocument = useCallback(
    async (file: MediaFile) => {
      try {
        const signedUrl = await withSignedUrl(file, 300);
        const fileResponse = await fetch(signedUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        const blob = await fileResponse.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.file_name;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        toast.success(`Downloaded ${file.file_name}`);
      } catch (error: any) {
        console.error('Download document error:', error);
        toast.error(`Failed to download document: ${error.message}`);
      }
    },
    [withSignedUrl],
  );

  const handleDeleteDocument = useCallback(
    async (file: MediaFile) => {
      if (!confirm(`Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`)) {
        return;
      }

      try {
        const { error: storageError } = await supabase.storage.from('media-library').remove([file.storage_path]);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from('media_library').delete().eq('id', file.id);
        if (dbError) throw dbError;

        toast.success(`Deleted ${file.file_name}`);
        await loadMediaLibrary();
      } catch (error: any) {
        console.error('Delete document error:', error);
        toast.error(`Failed to delete document: ${error.message}`);
      }
    },
    [loadMediaLibrary, supabase],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files) {
        void handleFileUpload(event.dataTransfer.files);
      }
    },
    [handleFileUpload],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const filteredFiles = useMemo(() => {
    return mediaFiles.filter((file) => {
      const normalizedQuery = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        file.file_name.toLowerCase().includes(normalizedQuery) ||
        file.display_name.toLowerCase().includes(normalizedQuery) ||
        file.description?.toLowerCase().includes(normalizedQuery) ||
        file.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || file.processing_status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [mediaFiles, searchQuery, selectedCategory, selectedStatus]);

  return {
    user,
    mediaFiles,
    categories,
    stats,
    loading,
    uploading,
    viewMode,
    searchQuery,
    selectedCategory,
    selectedStatus,
    sortBy,
    sortOrder,
    isDragOver,
    showUploadModal,
    filteredFiles,
    setViewMode,
    setSearchQuery,
    setSelectedCategory,
    setSelectedStatus,
    setSortBy,
    setSortOrder,
    setShowUploadModal,
    loadMediaLibrary,
    handleFileUpload,
    handleViewDocument,
    handleDownloadDocument,
    handleDeleteDocument,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  };
}
