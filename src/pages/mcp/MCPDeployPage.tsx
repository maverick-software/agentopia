import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MCPServerDeployment from '../../components/mcp/MCPServerDeployment';
import { useMCPDeployment } from '../../hooks/useMCPDeployment';
import { MCPServerTemplate, MCPDeploymentConfig, MCPCredentialConfig } from '../../lib/mcp/ui-types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
// Progress component not available - removed for now
import { ArrowLeft, CheckCircle, Rocket, AlertCircle } from 'lucide-react';

// Mock available credentials - In production, this would come from an API
const mockCredentials: MCPCredentialConfig[] = [
  {
    providerId: 'github',
    connectionId: 'github-main',
    scopes: ['repo', 'user'],
    required: false
  },
  {
    providerId: 'openweather',
    connectionId: 'weather-api',
    scopes: ['current', 'forecast'],
    required: false
  }
];

interface LocationState {
  template?: MCPServerTemplate;
  config?: MCPDeploymentConfig;
}

export const MCPDeployPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState || {};
  
  const { deploy, deploymentStatus, loading, error, reset } = useMCPDeployment();
  const [template, setTemplate] = useState<MCPServerTemplate | null>(state.template || null);

  const handleDeploy = async (config: MCPDeploymentConfig) => {
    try {
      await deploy(config);
    } catch (err) {
      console.error('Deployment failed:', err);
    }
  };

  const handleCancel = () => {
    reset();
    navigate('/mcp/marketplace');
  };

  // If no template selected, show selection prompt
  if (!template) {
    return (
      <div className="space-y-6">
        <nav className="text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground">Dashboard</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Deploy</span>
        </nav>

        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Rocket className="h-6 w-6" />
                Deploy MCP Server
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Select a server template from the marketplace to begin deployment.
              </p>
              <div className="space-y-2">
                <Button onClick={() => navigate('/mcp/marketplace')} className="w-full">
                  Browse Marketplace
                </Button>
                <Button variant="outline" onClick={() => navigate('/mcp/servers')} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Servers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <a href="/dashboard" className="hover:text-foreground">Dashboard</a>
        <span className="mx-2">/</span>
        <a href="/mcp/servers" className="hover:text-foreground">MCP Servers</a>
        <span className="mx-2">/</span>
        <a href="/mcp/marketplace" className="hover:text-foreground">Marketplace</a>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Deploy</span>
      </nav>

      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/mcp/marketplace')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deploy Server</h1>
          <p className="text-muted-foreground">
            Configure and deploy {template.name} to your infrastructure
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <MCPServerDeployment
        template={template}
        onDeploy={handleDeploy}
        onCancel={handleCancel}
        availableCredentials={mockCredentials}
        loading={loading}
        error={error || undefined}
      />
    </div>
  );
}; 