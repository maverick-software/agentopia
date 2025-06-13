// src/components/mcp/MCPServerConfig.tsx
import React, { useState, useEffect } from 'react';
import { MCPServerConfigProps, MCPServer } from '@/lib/mcp/ui-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  Save, 
  X, 
  RotateCcw,
  Trash2,
  Play,
  Settings, 
  Server, 
  Shield, 
  Activity, 
  Network,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MCPServerConfig: React.FC<MCPServerConfigProps> = ({
  server,
  onSave,
  onCancel,
  onRestart,
  onDelete,
  loading = false,
  error,
  readOnly = false
}) => {
  const [config, setConfig] = useState<Partial<MCPServer>>(server);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setConfig(server);
    setHasChanges(false);
  }, [server]);

  const handleInputChange = (field: keyof MCPServer, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNestedChange = (
    parent: keyof MCPServer,
    field: string,
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!config.name?.trim()) {
      errors.name = 'Server name is required';
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.port = 'Valid port number required (1-65535)';
    }

    if (!config.endpoint?.trim()) {
      errors.endpoint = 'Server endpoint is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(config);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save configuration:', err);
    }
  };

  const handleReset = () => {
    setConfig(server);
    setHasChanges(false);
    setValidationErrors({});
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Server Configuration</h2>
          <p className="text-muted-foreground">Configure {server.name} settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={server.status.state === 'running' ? 'default' : 'secondary'}>
            {server.status.state}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Server className="h-3 w-3 mr-1" />
            MCP Server
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasChanges && !readOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Remember to save before leaving this page.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Configuration */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Server Name *</Label>
                  <Input
                    id="name"
                    value={config.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={cn(validationErrors.name && "border-destructive")}
                    disabled={readOnly}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="endpoint">Endpoint *</Label>
                  <Input
                    id="endpoint"
                    value={config.endpoint || ''}
                    onChange={(e) => handleInputChange('endpoint', e.target.value)}
                    className={cn(validationErrors.endpoint && "border-destructive")}
                    disabled={readOnly}
                    placeholder="e.g., http://localhost:3000"
                  />
                  {validationErrors.endpoint && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.endpoint}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    min="1"
                    max="65535"
                    value={config.port || ''}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                    className={cn(validationErrors.port && "border-destructive")}
                    disabled={readOnly}
                  />
                  {validationErrors.port && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.port}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={config.protocol || 'http'}
                    onValueChange={(value) => handleInputChange('protocol', value)}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                      <SelectItem value="websocket">WebSocket</SelectItem>
                      <SelectItem value="stdio">STDIO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={config.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional description for this server"
                  rows={2}
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Configuration */}
        <TabsContent value="resources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Resource Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="memory">Memory Limit</Label>
                  <Input
                    id="memory"
                    value={config.memoryLimit || ''}
                    onChange={(e) => handleInputChange('memoryLimit', e.target.value)}
                    placeholder="e.g., 512Mi, 1Gi"
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="cpu">CPU Limit</Label>
                  <Input
                    id="cpu"
                    value={config.cpuLimit || ''}
                    onChange={(e) => handleInputChange('cpuLimit', e.target.value)}
                    placeholder="e.g., 0.5, 1.0"
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="storage">Storage</Label>
                  <Input
                    id="storage"
                    value={config.storageLimit || ''}
                    onChange={(e) => handleInputChange('storageLimit', e.target.value)}
                    placeholder="e.g., 1Gi, 10Gi"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-scaling</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic scaling based on resource usage
                    </p>
                  </div>
                  <Switch
                    checked={config.autoScale || false}
                    onCheckedChange={(checked) => handleInputChange('autoScale', checked)}
                    disabled={readOnly}
                  />
                </div>

                {config.autoScale && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <Label htmlFor="minReplicas">Min Replicas</Label>
                      <Input
                        id="minReplicas"
                        type="number"
                        min="1"
                        value={config.minReplicas || 1}
                        onChange={(e) => handleInputChange('minReplicas', parseInt(e.target.value))}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxReplicas">Max Replicas</Label>
                      <Input
                        id="maxReplicas"
                        type="number"
                        min="1"
                        value={config.maxReplicas || 3}
                        onChange={(e) => handleInputChange('maxReplicas', parseInt(e.target.value))}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Networking Configuration */}
        <TabsContent value="networking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>External Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow external connections to this server
                    </p>
                  </div>
                  <Switch
                    checked={config.externalAccess || false}
                    onCheckedChange={(checked) => handleInputChange('externalAccess', checked)}
                    disabled={readOnly}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Load Balancer</Label>
                    <p className="text-sm text-muted-foreground">
                      Use load balancer for high availability
                    </p>
                  </div>
                  <Switch
                    checked={config.loadBalancer || false}
                    onCheckedChange={(checked) => handleInputChange('loadBalancer', checked)}
                    disabled={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="customDomains">Custom Domains</Label>
                  <Textarea
                    id="customDomains"
                    value={config.customDomains?.join('\n') || ''}
                    onChange={(e) => handleInputChange('customDomains', e.target.value.split('\n').filter(d => d.trim()))}
                    placeholder="Enter custom domains, one per line"
                    rows={3}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Health Monitoring</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic health checks
                    </p>
                  </div>
                  <Switch
                    checked={config.healthMonitoring || false}
                    onCheckedChange={(checked) => handleInputChange('healthMonitoring', checked)}
                    disabled={readOnly}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Performance Monitoring</Label>
                    <p className="text-sm text-muted-foreground">
                      Collect performance metrics
                    </p>
                  </div>
                  <Switch
                    checked={config.performanceMonitoring || false}
                    onCheckedChange={(checked) => handleInputChange('performanceMonitoring', checked)}
                    disabled={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="logLevel">Log Level</Label>
                  <Select
                    value={config.logLevel || 'info'}
                    onValueChange={(value) => handleInputChange('logLevel', value)}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="environment">Environment Variables</Label>
                  <Textarea
                    id="environment"
                    value={Object.entries(config.environment || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={(e) => {
                      const env = {};
                      e.target.value.split('\n').forEach(line => {
                        const [key, ...valueParts] = line.split('=');
                        if (key && valueParts.length > 0) {
                          env[key.trim()] = valueParts.join('=').trim();
                        }
                      });
                      handleInputChange('environment', env);
                    }}
                    placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                    rows={5}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {!readOnly && (
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={onRestart}
              disabled={loading}
            >
              <Play className="h-4 w-4 mr-2" />
              Restart Server
            </Button>
            <Button 
              variant="destructive"
              onClick={onDelete}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Server
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={loading || !hasChanges}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || !hasChanges}
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPServerConfig; 