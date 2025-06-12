import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mcpService } from '../../lib/services/mcpService';
import { MCPServerTemplate, MCPDeploymentConfig } from '../../lib/mcp/ui-types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Rocket, Server, CheckCircle } from 'lucide-react';

interface LocationState {
  template?: MCPServerTemplate;
  config?: MCPDeploymentConfig;
}

export const MCPDeployPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [name, setName] = useState(state?.config?.name || '');
  const [serverType, setServerType] = useState(state?.template?.id || 'aws-tools');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('/mcp');
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'websocket'>('stdio');

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }

    try {
      setIsDeploying(true);
      setError(null);

      const deploymentConfig: MCPDeploymentConfig = {
        name: name.trim(),
        serverType,
        description: description.trim() || undefined,
        endpoint,
        transport,
        capabilities: state?.template?.requiredCapabilities || ['tools'],
        environment: {},
        resources: {
          memory: '256Mi',
          cpu: '0.2'
        }
      };

      const deployment = await mcpService.deployServer(deploymentConfig);
      
      console.log('Deployment initiated:', deployment);
      setDeploymentSuccess(true);
      
      // Redirect to servers page after short delay
      setTimeout(() => {
        navigate('/mcp/servers');
      }, 2000);

    } catch (err) {
      console.error('Deployment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to deploy MCP server');
    } finally {
      setIsDeploying(false);
    }
  };

  if (deploymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-900">Deployment Successful!</h1>
            <p className="text-muted-foreground mt-2">
              Your MCP server "{name}" has been deployed successfully.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/mcp/servers')}>
              View My Servers
            </Button>
            <Button variant="outline" onClick={() => navigate('/mcp/marketplace')}>
              Deploy Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-8">
        {/* Navigation */}
        <nav className="text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground transition-colors">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Deploy Server</span>
        </nav>

        {/* Header */}
        <div className="space-y-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/mcp/marketplace')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Rocket className="h-10 w-10 text-primary" />
              Deploy MCP Server
            </h1>
            <p className="text-lg text-muted-foreground">
              Configure and deploy your MCP server instance
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Deployment Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Server Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDeploy} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Server Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My MCP Server"
                        required
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        A unique name for your MCP server instance
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="serverType">Server Type</Label>
                      <Select value={serverType} onValueChange={setServerType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select server type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aws-tools">AWS Tools</SelectItem>
                          <SelectItem value="github-tools">GitHub Tools</SelectItem>
                          <SelectItem value="slack-tools">Slack Tools</SelectItem>
                          <SelectItem value="database-tools">Database Tools</SelectItem>
                          <SelectItem value="custom">Custom Server</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of this server's purpose"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Technical Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Technical Settings</h3>
                    
                    <div>
                      <Label htmlFor="endpoint">Endpoint Path</Label>
                      <Input
                        id="endpoint"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder="/mcp"
                      />
                    </div>

                    <div>
                      <Label htmlFor="transport">Transport Protocol</Label>
                      <Select value={transport} onValueChange={(value: any) => setTransport(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stdio">Standard I/O</SelectItem>
                          <SelectItem value="sse">Server-Sent Events</SelectItem>
                          <SelectItem value="websocket">WebSocket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      disabled={isDeploying || !name.trim()}
                      className="flex-1"
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy Server'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => navigate('/mcp/marketplace')}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {state?.template && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold">{state.template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {state.template.description}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Version:</span> {state.template.version}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Author:</span> {state.template.author}
                      </p>
                    </div>
                    {state.template.verified && (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Verified Template
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Deployment Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <p>
                    • Your MCP server will be deployed to your account
                  </p>
                  <p>
                    • It will be accessible to your agents immediately
                  </p>
                  <p>
                    • You can configure authentication and permissions later
                  </p>
                  <p>
                    • Deployment typically takes 30-60 seconds
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}; 