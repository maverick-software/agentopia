import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AdminMCPTemplate } from '../types';

interface TemplateDetailsDialogProps {
  template: AdminMCPTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDetailsDialog({ template, open, onOpenChange }: TemplateDetailsDialogProps) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Details: {template.name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label>Name</Label>
                <Input value={template.name} readOnly />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={template.description} readOnly />
              </div>
              <div>
                <Label>Version</Label>
                <Input value={template.version} readOnly />
              </div>
              <div>
                <Label>Author</Label>
                <Input value={template.author} readOnly />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={template.category} readOnly />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {template.tags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="config" className="space-y-4">
            <div>
              <Label>Docker Image</Label>
              <Input value={template.dockerImage} readOnly />
            </div>
            <div>
              <Label>Documentation</Label>
              <Input value={template.documentation} readOnly />
            </div>
            <div>
              <Label>Source Code</Label>
              <Input value={template.sourceCode || 'N/A'} readOnly />
            </div>
          </TabsContent>
          <TabsContent value="stats">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Deployment Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Deployments:</span>
                      <span className="font-semibold">{template.totalDeployments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Deployments:</span>
                      <span className="font-semibold">{template.activeDeployments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Downloads:</span>
                      <span className="font-semibold">{template.downloads}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Template Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Version:</span>
                      <span className="font-semibold">{template.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Verified:</span>
                      <span className="font-semibold">{template.verified ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Author:</span>
                      <span className="font-semibold">{template.author}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
