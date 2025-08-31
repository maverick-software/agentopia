import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Plus,
  Library,
  FileText,
  ExternalLink,
  BookOpen,
  Settings2,
  Hash
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { MediaLibrarySelector } from '../MediaLibrarySelector';

interface MediaTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

interface AssignedMedia {
  id: string;
  media_id: string;
  assignment_type: 'sop' | 'general_knowledge';
  media_library: {
    file_name: string;
    file_type: string;
    file_size: number;
    category: string;
    description?: string;
  };
}

export function MediaTab({ agentId, agentData, onAgentUpdated }: MediaTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [assignedMedia, setAssignedMedia] = useState<AssignedMedia[]>([]);
  const [sopCount, setSopCount] = useState(0);
  const [generalKnowledgeCount, setGeneralKnowledgeCount] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [showMediaLibrarySelector, setShowMediaLibrarySelector] = useState(false);
  const [selectorType, setSelectorType] = useState<'sop' | 'general_knowledge'>('sop');

  // Load assigned media
  useEffect(() => {
    if (user && agentId) {
      loadAssignedMedia();
    }
  }, [user, agentId]);

  const loadAssignedMedia = async () => {
    if (!user || !agentId) return;
    
    setLoadingMedia(true);
    try {
      const { data, error } = await supabase
        .from('agent_media_assignments')
        .select(`
          id,
          media_id,
          assignment_type,
          media_library (
            file_name,
            file_type,
            file_size,
            category,
            description
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_id', user.id);

      if (error) throw error;

      const mediaData = data || [];
      setAssignedMedia(mediaData);
      
      // Calculate counts and tokens
      const sopItems = mediaData.filter(m => m.assignment_type === 'sop');
      const generalItems = mediaData.filter(m => m.assignment_type === 'general_knowledge');
      
      setSopCount(sopItems.length);
      setGeneralKnowledgeCount(generalItems.length);
      
      // Estimate tokens (rough calculation: 1 token ≈ 4 characters for text files)
      const estimatedTokens = mediaData.reduce((total, item) => {
        const fileSize = item.media_library?.file_size || 0;
        const isTextFile = item.media_library?.file_type?.startsWith('text/') || 
                          item.media_library?.file_name?.endsWith('.txt') ||
                          item.media_library?.file_name?.endsWith('.md') ||
                          item.media_library?.file_name?.endsWith('.pdf');
        
        if (isTextFile) {
          return total + Math.ceil(fileSize / 4); // Rough token estimation
        }
        return total + Math.ceil(fileSize / 10); // Conservative estimate for other files
      }, 0);
      
      setTotalTokens(estimatedTokens);
      
    } catch (error) {
      console.error('Error loading assigned media:', error);
      toast.error('Failed to load assigned media');
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleAssignMedia = (type: 'sop' | 'general_knowledge') => {
    setSelectorType(type);
    setShowMediaLibrarySelector(true);
  };

  const handleRemoveMedia = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('agent_media_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Media removed from agent');
      loadAssignedMedia();
    } catch (error) {
      console.error('Error removing media:', error);
      toast.error('Failed to remove media');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTokenCount = (tokens: number) => {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
    return (tokens / 1000000).toFixed(1) + 'M';
  };

  const getMediaByType = (type: 'sop' | 'general_knowledge') => {
    return assignedMedia.filter(m => m.assignment_type === type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Media Library</h3>
          <p className="text-sm text-muted-foreground">
            Manage documents and media assigned to your agent for SOPs and general knowledge.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/media')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Full Library
        </Button>
      </div>

      {/* Media Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Settings2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{sopCount}</div>
                <div className="text-xs text-muted-foreground">SOPs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{generalKnowledgeCount}</div>
                <div className="text-xs text-muted-foreground">Knowledge Items</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Hash className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{formatTokenCount(totalTokens)}</div>
                <div className="text-xs text-muted-foreground">Est. Tokens</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SOPs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Settings2 className="h-5 w-5" />
                <span>Standard Operating Procedures</span>
              </CardTitle>
              <CardDescription>
                Process documents and workflows that guide agent behavior
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAssignMedia('sop')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add SOP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMedia ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading SOPs...
            </div>
          ) : getMediaByType('sop').length > 0 ? (
            <div className="space-y-3">
              {getMediaByType('sop').map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{item.media_library?.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(item.media_library?.file_size || 0)} • {item.media_library?.category}
                      </div>
                      {item.media_library?.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.media_library.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      SOP
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMedia(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No SOPs assigned to this agent</p>
              <p className="text-xs">Add process documents to guide agent behavior</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Knowledge Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>General Knowledge</span>
              </CardTitle>
              <CardDescription>
                Reference materials and knowledge base documents
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAssignMedia('general_knowledge')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Knowledge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMedia ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading knowledge items...
            </div>
          ) : getMediaByType('general_knowledge').length > 0 ? (
            <div className="space-y-3">
              {getMediaByType('general_knowledge').map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{item.media_library?.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(item.media_library?.file_size || 0)} • {item.media_library?.category}
                      </div>
                      {item.media_library?.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.media_library.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Knowledge
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMedia(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No knowledge items assigned to this agent</p>
              <p className="text-xs">Add reference materials and documentation</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Usage Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Hash className="h-5 w-5" />
            <span>Token Usage</span>
          </CardTitle>
          <CardDescription>
            Estimated token consumption for assigned media
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Estimated Tokens:</span>
              <span className="font-medium">{formatTokenCount(totalTokens)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>SOPs:</span>
              <span>{sopCount} {sopCount === 1 ? 'document' : 'documents'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Knowledge Items:</span>
              <span>{generalKnowledgeCount} {generalKnowledgeCount === 1 ? 'document' : 'documents'}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Token estimates are approximate. Actual usage may vary based on content processing and context inclusion.
          </p>
        </CardContent>
      </Card>

      {/* Media Library Selector Modal */}
      <MediaLibrarySelector
        isOpen={showMediaLibrarySelector}
        onClose={() => setShowMediaLibrarySelector(false)}
        agentId={agentId}
        assignmentType={selectorType}
        onAssignmentComplete={() => {
          setShowMediaLibrarySelector(false);
          loadAssignedMedia();
        }}
      />
    </div>
  );
}
