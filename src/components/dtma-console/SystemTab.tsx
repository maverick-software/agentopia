import React from 'react';
import { CheckCircle, Network, Power, RefreshCw, RotateCcw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemTabProps {
  dropletIp: string;
  isRedeploying: boolean;
  isLoading: boolean;
  restartDTMA: () => Promise<void>;
  redeployDTMA: () => Promise<void>;
  checkDTMAStatus: () => Promise<void>;
}

export const SystemTab: React.FC<SystemTabProps> = ({
  dropletIp,
  isRedeploying,
  isLoading,
  restartDTMA,
  redeployDTMA,
  checkDTMAStatus,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>DTMA service management actions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={restartDTMA} disabled={isRedeploying} className="w-full" variant="outline">
          <Power className="h-4 w-4 mr-2" />
          {isRedeploying ? 'Restarting...' : 'Restart DTMA Service'}
        </Button>
        <Button onClick={redeployDTMA} disabled={isRedeploying} className="w-full" variant="outline">
          <RotateCcw className="h-4 w-4 mr-2" />
          {isRedeploying ? 'Redeploying...' : 'Redeploy DTMA Service'}
        </Button>
        <Button onClick={checkDTMAStatus} disabled={isLoading} className="w-full" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Network Info</CardTitle>
        <CardDescription>Connection details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2">
          <Network className="h-4 w-4 text-blue-500" />
          <span className="text-sm">
            <span className="font-medium">Endpoint:</span> {dropletIp}:30000
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4 text-green-500" />
          <span className="text-sm">
            <span className="font-medium">Protocol:</span> HTTP
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-purple-500" />
          <span className="text-sm">
            <span className="font-medium">Auth:</span> Bearer Token
          </span>
        </div>
      </CardContent>
    </Card>
  </div>
);
