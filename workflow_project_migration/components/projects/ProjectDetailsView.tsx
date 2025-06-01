import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, CheckCircle, Clock, AlertCircle, X } from "lucide-react";
import { projectService } from '@/services/projectService';
import type { ProjectWithDetails } from '@/services/projectService';

interface ProjectDetailsViewProps {
  projectId: string;
  onClose: () => void;
}

export const ProjectDetailsView: React.FC<ProjectDetailsViewProps> = ({ projectId, onClose }) => {
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        setLoading(true);
        const projectData = await projectService.getProjectById(projectId);
        setProject(projectData);
      } catch (err) {
        console.error('Error fetching project details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Completed': return 'secondary';
      case 'On Hold': return 'outline';
      case 'Planning': return 'destructive';
      default: return 'default';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'In Progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'To Do': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Loading Project Details...</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !project) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error || 'Project not found'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl">{project.name}</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={getStatusBadgeVariant(project.status || 'Active')}>
              {project.status || 'Active'}
            </Badge>
            {project.current_phase && (
              <Badge variant="outline">
                Phase: {project.current_phase}
              </Badge>
            )}
            {project.template_id && (
              <Badge variant="secondary">
                From Template
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Project Overview */}
        <div>
          {project.description && (
            <p className="text-gray-700 mb-4">{project.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Created:</span>
              <span>{formatDate(project.created_at)}</span>
            </div>
            {project.start_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Started:</span>
                <span>{formatDate(project.start_date)}</span>
              </div>
            )}
            {project.end_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Due:</span>
                <span>{formatDate(project.end_date)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Members:</span>
              <span>{project.project_members?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Project Stages and Tasks */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Project Stages & Tasks</h3>
          
          {!project.project_stages || project.project_stages.length === 0 ? (
            <p className="text-gray-500 italic">No stages defined for this project.</p>
          ) : (
            <div className="space-y-4">
              {project.project_stages.map((stage) => (
                <Card key={stage.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{stage.name}</h4>
                      <Badge variant="outline">
                        {stage.project_tasks?.length || 0} tasks
                      </Badge>
                    </div>
                    {stage.description && (
                      <p className="text-sm text-gray-600">{stage.description}</p>
                    )}
                  </CardHeader>
                  
                  {stage.project_tasks && stage.project_tasks.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {stage.project_tasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getTaskStatusIcon(task.status)}
                              <div>
                                <h5 className="font-medium">{task.name}</h5>
                                {task.description && (
                                  <p className="text-sm text-gray-600">{task.description}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              {task.priority && (
                                <span className={`font-medium ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="text-gray-500">
                                  Due: {formatDate(task.due_date)}
                                </span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {task.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Project Members */}
        {project.project_members && project.project_members.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Project Members</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.project_members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <span>User ID: {member.user_id}</span>
                  </div>
                  <Badge variant="secondary">
                    {member.role.replace('PROJECT_', '')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 