import { AlertCircle, Database, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ToolItem, ToolSettings } from './types';

interface ToolsContentProps {
  tools: ToolItem[];
  refreshingCache: boolean;
  hasAssignedDocuments: boolean;
  assignedDocumentsCount: number;
  selectedCredentials: Record<string, string | undefined>;
  onRefreshCache: () => Promise<void>;
  onToggle: (tool: keyof ToolSettings, enabled: boolean) => Promise<void>;
  onCredentialChange: (tool: ToolItem, value: string) => Promise<void>;
}

export function ToolsContent({
  tools,
  refreshingCache,
  hasAssignedDocuments,
  assignedDocumentsCount,
  selectedCredentials,
  onRefreshCache,
  onToggle,
  onCredentialChange,
}: ToolsContentProps) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium">Tools & Capabilities</h3>
          <p className="text-sm text-muted-foreground">Configure which tools and capabilities your agent can use.</p>
        </div>
        <Button onClick={() => void onRefreshCache()} disabled={refreshingCache} variant="outline" size="sm" className="flex-shrink-0">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshingCache ? 'animate-spin' : ''}`} />
          Refresh Tool Cache
        </Button>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Tool Schema Cache</h4>
                <Badge variant="outline" className="text-xs">
                  System
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                The tool cache stores schemas and metadata for all available tools. Refresh this cache after integration or credential changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const hasCredentials = tool.availableCredentials.length > 0;
          const selectedCredential = selectedCredentials[tool.toolType] || '';
          return (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${tool.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{tool.name}</h4>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={tool.id}
                        checked={tool.enabled}
                        onCheckedChange={(checked) => void onToggle(tool.id, checked)}
                        disabled={tool.id === 'ocr_processing_enabled' && hasAssignedDocuments}
                      />
                      <Label htmlFor={tool.id} className="sr-only">
                        Toggle {tool.name}
                      </Label>
                    </div>
                  </div>

                  {tool.id === 'ocr_processing_enabled' && hasAssignedDocuments && (
                    <div className="pl-16 mt-2">
                      <div className="flex items-start space-x-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Required for Assigned Documents</p>
                          <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
                            This agent has {assignedDocumentsCount} document{assignedDocumentsCount !== 1 ? 's' : ''} assigned. Remove all documents from the Media tab to disable this feature.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tool.enabled && hasCredentials && !tool.usesSystemKey && (
                    <div className="pl-16">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Credentials</Label>
                        <Select value={selectedCredential} onValueChange={(value) => void onCredentialChange(tool, value)}>
                          <SelectTrigger className="w-full max-w-sm">
                            <SelectValue placeholder="Choose credentials..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tool.availableCredentials.map((cred) => (
                              <SelectItem key={cred.connection_id} value={cred.connection_id}>
                                <div>
                                  <div className="font-medium">{cred.provider_name}</div>
                                  <div className="text-xs text-muted-foreground">{cred.connection_name}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedCredential && (
                          <div className="text-xs text-green-600 mt-1">
                            ✓ Selected: {tool.availableCredentials.find((c) => c.connection_id === selectedCredential)?.provider_name}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
