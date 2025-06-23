import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Folder, CheckCircle } from 'lucide-react';

interface Client {
  id: string;
  name: string | null;
  business_name: string | null;
  industry: string | null;
  logo_url: string | null;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
}

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
  template_id: string;
}

const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];

export const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const clientId = searchParams.get('clientId');
  
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    status: 'Planning',
    template_id: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // If no clientId, redirect to projects page
        if (!clientId) {
          navigate('/projects');
          return;
        }

        // Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, business_name, industry, logo_url')
          .eq('id', clientId)
          .single();

        if (clientError) {
          throw new Error('Client not found');
        }

        // Fetch project templates
        const { data: templatesData, error: templatesError } = await supabase
          .from('project_templates')
          .select('id, name, description')
          .eq('is_active', true)
          .order('name');

        if (templatesError) {
          console.warn('Could not fetch templates:', templatesError);
          setTemplates([]);
        } else {
          setTemplates(templatesData || []);
        }

        setClient(clientData);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId, navigate]);

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!client) {
      setError('Client information is missing');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        client_id: client.id,
        template_id: formData.template_id || null,
        created_by_user_id: user?.id || null,
        start_date: new Date().toISOString()
      };

      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Navigate back to client details with projects tab
      navigate(`/clients/${client.id}?tab=projects&projectId=${newProject.id}`);
      
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Create Project</h1>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/clients/${client?.id}?tab=projects`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </div>
          
          {client && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {client.logo_url ? (
                  <img 
                    src={client.logo_url} 
                    alt={`${client.business_name || client.name} logo`}
                    className="h-12 w-12 rounded-full object-contain bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Create New Project</h1>
                  <p className="text-muted-foreground">
                    for {client.business_name || client.name}
                    {client.industry && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {client.industry}
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Project Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter project name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the project goals and scope"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Project Template */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Project Template (Optional)</Label>
                    <Select
                      value={formData.template_id}
                      onValueChange={(value) => handleInputChange('template_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template or start from scratch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Start from scratch</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              {template.description && (
                                <div className="text-sm text-muted-foreground">{template.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Initial Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/clients/${client?.id}?tab=projects`)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="flex items-center gap-2">
                    {creating ? (
                      <>Creating...</>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Create Project
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}; 