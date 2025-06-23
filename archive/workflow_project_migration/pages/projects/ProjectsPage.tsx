import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Users, ExternalLink, Building2, FolderOpen, Clock, CheckCircle, Grid3X3, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Define interfaces for better type safety
interface Profile {
  auth_user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  global_role: string | null;
}

interface ProjectMember {
  user_id: string;
  role: string;
  profiles?: Profile | null;
}

interface Client {
  id: string;
  name: string | null;
  business_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  industry: string | null;
}

interface Project {
  id: string;
  name: string;
  created_at: string | null;
  status: string;
  client_id: string;
  project_members: ProjectMember[] | null;
}

// Group clients with their projects
interface ClientProjectGroup {
  client: Client;
  projects: Project[];
  projectCount: number;
}

type ViewMode = 'grid' | 'list';

export const ProjectsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all clients first
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, business_name, contact_email, logo_url, industry')
          .order('business_name', { ascending: true });

        if (clientsError) throw clientsError;
        
        // Fetch all projects with their members
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            created_at,
            status,
            client_id,
            project_members (
              user_id,
              role
            )
          `)
          .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;

        // Get user profiles for project members
        const allUserIds = (projectsData || []).reduce((acc: string[], project) => {
          project.project_members?.forEach((member: any) => {
            if (member.user_id && !acc.includes(member.user_id)) {
              acc.push(member.user_id);
            }
          });
          return acc;
        }, []);

        const profilesMap: Map<string, Profile> = new Map();

        if (allUserIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('auth_user_id, email, global_role, full_name, avatar_url')
            .in('auth_user_id', allUserIds);

          if (profilesError) throw profilesError;
          
          profilesData?.forEach((profile) => {
            profilesMap.set(profile.auth_user_id, profile as Profile);
          });
        }

        // Augment projects with profile data
        const augmentedProjects: Project[] = (projectsData || []).map((project) => ({
          ...project,
          project_members: project.project_members?.map((member: any): ProjectMember => ({
            ...member,
            profiles: profilesMap.get(member.user_id) || null,
          })) || [],
        }));

        setClients(clientsData || []);
        setProjects(augmentedProjects);

      } catch (err: unknown) {
        console.error('Error fetching data:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on-hold':
      case 'paused': return 'outline';
      case 'cancelled': return 'destructive';
      case 'planning': return 'secondary';
      default: return 'outline';
    }
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const nameParts = name.split(' ');
    if (nameParts.length > 1 && nameParts[0] && nameParts[nameParts.length - 1]) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return nameParts[0]?.substring(0, 2).toUpperCase() || '?';
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'planning': return <FolderOpen className="h-4 w-4 text-orange-500" />;
      default: return <FolderOpen className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Create client groups with their projects
  const createClientGroups = (clients: Client[], projects: Project[]): ClientProjectGroup[] => {
    return clients.map(client => {
      const clientProjects = projects.filter(project => project.client_id === client.id);
      return {
        client,
        projects: clientProjects,
        projectCount: clientProjects.length
      };
    });
  };

  const renderGridView = (clientGroups: ClientProjectGroup[]) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {clientGroups.map((group) => (
        <Card key={group.client.id} className="group hover:shadow-md transition-all duration-200 hover:border-accent">
          <CardHeader className="space-y-4">
            {/* Client Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {group.client.logo_url ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={group.client.logo_url} alt={`${group.client.business_name || group.client.name} logo`} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                      {getInitials(group.client.business_name || group.client.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">
                    {group.client.business_name || group.client.name || 'Unnamed Client'}
                  </h3>
                  {group.client.industry && (
                    <p className="text-sm text-muted-foreground truncate">{group.client.industry}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Project Count Badge */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                {group.projectCount} project{group.projectCount !== 1 ? 's' : ''}
              </Badge>
              <Button variant="ghost" size="sm" asChild className="group-hover:bg-accent transition-colors">
                <Link to={`/clients/${group.client.id}?tab=projects`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Recent Projects Preview */}
            {group.projects.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Recent Projects</h4>
                <div className="space-y-2">
                  {group.projects.slice(0, 3).map((project) => (
                    <div key={project.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getStatusIcon(project.status)}
                        <span className="text-sm font-medium truncate">{project.name}</span>
                      </div>
                      <Badge variant={getStatusBadgeVariant(project.status)} className="text-xs ml-2">
                        {project.status}
                      </Badge>
                    </div>
                  ))}
                  {group.projects.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{group.projects.length - 3} more projects
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground">Click to create your first project</p>
              </div>
            )}

            {/* Action Button */}
            <Button asChild variant="outline" className="w-full">
              <Link to={`/clients/${group.client.id}?tab=projects`} className="flex items-center gap-2">
                <span>Manage Projects</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderListView = (clientGroups: ClientProjectGroup[]) => (
    <div className="space-y-4">
      {clientGroups.map((group) => (
        <Card key={group.client.id} className="hover:shadow-md transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {group.client.logo_url ? (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={group.client.logo_url} alt={`${group.client.business_name || group.client.name} logo`} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {getInitials(group.client.business_name || group.client.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">
                    {group.client.business_name || group.client.name || 'Unnamed Client'}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {group.client.industry && (
                      <span>{group.client.industry}</span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {group.projectCount} project{group.projectCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  {/* Project Status Summary */}
                  {group.projects.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Projects:</span>
                      {group.projects.slice(0, 5).map((project, index) => (
                        <div key={project.id} className="flex items-center gap-1">
                          {getStatusIcon(project.status)}
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {project.name}
                          </span>
                          {index < Math.min(group.projects.length - 1, 4) && (
                            <span className="text-muted-foreground">•</span>
                          )}
                        </div>
                      ))}
                      {group.projects.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{group.projects.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/clients/${group.client.id}?tab=projects`} className="flex items-center gap-2">
                    <span>Manage Projects</span>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header Skeleton */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground">Manage your client projects and team collaboration</p>
            </div>
          </div>
        </div>

        {/* Error Content */}
        <div className="container mx-auto px-6 py-8">
          <Alert variant="destructive">
            <AlertDescription>
              <p><strong>Error loading projects:</strong></p>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const clientGroups = createClientGroups(clients, projects);
  const totalProjects = projects.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section - Following flat design principles */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="space-y-4">
            {/* H1 heading as per design protocol */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground">
                Manage your client projects and team collaboration. Projects are now organized within each client for better context and enhanced features.
              </p>
            </div>

            {/* Stats Overview & View Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Clients:</span>
                  <span className="font-medium">{clients.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total Projects:</span>
                  <span className="font-medium">{totalProjects}</span>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Clients Grid/List - H2 section heading */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Clients & Projects</h2>
            
            {clients.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent className="space-y-4">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">No Clients Found</h3>
                    <p className="text-muted-foreground">Create your first client to start managing projects</p>
                  </div>
                  <Button asChild>
                    <Link to="/clients/new">
                      <Building2 className="h-4 w-4 mr-2" />
                      Create Your First Client
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              viewMode === 'grid' ? renderGridView(clientGroups) : renderListView(clientGroups)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};