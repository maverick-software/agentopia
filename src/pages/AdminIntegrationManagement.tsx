import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Globe, 
  Database, 
  Shield, 
  MessageSquare, 
  Cloud, 
  Zap, 
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  status: 'available' | 'beta' | 'coming_soon' | 'deprecated';
  agent_classification: 'tool' | 'channel';
  is_popular: boolean;
  documentation_url: string | null;
  configuration_schema: Record<string, any>;
  display_order: number;
  is_active: boolean;
  category_id: string;
  category_name?: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationCategory {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
}

const statusOptions = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'beta', label: 'Beta', color: 'bg-blue-500' },
  { value: 'coming_soon', label: 'Coming Soon', color: 'bg-yellow-500' },
  { value: 'deprecated', label: 'Deprecated', color: 'bg-red-500' }
];

const iconOptions = [
  { value: 'Globe', label: 'Globe', icon: Globe },
  { value: 'Database', label: 'Database', icon: Database },
  { value: 'Shield', label: 'Shield', icon: Shield },
  { value: 'MessageSquare', label: 'Message Square', icon: MessageSquare },
  { value: 'Cloud', label: 'Cloud', icon: Cloud },
  { value: 'Zap', label: 'Zap', icon: Zap },
  { value: 'Settings', label: 'Settings', icon: Settings },
  { value: 'ExternalLink', label: 'External Link', icon: ExternalLink }
];

export function AdminIntegrationManagement() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [categories, setCategories] = useState<IntegrationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState('all');
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon_name: 'Globe',
    status: 'available' as 'available' | 'beta' | 'coming_soon' | 'deprecated',
    agent_classification: 'tool' as 'tool' | 'channel',
    is_popular: false,
    documentation_url: '',
    configuration_schema: '{}',
    display_order: 0,
    is_active: true,
    category_id: ''
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIntegrations();
    fetchCategories();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select(`
          *,
          integration_categories(name)
        `)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const formattedData = data.map(item => ({
        ...item,
        category_name: item.integration_categories?.name || 'Unknown'
      }));

      setIntegrations(formattedData);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.category_id) {
      toast.error('Name and category are required');
      return;
    }

    try {
      setSaving(true);
      
      let configSchema = {};
      if (formData.configuration_schema.trim()) {
        try {
          configSchema = JSON.parse(formData.configuration_schema);
        } catch (error) {
          toast.error('Invalid JSON in configuration schema');
          return;
        }
      }

      const integrationData = {
        ...formData,
        configuration_schema: configSchema,
        documentation_url: formData.documentation_url || null
      };

      let result;
      if (selectedIntegration) {
        // Update existing integration using admin edge function
        const { data: functionResult, error: functionError } = await supabase.functions.invoke(
          'admin-update-integration',
          {
            body: {
              integrationId: selectedIntegration.id,
              updateData: integrationData
            }
          }
        );
        
        if (functionError) throw functionError;
        if (!functionResult?.success) throw new Error(functionResult?.error || 'Update failed');
        
        result = { data: [functionResult.data] };
      } else {
        // Create new integration
        result = await supabase
          .from('integrations')
          .insert([integrationData])
          .select()
          .single();
          
        if (result.error) throw result.error;
      }

      toast.success(selectedIntegration ? 'Integration updated successfully' : 'Integration created successfully');
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (integration: Integration) => {
    setSelectedIntegration(integration);
    setFormData({
      name: integration.name,
      description: integration.description,
      icon_name: integration.icon_name,
      status: integration.status,
      agent_classification: integration.agent_classification,
      is_popular: integration.is_popular,
      documentation_url: integration.documentation_url || '',
      configuration_schema: JSON.stringify(integration.configuration_schema, null, 2),
      display_order: integration.display_order,
      is_active: integration.is_active,
      category_id: integration.category_id
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedIntegration) return;

    try {
      // Delete integration using admin edge function
      const { data: functionResult, error: functionError } = await supabase.functions.invoke(
        'admin-update-integration',
        {
          body: {
            integrationId: selectedIntegration.id,
            operation: 'delete'
          }
        }
      );
      
      if (functionError) throw functionError;
      if (!functionResult?.success) throw new Error(functionResult?.error || 'Delete failed');

      toast.success('Integration deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedIntegration(null);
      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error('Failed to delete integration');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon_name: 'Globe',
      status: 'available' as 'available' | 'beta' | 'coming_soon' | 'deprecated',
      agent_classification: 'tool' as 'tool' | 'channel',
      is_popular: false,
      documentation_url: '',
      configuration_schema: '{}',
      display_order: 0,
      is_active: true,
      category_id: ''
    });
    setSelectedIntegration(null);
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return (
      <Badge className={`${option?.color}/20 text-white border-${option?.color}/30`}>
        {option?.label}
      </Badge>
    );
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconOptions.find(opt => opt.value === iconName)?.icon || Settings;
    return <IconComponent className="h-4 w-4" />;
  };

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || integration.status === statusFilter;
    const matchesClassification = classificationFilter === 'all' || integration.agent_classification === classificationFilter;
    
    return matchesSearch && matchesStatus && matchesClassification;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integration Management</h1>
          <p className="text-gray-400">Manage integration definitions and categories</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Integration</DialogTitle>
              <DialogDescription>
                Create a new integration definition for users to connect to.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Select value={formData.icon_name} onValueChange={(value) => setFormData(prev => ({ ...prev, icon_name: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="classification">Classification</Label>
                  <Select value={formData.agent_classification} onValueChange={(value: any) => setFormData(prev => ({ ...prev, agent_classification: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="channel">Channel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentation_url">Documentation URL</Label>
                  <Input
                    id="documentation_url"
                    type="url"
                    value={formData.documentation_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, documentation_url: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_popular"
                    checked={formData.is_popular}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_popular: checked }))}
                  />
                  <Label htmlFor="is_popular">Popular</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="configuration_schema">Configuration Schema (JSON)</Label>
                <Textarea
                  id="configuration_schema"
                  value={formData.configuration_schema}
                  onChange={(e) => setFormData(prev => ({ ...prev, configuration_schema: e.target.value }))}
                  rows={4}
                  placeholder='{"api_key": {"type": "string", "required": true}}'
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Integration'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classificationFilter} onValueChange={setClassificationFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            <SelectItem value="tool">Tools</SelectItem>
            <SelectItem value="channel">Channels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Integrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations ({filteredIntegrations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredIntegrations.map(integration => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/5"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-800 rounded">
                    {getIcon(integration.icon_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{integration.name}</h3>
                      {getStatusBadge(integration.status)}
                      <Badge variant={integration.agent_classification === 'tool' ? 'default' : 'secondary'}>
                        {integration.agent_classification}
                      </Badge>
                      {integration.is_popular && (
                        <Badge variant="outline">Popular</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{integration.description}</p>
                    <p className="text-xs text-gray-500">
                      Category: {integration.category_name} • Order: {integration.display_order}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(integration)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedIntegration(integration);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredIntegrations.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No integrations found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Integration</DialogTitle>
            <DialogDescription>
              Update the integration definition.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Same form fields as Add dialog */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_name">Name</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_category">Category</Label>
                <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit_icon">Icon</Label>
                <Select value={formData.icon_name} onValueChange={(value) => setFormData(prev => ({ ...prev, icon_name: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_status">Status</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_classification">Classification</Label>
                <Select value={formData.agent_classification} onValueChange={(value: any) => setFormData(prev => ({ ...prev, agent_classification: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_documentation_url">Documentation URL</Label>
                <Input
                  id="edit_documentation_url"
                  type="url"
                  value={formData.documentation_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentation_url: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit_display_order">Display Order</Label>
                <Input
                  id="edit_display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_popular"
                  checked={formData.is_popular}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_popular: checked }))}
                />
                <Label htmlFor="edit_is_popular">Popular</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_configuration_schema">Configuration Schema (JSON)</Label>
              <Textarea
                id="edit_configuration_schema"
                value={formData.configuration_schema}
                onChange={(e) => setFormData(prev => ({ ...prev, configuration_schema: e.target.value }))}
                rows={4}
                placeholder='{"api_key": {"type": "string", "required": true}}'
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Update Integration'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedIntegration?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 