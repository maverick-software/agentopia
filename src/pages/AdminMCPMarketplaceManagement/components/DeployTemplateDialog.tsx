import { Clock, Play, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminMCPTemplate, DropletSummary } from '../types';

interface DeployTemplateDialogProps {
  open: boolean;
  template: AdminMCPTemplate | null;
  droplets: DropletSummary[];
  selectedDropletId: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onDropletChange: (value: string) => void;
  onDeploy: () => void;
}

export function DeployTemplateDialog({
  open,
  template,
  droplets,
  selectedDropletId,
  loading,
  onOpenChange,
  onDropletChange,
  onDeploy,
}: DeployTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Deploy MCP Template</DialogTitle>
          <DialogDescription>Deploy "{template?.name}" to a DigitalOcean droplet</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {template && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">{template.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Category</p>
                    <p className="text-sm text-muted-foreground">{template.category}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Docker Image</p>
                    <p className="text-sm text-muted-foreground font-mono">{template.dockerImage}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Resource Requirements</p>
                    <p className="text-sm text-muted-foreground">
                      {template.resourceRequirements.memory} RAM, {template.resourceRequirements.cpu} CPU
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Target Droplet</CardTitle>
            </CardHeader>
            <CardContent>
              {droplets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active droplets available</p>
                </div>
              ) : (
                <Select value={selectedDropletId} onValueChange={onDropletChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a droplet" />
                  </SelectTrigger>
                  <SelectContent>
                    {droplets.map((droplet) => (
                      <SelectItem key={droplet.id} value={droplet.id}>
                        {droplet.name} ({droplet.region} • {droplet.size})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onDeploy} disabled={!selectedDropletId || loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Deploy to Droplet
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
