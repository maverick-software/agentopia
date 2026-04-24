import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OneClickMCPDeployment } from '@/components/mcp/OneClickMCPDeployment';
import type { AdminMCPTemplate } from '../types';

interface OneClickDeploymentDialogProps {
  open: boolean;
  template: AdminMCPTemplate | null;
  onOpenChange: (open: boolean) => void;
  onDeploymentComplete: (deployment: any) => void;
  onDeploymentError: (error: string) => void;
}

export function OneClickDeploymentDialog({
  open,
  template,
  onOpenChange,
  onDeploymentComplete,
  onDeploymentError,
}: OneClickDeploymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>One-Click Deployment</DialogTitle>
          <DialogDescription>Automatically deploy "{template?.name}" with intelligent droplet selection</DialogDescription>
        </DialogHeader>

        {template && (
          <OneClickMCPDeployment
            template={{
              id: template.id,
              tool_name: template.name,
              display_name: template.name,
              description: template.description,
              docker_image: template.dockerImage,
              category: template.category,
              mcp_server_metadata: {
                resourceHint: 'medium',
                version: template.version,
                author: template.author,
                tags: template.tags,
              },
            }}
            onDeploymentComplete={onDeploymentComplete}
            onDeploymentError={onDeploymentError}
            className="border-0 shadow-none p-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
