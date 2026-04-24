import { Cloud, FolderOpen, HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SourcesTabProps } from './types';

export function SourcesTab({ agentId }: SourcesTabProps) {
  void agentId;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Cloud Storage Sources</h3>
        <p className="text-sm text-muted-foreground">Connect your agent to cloud storage services for document access and file operations.</p>
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            Additional Cloud Storage (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'OneDrive', icon: HardDrive, features: ['File Access', 'Shared Documents', 'Version History'] },
              { name: 'Google Drive', icon: Cloud, features: ['File Access', 'Shared Documents', 'Version History'] },
              { name: 'Dropbox', icon: Cloud, features: ['File Sync', 'Shared Folders', 'File History'] },
              { name: 'Box', icon: HardDrive, features: ['Enterprise Security', 'Workflow Integration', 'Advanced Permissions'] },
              { name: 'SharePoint', icon: HardDrive, features: ['Team Sites', 'Document Libraries', 'Workflows'] },
            ].map((source) => {
              const Icon = source.icon;
              return (
                <div key={source.name} className="p-4 border rounded-lg bg-background/50 opacity-60">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <h5 className="font-medium text-sm">{source.name}</h5>
                    <Badge variant="outline" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {source.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
