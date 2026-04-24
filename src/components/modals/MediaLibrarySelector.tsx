import React, { useEffect, useState } from 'react';
import { Check, FileText, Plus, Search, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import {
  assignMediaToAgent,
  fetchCompletedMediaFiles,
  fetchMediaCategories,
  getAccessToken,
  prepareMediaUpload,
  processUploadedMedia,
} from './media-library-selector/api';
import { MediaLibrarySelectorProps } from './media-library-selector/types';
import { filterMediaFiles, formatFileSize, getCategoryIcon, getFileTypeIcon } from './media-library-selector/utils';

export function MediaLibrarySelector({
  isOpen,
  onClose,
  agentId,
  agentName,
  onMediaAssigned,
  multiSelect,
  assignmentType = 'training_data',
  onSelect,
  multiple,
  title,
  description,
}: MediaLibrarySelectorProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const resolvedMultiSelect = multiSelect ?? multiple ?? true;
  const selectionCallback = onMediaAssigned ?? onSelect;

  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadMediaLibrary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAccessToken(supabase);
      const [loadedCategories, loadedFiles] = await Promise.all([
        fetchMediaCategories(token),
        fetchCompletedMediaFiles(token),
      ]);
      setCategories(loadedCategories);
      setMediaFiles(loadedFiles);
    } catch (error) {
      console.error('Error loading media library:', error);
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadMediaLibrary();
    }
  }, [isOpen, user]);

  const handleFileUpload = async () => {
    if (!uploadFile || !user) return;
    setUploading(true);
    try {
      const token = await getAccessToken(supabase);
      const preparedUpload = await prepareMediaUpload(
        token,
        uploadFile,
        uploadCategory,
        uploadDescription || `Uploaded for agent ${agentName || agentId || 'selection'}`,
      );

      const { error: storageError } = await supabase.storage
        .from(preparedUpload.bucket)
        .upload(preparedUpload.storage_path, uploadFile, {
          contentType: uploadFile.type,
          duplex: 'half',
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      const processingResult = await processUploadedMedia(token, preparedUpload.media_id);
      if (processingResult.success) {
        toast.success(`${uploadFile.name} uploaded and processed successfully`);
        setSelectedFiles(new Set([preparedUpload.media_id]));
        await loadMediaLibrary();
        setUploadFile(null);
        setUploadDescription('');
        setShowUploadForm(false);
      } else {
        toast.error(`${uploadFile.name} uploaded but processing failed: ${processingResult.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAssignSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Please select at least one file');
      return;
    }

    const selectedMedia = mediaFiles.filter((file) => selectedFiles.has(file.id));

    // Selection-only mode for legacy callers that just need media chosen.
    if (!agentId) {
      selectionCallback?.(selectedMedia);
      onClose();
      return;
    }

    setAssigning(true);
    try {
      const token = await getAccessToken(supabase);
      await Promise.all(
        Array.from(selectedFiles).map((mediaId) => assignMediaToAgent(token, agentId, mediaId, assignmentType)),
      );
      toast.success(`Successfully assigned ${selectedFiles.size} document(s) to ${agentName || 'agent'}`);
      selectionCallback?.(selectedMedia);
      onClose();
    } catch (error: any) {
      console.error('Assignment error:', error);
      toast.error(`Assignment failed: ${error.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    if (resolvedMultiSelect) {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) {
          next.delete(fileId);
        } else {
          next.add(fileId);
        }
        return next;
      });
      return;
    }
    setSelectedFiles(new Set([fileId]));
  };

  const filteredFiles = filterMediaFiles(mediaFiles, searchQuery, selectedCategory);
  const effectiveTitle = title || 'Select Documents from Media Library';
  const effectiveDescription =
    description ||
    `Choose documents to assign to ${agentName || 'this agent'} for ${assignmentType.replace('_', ' ')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{effectiveTitle}</DialogTitle>
          <DialogDescription>{effectiveDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(category.icon_name)}
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowUploadForm(!showUploadForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>

          {showUploadForm && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-4 w-4" />
                  <span className="font-medium">Upload New Document</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} accept="*/*" />
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category.icon_name)}
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={handleFileUpload} disabled={!uploadFile || uploading} size="sm">
                    {uploading ? 'Uploading...' : 'Upload & Add'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUploadForm(false);
                      setUploadFile(null);
                      setUploadDescription('');
                    }}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading media library...</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No documents found</p>
              <p className="text-sm">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Upload your first document to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredFiles.map((file) => (
                <Card
                  key={file.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedFiles.has(file.id) ? 'border-primary bg-primary/5' : 'hover:border-border hover:bg-accent/50'
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {resolvedMultiSelect && (
                        <Checkbox checked={selectedFiles.has(file.id)} onChange={() => toggleFileSelection(file.id)} />
                      )}
                      {getFileTypeIcon(file.file_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{file.display_name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {file.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>{file.chunk_count} chunks</span>
                          <span>•</span>
                          <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        </div>
                        {file.description && <p className="text-xs text-muted-foreground mt-1 truncate">{file.description}</p>}
                        {file.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {file.tags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {file.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{file.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedFiles.has(file.id) && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedFiles.size > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-medium">
                {selectedFiles.size} document{selectedFiles.size !== 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-muted-foreground">
                {agentId
                  ? `These will be assigned to ${agentName || 'the agent'} as ${assignmentType.replace('_', ' ')}`
                  : 'These will be attached to this step'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assigning}>
            Cancel
          </Button>
          <Button onClick={handleAssignSelected} disabled={selectedFiles.size === 0 || assigning}>
            {assigning ? 'Assigning...' : `Select ${selectedFiles.size} Document${selectedFiles.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
