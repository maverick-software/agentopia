import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Eye, Shield, Users, Server, TrendingUp } from 'lucide-react';
import { mcpService } from '@/lib/services/mcpService';
import { MCPServerTemplate } from '@/lib/mcp/ui-types';

// Extend the MCPServerTemplate interface for admin view
interface AdminMCPTemplate extends MCPServerTemplate {
  totalDeployments: number;
  activeDeployments: number;
  isVerified: boolean; // Additional field for backwards compatibility
}

const AdminMCPMarketplaceManagement: React.FC = () => {
  const [templates, setTemplates] = useState<AdminMCPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminMCPTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Statistics
  const [stats, setStats] = useState({
    totalTemplates: 0,
    verifiedTemplates: 0,
    totalDeployments: 0,
    activeServers: 0
  });

  useEffect(() => {
    loadTemplates();
    loadStats();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const rawTemplates = await mcpService.getMarketplaceTemplates();
      
      // Transform MCPServerTemplate to AdminMCPTemplate with additional admin fields
      const adminTemplates: AdminMCPTemplate[] = rawTemplates.map(template => ({
        ...template,
        totalDeployments: Math.floor(Math.random() * 100) + 10, // Mock data
        activeDeployments: Math.floor(Math.random() * 50) + 5, // Mock data
        isVerified: template.verified // Copy for compatibility
      }));
      
      setTemplates(adminTemplates);
    } catch (error) {
      console.error('Failed to load marketplace templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Calculate stats from templates
      const rawTemplates = await mcpService.getMarketplaceTemplates();
      const totalTemplates = rawTemplates.length;
      const verifiedTemplates = rawTemplates.filter(t => t.verified).length;
      
      // Mock deployment stats
      const totalDeployments = Math.floor(Math.random() * 1000) + 500;
      const activeServers = Math.floor(Math.random() * 200) + 100;

      setStats({
        totalTemplates,
        verifiedTemplates,
        totalDeployments,
        activeServers
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const toggleVerification = async (templateId: string, isVerified: boolean) => {
    try {
      // In a real implementation, this would call an admin API
      // For now, we'll update locally
      setTemplates(prev =>
        prev.map(t =>
          t.id === templateId ? { ...t, isVerified: !isVerified, verified: !isVerified } : t
        )
      );
      await loadStats();
    } catch (error) {
      console.error('Failed to toggle verification:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      // In a real implementation, this would call an admin API
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      await loadStats();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Marketplace Management</h1>
          <p className="text-muted-foreground">
            Manage MCP server templates and monitor marketplace activity
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTemplates}</div>
            <p className="text-xs text-muted-foreground">
              Available in marketplace
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Templates</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedTemplates}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTemplates > 0 ? Math.round((stats.verifiedTemplates / stats.totalTemplates) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeployments}</div>
            <p className="text-xs text-muted-foreground">
              All time deployments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Servers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeServers}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.isVerified && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <Shield className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      <Badge variant="secondary">{template.category}</Badge>
                      <Badge variant="outline">v{template.version}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {template.description}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Deployments: {template.totalDeployments}</span>
                      <span>Active: {template.activeDeployments}</span>
                      <span>Rating: {template.rating.average.toFixed(1)}/5 ({template.rating.count})</span>
                      <span>Author: {template.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVerification(template.id, template.isVerified)}
                    >
                      <Shield className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found matching your criteria
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Details Dialog */}
      {selectedTemplate && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template Details: {selectedTemplate.name}</DialogTitle>
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
                    <Input value={selectedTemplate.name} readOnly />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={selectedTemplate.description} readOnly />
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input value={selectedTemplate.version} readOnly />
                  </div>
                  <div>
                    <Label>Author</Label>
                    <Input value={selectedTemplate.author} readOnly />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={selectedTemplate.category} readOnly />
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Required Capabilities</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.requiredCapabilities.map((cap: string, index: number) => (
                        <Badge key={index} variant="outline">{cap}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="config">
                <div className="space-y-4">
                  <div>
                    <Label>Docker Image</Label>
                    <Input value={selectedTemplate.dockerImage} readOnly />
                  </div>
                  <div>
                    <Label>Documentation</Label>
                    <Input value={selectedTemplate.documentation} readOnly />
                  </div>
                  <div>
                    <Label>Source Code</Label>
                    <Input value={selectedTemplate.sourceCode || 'N/A'} readOnly />
                  </div>
                  <div>
                    <Label>Supported Transports</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.supportedTransports.map((transport: string, index: number) => (
                        <Badge key={index} variant="outline">{transport}</Badge>
                      ))}
                    </div>
                  </div>
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
                          <span className="font-semibold">{selectedTemplate.totalDeployments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Deployments:</span>
                          <span className="font-semibold">{selectedTemplate.activeDeployments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Downloads:</span>
                          <span className="font-semibold">{selectedTemplate.downloads}</span>
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
                          <span className="font-semibold">{selectedTemplate.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Verified:</span>
                          <span className="font-semibold">
                            {selectedTemplate.verified ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Author:</span>
                          <span className="font-semibold">{selectedTemplate.author}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rating:</span>
                          <span className="font-semibold">
                            {selectedTemplate.rating.average.toFixed(1)}/5 ({selectedTemplate.rating.count})
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminMCPMarketplaceManagement; 