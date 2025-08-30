import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FolderOpen, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Cloud,
  HardDrive
} from 'lucide-react';

interface SourcesTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface CloudSource {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  status: 'configured' | 'not_configured';
  requiresAuth: string;
  features: string[];
}

export function SourcesTab({ agentId, agentData, onAgentUpdated }: SourcesTabProps) {
  const [sources, setSources] = useState<CloudSource[]>([
    {
      id: 'onedrive',
      name: 'OneDrive',
      description: 'Access files and documents from Microsoft OneDrive',
      icon: Cloud,
      enabled: false,
      status: 'not_configured',
      requiresAuth: 'Microsoft OAuth',
      features: ['File Access', 'Document Search', 'Real-time Sync']
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      description: 'Connect to Google Drive for file access and collaboration',
      icon: Cloud,
      enabled: false,
      status: 'not_configured',
      requiresAuth: 'Google OAuth',
      features: ['File Access', 'Shared Documents', 'Version History']
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Integrate with Dropbox for file storage and sharing',
      icon: Cloud,
      enabled: false,
      status: 'not_configured',
      requiresAuth: 'Dropbox OAuth',
      features: ['File Sync', 'Shared Folders', 'File History']
    },
    {
      id: 'box',
      name: 'Box',
      description: 'Enterprise file sharing and collaboration with Box',
      icon: HardDrive,
      enabled: false,
      status: 'not_configured',
      requiresAuth: 'Box OAuth',
      features: ['Enterprise Security', 'Workflow Integration', 'Advanced Permissions']
    }
  ]);

  const handleToggle = (sourceId: string, enabled: boolean) => {
    setSources(prev => prev.map(source => 
      source.id === sourceId ? { ...source, enabled } : source
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Cloud Storage Sources</h3>
        <p className="text-sm text-muted-foreground">
          Connect your agent to cloud storage services for document access and file operations.
        </p>
      </div>

      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cloud storage integrations are currently in development. These features will allow your agent to:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• Access and search files across multiple cloud platforms</li>
            <li>• Automatically sync documents to the Media Library</li>
            <li>• Collaborate on shared documents and folders</li>
            <li>• Monitor file changes and updates in real-time</li>
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sources.map((source) => {
          const Icon = source.icon;
          const isConfigured = source.status === 'configured';
          
          return (
            <Card key={source.id} className="opacity-60">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{source.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Coming Soon
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {source.description}
                      </p>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Authentication: {source.requiresAuth}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Features:</p>
                          {source.features.map((feature) => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" disabled>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Configure
                    </Button>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={source.id}
                        checked={false}
                        disabled={true}
                      />
                      <Label htmlFor={source.id} className="sr-only">
                        Toggle {source.name}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Development Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Cloud storage integrations are planned for a future release. Stay tuned for updates on:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium mb-2">Phase 1: Basic Integration</h5>
              <ul className="text-muted-foreground space-y-1">
                <li>• OAuth authentication setup</li>
                <li>• File listing and access</li>
                <li>• Basic search capabilities</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">Phase 2: Advanced Features</h5>
              <ul className="text-muted-foreground space-y-1">
                <li>• Real-time synchronization</li>
                <li>• Collaborative editing</li>
                <li>• Automated workflows</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
