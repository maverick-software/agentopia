import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Database, Brain, Upload, File, Plus, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Datastore {
  id: string;
  name: string;
  type: 'pinecone' | 'getzep';
  description?: string;
  config?: any;
}

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  url?: string;
}

interface DatastoreConfigurationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  availableDatastores: Datastore[];
  selectedVectorStore?: string;
  selectedKnowledgeStore?: string;
  onSelectDatastore: (type: 'pinecone' | 'getzep', datastoreId: string) => void;
  onCreateDatastore: (type: 'pinecone' | 'getzep') => void;
  connecting: boolean;
  loadingAvailable: boolean;
}

const SUPPORTED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const DatastoreConfigurationModal: React.FC<DatastoreConfigurationModalProps> = ({
  isOpen,
  onOpenChange,
  agentId,
  availableDatastores,
  selectedVectorStore,
  selectedKnowledgeStore,
  onSelectDatastore,
  onCreateDatastore,
  connecting,
  loadingAvailable
}) => {
  const { user } = useAuth();
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [agentName, setAgentName] = useState<string>('unknown_agent');

  // Fetch agent name when modal opens
  useEffect(() => {
    if (isOpen && agentId) {
      const fetchAgentName = async () => {
        try {
          const { data: agent, error } = await supabase
            .from('agents')
            .select('name')
            .eq('id', agentId)
            .single();
          
          if (error) throw error;
          setAgentName(agent.name || 'unknown_agent');
        } catch (error) {
          console.warn('Failed to fetch agent name:', error);
          setAgentName(`agent_${agentId.slice(0, 8)}`);
        }
      };
      
      fetchAgentName();
    }
  }, [isOpen, agentId]);

  // Filter datastores by type
  const vectorStores = availableDatastores.filter(ds => ds.type === 'pinecone');
  const knowledgeStores = availableDatastores.filter(ds => ds.type === 'getzep');

  // Get selected datastores
  const connectedVectorStore = vectorStores.find(ds => ds.id === selectedVectorStore);
  const connectedKnowledgeStore = knowledgeStores.find(ds => ds.id === selectedKnowledgeStore);

  const handleFileUpload = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      const isValidType = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type);
      const isValidSize = file.size <= MAX_FILE_SIZE;
      
      if (!isValidType) {
        console.warn(`File ${file.name} has unsupported type: ${file.type}`);
        return false;
      }
      
      if (!isValidSize) {
        console.warn(`File ${file.name} exceeds size limit: ${file.size} bytes`);
        return false;
      }
      
      return true;
    });

    for (const file of validFiles) {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to uploaded documents state
      const newDocument: UploadedDocument = {
        id: documentId,
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'uploading',
        progress: 0
      };

      setUploadedDocuments(prev => [...prev, newDocument]);

      try {
        // Simulate upload progress
        const updateProgress = (progress: number) => {
          setUploadedDocuments(prev => 
            prev.map(doc => 
              doc.id === documentId 
                ? { ...doc, progress, status: progress < 100 ? 'uploading' : 'processing' }
                : doc
            )
          );
        };

        // Upload file to Supabase Storage - bucket_name/user_name/agent_name/file_name.pdf
        const userName = (user?.user_metadata?.full_name || user?.email || user?.id || 'unknown_user')
          .replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize for file paths
        const sanitizedAgentName = agentName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize for file paths
        const filePath = `${userName}/${sanitizedAgentName}/${file.name}`;
        
        // Simulate progress updates
        updateProgress(25);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('datastore-documents')
          .upload(filePath, file, {
            contentType: file.type,
            duplex: 'half'
          });

        if (uploadError) throw uploadError;

        updateProgress(50);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('datastore-documents')
          .getPublicUrl(filePath);

        updateProgress(75);

        // Process document (extract text, generate embeddings, store in datastores)
        try {
          const { data: processResult, error: processError } = await supabase.functions.invoke(
            'process-datastore-document',
            {
              body: {
                document_id: documentId,
                agent_id: agentId,
                file_url: urlData.publicUrl,
                file_name: file.name,
                file_type: file.type
              }
            }
          );

          if (processError) {
            console.warn('Document processing error:', processError);
            // Don't throw - we still have the file uploaded
          } else {
            console.log('Document processed successfully:', processResult);
          }
        } catch (processError) {
          console.warn('Failed to process document:', processError);
          // Don't throw - we still have the file uploaded
        }

        updateProgress(100);

        // Update document status to completed
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'completed', url: urlData.publicUrl }
              : doc
          )
        );

      } catch (error) {
        console.error('Error uploading document:', error);
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'error', progress: 0 }
              : doc
          )
        );
      }
    }
  }, [user?.id, agentId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const getStatusIcon = (status: UploadedDocument['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-destructive" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: UploadedDocument['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Ready';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Agent Knowledge & Memory</DialogTitle>
          <DialogDescription>
            Set up vector storage, knowledge graphs, and document repositories for your agent's memory system.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Vector Datastore Section */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              connectedVectorStore 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Vector Datastore</CardTitle>
                    <CardDescription>
                      Pinecone vector database for semantic similarity search
                    </CardDescription>
                  </div>
                </div>
                {connectedVectorStore && (
                  <div className="flex items-center text-sm text-primary">
                    <Check className="h-4 w-4 mr-1" />
                    Connected
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {connectedVectorStore ? (
                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-card-foreground">{connectedVectorStore.name}</p>
                    <p className="text-sm text-muted-foreground">{connectedVectorStore.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectDatastore('pinecone', '')}
                    disabled={connecting}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingAvailable ? (
                    <p className="text-center text-muted-foreground py-4">Loading vector stores...</p>
                  ) : (
                    <>
                      <Label className="text-sm font-medium">Available Vector Stores</Label>
                      <Select 
                        value={selectedVectorStore || 'none'}
                        onValueChange={(value) => onSelectDatastore('pinecone', value === 'none' ? '' : value)}
                        disabled={connecting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vector store..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vectorStores.map(ds => (
                            <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        variant="outline"
                        onClick={() => onCreateDatastore('pinecone')}
                        className="w-full"
                        disabled={connecting}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Vector Store
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Knowledge Graph Datastore Section */}
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              connectedKnowledgeStore 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Brain className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Knowledge Graph Datastore</CardTitle>
                    <CardDescription>
                      GetZep knowledge graph for entity relationships and facts
                    </CardDescription>
                  </div>
                </div>
                {connectedKnowledgeStore && (
                  <div className="flex items-center text-sm text-primary">
                    <Check className="h-4 w-4 mr-1" />
                    Connected
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {connectedKnowledgeStore ? (
                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-card-foreground">{connectedKnowledgeStore.name}</p>
                    <p className="text-sm text-muted-foreground">{connectedKnowledgeStore.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectDatastore('getzep', '')}
                    disabled={connecting}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingAvailable ? (
                    <p className="text-center text-muted-foreground py-4">Loading knowledge graphs...</p>
                  ) : (
                    <>
                      <Label className="text-sm font-medium">Available Knowledge Graphs</Label>
                      <Select 
                        value={selectedKnowledgeStore || 'none'}
                        onValueChange={(value) => onSelectDatastore('getzep', value === 'none' ? '' : value)}
                        disabled={connecting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a knowledge graph..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {knowledgeStores.map(ds => (
                            <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        variant="outline"
                        onClick={() => onCreateDatastore('getzep')}
                        className="w-full"
                        disabled={connecting}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Knowledge Graph
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Repository Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Upload className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Document Repository</CardTitle>
                  <CardDescription>
                    Upload documents to ingest into your agent's knowledge base
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  isDragOver 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Supports: .pdf, .docx, .txt, .ppt, .pptx (max 10MB)
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = Object.values(SUPPORTED_FILE_TYPES).join(',');
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) handleFileUpload(files);
                    };
                    input.click();
                  }}
                >
                  Browse Files
                </Button>
              </div>

              {/* Uploaded Documents List */}
              {uploadedDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-medium">Uploaded Documents</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {uploadedDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {getStatusIcon(doc.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-muted-foreground">
                                {(doc.size / 1024).toFixed(1)} KB • {getStatusText(doc.status)}
                              </p>
                              {(doc.status === 'uploading' || doc.status === 'processing') && (
                                <Progress value={doc.progress} className="w-16 h-1" />
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDocument(doc.id)}
                          disabled={doc.status === 'uploading' || doc.status === 'processing'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Note */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Documents will be processed and stored in your connected datastores. 
                  Text will be extracted, chunked, and embedded for semantic search. 
                  {connectedVectorStore && " Vector embeddings will be stored in your Pinecone datastore."}
                  {connectedKnowledgeStore && " Entities and relationships will be extracted for your knowledge graph."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};