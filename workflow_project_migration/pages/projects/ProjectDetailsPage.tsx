import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// import { Layout } from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { WorkflowPhase } from '../components/workflow/WorkflowPhase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownToLine, ChevronDown, ChevronUp, Edit, Users, Briefcase, Info, ExternalLink } from 'lucide-react';
import { MigrationNotice } from '@/components/ui/MigrationNotice';

// Define or import project phases - should match CreateProjectPage.tsx and DB constraint
const PROJECT_PHASES = [
  'Discovery',
  'research',
  'planning',
  'design',
  'development',
  'Quality Assurance',
  'Client Review',
  'Revision',
  'Go Live',
  'Complete'
];

// Interfaces matching those in ProjectsPage for consistency
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
  contact_phone: string | null;
}

interface RawSupabaseProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  status: string;
  current_phase: string;
  clients: Client | null;
  // project_members will be fetched separately
  // project_members: { user_id: string; role: string; }[] | null; 
  [key: string]: any; // Allow other project fields
}

interface Project extends Omit<RawSupabaseProject, 'project_members'> {
  project_members: ProjectMember[] | null;
}

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<any[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const workflowRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPhase, setUpdatingPhase] = useState(false); // For loading state of phase update
  const navigate = useNavigate();
  const [showMigrationNotice, setShowMigrationNotice] = useState(true);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!id || id === 'new') {
        setError(id === 'new' ? 'New projects must be saved before viewing details.' : 'Project ID is missing.');
        setLoading(false);
        setProject(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(`
            *,
            clients!inner (
              id,
              name,
              business_name,
              contact_email,
              contact_phone
            )
          `)
          .eq('id', id)
          .single();

        if (projectError) throw projectError;
        if (!projectData) {
          setError('Project not found.');
          setProject(null);
          setLoading(false);
          return;
        }

        const coreProjectData = projectData as Omit<RawSupabaseProject, 'project_members'>;
        let fetchedProjectMembers: { user_id: string; role: string; }[] = [];

        const { data: membersData, error: membersError } = await supabase
          .from('project_members')
          .select('user_id, role')
          .eq('project_id', id);

        if (membersError) throw membersError;
        if (membersData) fetchedProjectMembers = membersData;
        
        let augmentedProjectMembers: ProjectMember[] = [];
        if (fetchedProjectMembers.length > 0) {
          const memberUserIds = fetchedProjectMembers.map(m => m.user_id).filter(uid => uid);
          let profilesMap: Map<string, Profile> = new Map();

          if (memberUserIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('auth_user_id, email, global_role, full_name, avatar_url')
              .in('auth_user_id', memberUserIds);
            if (profilesError) throw profilesError;
            profilesData?.forEach((p: any) => profilesMap.set(p.auth_user_id, p as Profile));
          }
          augmentedProjectMembers = fetchedProjectMembers.map(member => ({
            ...member,
            profiles: profilesMap.get(member.user_id) || null,
          }));
        }
        
        const finalProject: Project = {
          ...coreProjectData,
          project_members: augmentedProjectMembers.length > 0 ? augmentedProjectMembers : null,
        };
        setProject(finalProject);

        if (finalProject.current_phase) {
            setExpandedPhases({ [finalProject.current_phase]: true });
        }

        const { data: stepsData, error: stepsError } = await supabase
          .from('workflow_steps')
          .select('*')
          .eq('project_id', id)
          .order('phase', { ascending: true })
          .order('step_number', { ascending: true });

        if (stepsError) throw stepsError;
        setWorkflowSteps(stepsData || []);

      } catch (err: any) {
        console.error('Error fetching project details:', err);
        setError(err.message || 'An unexpected error occurred');
        setProject(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProjectDetails();
  }, [id]);

  const getStatusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on-hold': case 'paused': return 'outline';
      case 'cancelled': return 'destructive';
      case 'planning': return 'default'; // Or a more specific color if a custom variant is made
      default: return 'secondary';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const variant = getStatusBadgeVariant(status);
    return <Badge variant={variant}>{status}</Badge>;
  };

  const handleStepComplete = async (stepId: string, finalOutput: any) => {
    if (!id || id === 'new') return;
    try {
      const { error: updateError } = await supabase
        .from('workflow_steps')
        .update({
          status: 'completed',
          final_output: finalOutput,
          completed_at: new Date().toISOString(),
        })
        .eq('id', stepId);

      if (updateError) throw updateError;

      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('project_id', id)
        .order('phase', { ascending: true })
        .order('step_number', { ascending: true });

      if (stepsError) throw stepsError;
      setWorkflowSteps(stepsData || []);

    } catch (error: any) {
      console.error('Error updating workflow step:', error);
      // Potentially set an error state for this specific action
    }
  };

  const scrollToWorkflow = () => workflowRef.current?.scrollIntoView({ behavior: 'smooth' });

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  const getPhaseSteps = (phase: string) => workflowSteps.filter(step => step.phase === phase);

  const handlePhaseChange = async (newPhase: string) => {
    if (!project || !project.id || project.current_phase === newPhase || updatingPhase) return;
    setUpdatingPhase(true);
    setError(null); // Clear previous errors

    try {
      const { data: updatedProjectData, error: updateError } = await supabase
        .from('projects')
        .update({ current_phase: newPhase, current_step: 1 }) // Reset step to 1
        .eq('id', project.id)
        .select('id, name, description, created_at, status, current_phase, clients!inner(id, name, business_name, contact_email, contact_phone), project_members(user_id, role)') // Reselect to get all data
        .single();

      if (updateError) throw updateError;
      
      // This is tricky because project_members needs re-augmentation. Simplified for now.
      // Ideally, re-fetch or re-augment members based on the new project data structure.
      const coreProjectData = updatedProjectData as Omit<RawSupabaseProject, 'project_members'>;
      const finalProject: Project = {
          ...coreProjectData,
          // Retain existing augmented members if possible, or re-fetch/re-augment
          project_members: project.project_members, 
        };
      setProject(finalProject);

      setExpandedPhases({ [newPhase]: true }); // Expand new phase
    } catch (err: any) {
      console.error('Error updating project phase:', err);
      setError(err.message || 'Failed to update phase.');
    } finally {
      setUpdatingPhase(false);
    }
  };
  
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const nameParts = name.split(' ');
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  const handleRedirectToClientDetails = () => {
    if (project?.clients?.id) {
      navigate(`/clients/${project.clients.id}?projectId=${project.id}`);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <p className="ml-2 text-foreground">Loading project details...</p>
        </div>
    );
  }

  if (error || !project) {
    return (
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || 'Project not found or ID is invalid.'}
              {updatingPhase && <p className="mt-2">Updating phase...</p>}
            </AlertDescription>
          </Alert>
        </div>
    );
  }

  return (
    <div className="p-8 bg-background text-foreground">
      {/* Migration Notice */}
      {showMigrationNotice && project?.clients?.id && (
        <div className="mb-6">
          <MigrationNotice
            title="🚀 Enhanced Project Management Available!"
            description={`This project has enhanced features available in the client details area, including stages, tasks, templates, and better project management tools.`}
            actionText="View in Enhanced Mode"
            actionLink={`/clients/${project.clients.id}?projectId=${project.id}`}
            variant="default"
          />
          <div className="flex justify-end mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowMigrationNotice(false)}
              className="text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Project Header */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row justify-between items-start pb-4">
          <div>
            <CardTitle className="text-2xl font-bold mb-2">{project.name}</CardTitle>
            <div className="flex items-center space-x-4 mb-4">
              {getStatusBadge(project.status)}
              <span className="text-sm text-muted-foreground">
                Current Phase: <span className="font-semibold text-foreground">{project.current_phase}</span>
              </span>
              {project.created_at && (
                <span className="text-sm text-muted-foreground">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Label htmlFor="phase-select" className="text-sm">Change Phase:</Label>
              <Select 
                value={project.current_phase} 
                onValueChange={handlePhaseChange} 
                disabled={updatingPhase}
              >
                <SelectTrigger id="phase-select" className="w-[200px]">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.map(phase => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updatingPhase && <p className="text-sm text-primary animate-pulse">Updating...</p>}
            </div>
          </div>
          <Button
            onClick={scrollToWorkflow}
            variant="default"
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Go to Workflow
          </Button>
        </CardHeader>

        <CardContent className="grid md:grid-cols-2 gap-6 pt-4">
          {project.clients && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Client Details</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="font-medium text-foreground">{project.clients.business_name || project.clients.name}</p>
                <p className="text-sm text-muted-foreground">Contact: {project.clients.name}</p>
                <p className="text-sm text-muted-foreground">{project.clients.contact_email}</p>
                {project.clients.contact_phone && (
                  <p className="text-sm text-muted-foreground">{project.clients.contact_phone}</p>
                )}
              </div>
            </div>
          )}

          {project.project_members && project.project_members.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Team Members</h3>
              <div className="bg-muted p-4 rounded-md">
                <div className="space-y-3">
                  {project.project_members.map((member: ProjectMember) => (
                    member.profiles && (
                      <div key={member.user_id} className="flex items-center space-x-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.profiles.avatar_url || undefined} alt={member.profiles.full_name || member.profiles.email || 'User avatar'} />
                          <AvatarFallback>
                            {getInitials(member.profiles.full_name || member.profiles.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{member.profiles.full_name || member.profiles.email}</p>
                          <p className="text-sm text-muted-foreground capitalize">Role: {member.role}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div ref={workflowRef} className="mt-8 space-y-4">
        <h2 className="text-xl font-bold mb-6 text-foreground">Website Development Workflow</h2>
        {error && !updatingPhase && (
            <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <div className="space-y-6">
          {PROJECT_PHASES.map(phase => (
            <WorkflowPhase
              key={phase}
              phase={phase}
              steps={getPhaseSteps(phase)} // This gets steps for *this specific phase string*
              isExpanded={!!expandedPhases[phase] || phase === project.current_phase} // Expand current phase too
              onToggle={() => togglePhase(phase)}
              onStepComplete={handleStepComplete}
              // Consider passing project.current_phase to highlight or disable past/future phases
            />
          ))}
        </div>
      </div>
    </div>
  );
};