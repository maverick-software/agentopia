// src/components/mcp/OneClickMCPDeployment.tsx
// One-click MCP deployment component with intelligent droplet selection

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { CheckCircle, Clock, AlertCircle, Zap, Server, Database, Network } from 'lucide-react';
import { AdminMCPService, MCPServerDeployment } from '../../lib/services/adminMCPService';
import { cn } from '../../lib/utils';

interface MCPTemplate {
  id: string;
  tool_name: string;
  display_name: string;
  description: string;
  docker_image: string;
  category: string;
  mcp_server_metadata?: {
    resourceHint: 'light' | 'medium' | 'heavy';
    environmentVariables?: Record<string, string>;
    version?: string;
    author?: string;
    tags?: string[];
  };
}

interface OneClickMCPDeploymentProps {
  template: MCPTemplate;
  onDeploymentComplete?: (deployment: MCPServerDeployment) => void;
  onDeploymentError?: (error: string) => void;
  className?: string;
}

type DeploymentState = 'idle' | 'analyzing' | 'selecting-droplet' | 'deploying' | 'success' | 'error';

interface DeploymentProgress {
  step: string;
  progress: number;
  message: string;
}

export const OneClickMCPDeployment: React.FC<OneClickMCPDeploymentProps> = ({
  template,
  onDeploymentComplete,
  onDeploymentError,
  className
}) => {
  const [deploymentState, setDeploymentState] = useState<DeploymentState>('idle');
  const [deploymentProgress, setDeploymentProgress] = useState<DeploymentProgress>({
    step: 'Ready to deploy',
    progress: 0,
    message: 'Click to start automatic deployment'
  });
  const [deploymentResult, setDeploymentResult] = useState<MCPServerDeployment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adminMCPService = new AdminMCPService();

  const handleOneClickDeploy = async () => {
    setDeploymentState('analyzing');
    setError(null);
    
    try {
      // Step 1: Analyzing template
      setDeploymentProgress({
        step: 'Analyzing template',
        progress: 10,
        message: `Validating ${template.display_name} template...`
      });

      await new Promise(resolve => setTimeout(resolve, 800)); // Brief pause for UX

      // Step 2: Intelligent droplet selection
      setDeploymentState('selecting-droplet');
      setDeploymentProgress({
        step: 'Selecting optimal droplet',
        progress: 30,
        message: 'Analyzing resource requirements and droplet availability...'
      });

      await new Promise(resolve => setTimeout(resolve, 1200)); // Brief pause for UX

      // Step 3: Deploying
      setDeploymentState('deploying');
      setDeploymentProgress({
        step: 'Deploying MCP server',
        progress: 60,
        message: 'Deploying to optimal droplet...'
      });

      // Call the enhanced AdminMCPService
      const result = await adminMCPService.oneClickDeploy(template.id);

      // Step 4: Success
      setDeploymentProgress({
        step: 'Deployment complete',
        progress: 100,
        message: `${result.serverName} deployed successfully!`
      });

      setDeploymentState('success');
      setDeploymentResult(result);
      onDeploymentComplete?.(result);

    } catch (error) {
      console.error('One-click deployment failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
      
      setError(errorMessage);
      setDeploymentState('error');
      setDeploymentProgress({
        step: 'Deployment failed',
        progress: 0,
        message: errorMessage
      });
      
      onDeploymentError?.(errorMessage);
    }
  };

  const resetDeployment = () => {
    setDeploymentState('idle');
    setDeploymentProgress({
      step: 'Ready to deploy',
      progress: 0,
      message: 'Click to start automatic deployment'
    });
    setDeploymentResult(null);
    setError(null);
  };

  const getResourceHintColor = (hint?: string) => {
    switch (hint) {
      case 'light': return 'bg-green-100 text-green-800';
      case 'heavy': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getResourceHintIcon = (hint?: string) => {
    switch (hint) {
      case 'light': return <Database className="h-3 w-3" />;
      case 'heavy': return <Server className="h-3 w-3" />;
      default: return <Network className="h-3 w-3" />;
    }
  };

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{template.display_name}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
        </div>
        <CardDescription className="text-sm text-gray-600">
          {template.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Template Details */}
        <div className="flex items-center gap-2">
          <Badge 
            className={cn("text-xs", getResourceHintColor(template.mcp_server_metadata?.resourceHint))}
          >
            {getResourceHintIcon(template.mcp_server_metadata?.resourceHint)}
            <span className="ml-1">
              {template.mcp_server_metadata?.resourceHint || 'medium'} resource
            </span>
          </Badge>
          {template.mcp_server_metadata?.version && (
            <Badge variant="secondary" className="text-xs">
              v{template.mcp_server_metadata.version}
            </Badge>
          )}
        </div>

        {/* Tags */}
        {template.mcp_server_metadata?.tags && template.mcp_server_metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.mcp_server_metadata.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.mcp_server_metadata.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.mcp_server_metadata.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Deployment Progress */}
        {deploymentState !== 'idle' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{deploymentProgress.step}</span>
              {deploymentState === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {deploymentState === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {['analyzing', 'selecting-droplet', 'deploying'].includes(deploymentState) && (
                <Clock className="h-4 w-4 text-blue-600 animate-spin" />
              )}
            </div>
            
            <Progress value={deploymentProgress.progress} className="h-2" />
            
            <p className="text-xs text-gray-600">
              {deploymentProgress.message}
            </p>
          </div>
        )}

        {/* Success Details */}
        {deploymentState === 'success' && deploymentResult && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Deployment Successful</span>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <p><strong>Server:</strong> {deploymentResult.serverName}</p>
              <p><strong>Status:</strong> {deploymentResult.status}</p>
              <p><strong>Deployed:</strong> {deploymentResult.deployedAt.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Error Details */}
        {deploymentState === 'error' && error && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Deployment Failed</span>
            </div>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {deploymentState === 'idle' && (
          <Button 
            onClick={handleOneClickDeploy} 
            className="w-full"
            size="lg"
          >
            <Zap className="h-4 w-4 mr-2" />
            Deploy Automatically
          </Button>
        )}
        
        {['analyzing', 'selecting-droplet', 'deploying'].includes(deploymentState) && (
          <Button 
            disabled 
            className="w-full"
            size="lg"
          >
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Deploying...
          </Button>
        )}
        
        {deploymentState === 'success' && (
          <Button 
            onClick={resetDeployment} 
            variant="outline"
            className="w-full"
            size="lg"
          >
            Deploy Another
          </Button>
        )}
        
        {deploymentState === 'error' && (
          <div className="flex gap-2 w-full">
            <Button 
              onClick={resetDeployment} 
              variant="outline"
              className="flex-1"
            >
              Reset
            </Button>
            <Button 
              onClick={handleOneClickDeploy} 
              className="flex-1"
            >
              Retry
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}; 