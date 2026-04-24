import React from 'react';
import { Container } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DTMAStatus } from './types';
import { getStatusColor } from './utils';

export const ContainersTab: React.FC<{ dtmaStatus: DTMAStatus | null }> = ({ dtmaStatus }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <Container className="h-5 w-5" />
        <span>Running Containers</span>
      </CardTitle>
      <CardDescription>Docker containers managed by DTMA</CardDescription>
    </CardHeader>
    <CardContent>
      {dtmaStatus?.tool_instances && dtmaStatus.tool_instances.length > 0 ? (
        <div className="space-y-4">
          {dtmaStatus.tool_instances.map((instance, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{instance.instance_name_on_toolbox}</h4>
                <Badge className={getStatusColor(instance.status)}>{instance.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Image:</span> {instance.image}
                </p>
                <p>
                  <span className="font-medium">Container ID:</span> {instance.container_id.substring(0, 12)}...
                </p>
                <p>
                  <span className="font-medium">Created:</span> {new Date(instance.created * 1000).toLocaleString()}
                </p>
                {instance.ports.length > 0 && (
                  <div>
                    <span className="font-medium">Ports:</span>
                    <div className="ml-2">
                      {instance.ports.map((port, portIndex) => (
                        <div key={portIndex} className="text-xs">
                          {port.private_port}
                          {port.public_port ? ` → ${port.public_port}` : ''} ({port.type})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">No containers found</div>
      )}
    </CardContent>
  </Card>
);
