import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Target,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  FileText,
  Zap,
  Star,
  Archive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'completed';
  schedule?: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: 'active' | 'on_hold' | 'completed';
  next_action: string;
  created_at: string;
}

const SAMPLE_TASKS: Task[] = [
  {
    id: '1',
    title: 'Weekly marketing report',
    description: 'Compile and send marketing metrics every Friday by 3 PM',
    priority: 'high',
    status: 'active',
    schedule: 'Every Friday at 3:00 PM',
    created_at: '2024-01-15'
  },
  {
    id: '2',
    title: 'Customer support follow-up',
    description: 'Check unresolved tickets daily and escalate if needed',
    priority: 'medium',
    status: 'active',
    schedule: 'Daily at 9:00 AM',
    created_at: '2024-01-20'
  }
];

const SAMPLE_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Q4 Campaign Launch',
    description: 'Complete marketing campaign for Q4 product launch',
    progress: 60,
    status: 'active',
    next_action: 'Review creative assets and finalize messaging',
    created_at: '2024-01-10'
  },
  {
    id: '2',
    name: 'Sales Process Optimization',
    description: 'Analyze and improve the current sales funnel',
    progress: 25,
    status: 'active',
    next_action: 'Analyze conversion data from past quarter',
    created_at: '2024-01-25'
  }
];

export function TasksModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: TasksModalProps) {
  const { user } = useAuth();
  
  // State
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  
  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskSchedule, setNewTaskSchedule] = useState('');
  
  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectNextAction, setNewProjectNextAction] = useState('');

  // Initialize from agent data
  useEffect(() => {
    if (isOpen && agentData) {
      // Load existing tasks and projects
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      priority: newTaskPriority,
      status: 'active',
      schedule: newTaskSchedule.trim() || undefined,
      created_at: new Date().toISOString().split('T')[0]
    };
    
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setNewTaskSchedule('');
    setShowNewTaskForm(false);
    
    toast.success('Task added! 📝');
  }, [newTaskTitle, newTaskDescription, newTaskPriority, newTaskSchedule]);

  const handleAddProject = useCallback(() => {
    if (!newProjectName.trim()) return;
    
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      progress: 0,
      status: 'active',
      next_action: newProjectNextAction.trim(),
      created_at: new Date().toISOString().split('T')[0]
    };
    
    setProjects(prev => [...prev, newProject]);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectNextAction('');
    setShowNewProjectForm(false);
    
    toast.success('Project added! 🚀');
  }, [newProjectName, newProjectDescription, newProjectNextAction]);

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: task.status === 'active' ? 'paused' : 'active' }
        : task
    ));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    toast.success('Task removed');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(project => project.id !== projectId));
    toast.success('Project removed');
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      // Save tasks and projects
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Goals and tasks updated! 🎯');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated) {
        onAgentUpdated({ tasks, projects });
      }
      
    } catch (error: any) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to update goals and tasks');
    } finally {
      setLoading(false);
    }
  }, [agentId, tasks, projects, user, onAgentUpdated]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      case 'low': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <Check className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const hasChanges = () => {
    return true; // For now, always allow saving
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🎯 Tasks
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage my ongoing responsibilities and project goals.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Ongoing Responsibilities */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">My ongoing responsibilities</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewTaskForm(true)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </Button>
            </div>

            {/* New Task Form */}
            {showNewTaskForm && (
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <h4 className="font-medium text-sm">Add New Responsibility</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Task title (e.g., Daily customer check-ins)"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description and any specific requirements..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Priority</label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                        className="w-full mt-1 p-2 border rounded-md text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Schedule (optional)</label>
                      <Input
                        placeholder="e.g., Daily at 9 AM"
                        value={newTaskSchedule}
                        onChange={(e) => setNewTaskSchedule(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAddTask} size="sm" disabled={!newTaskTitle.trim()}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Task
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowNewTaskForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border transition-all ${
                    task.status === 'active'
                      ? 'border-border bg-card'
                      : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(task.status)}
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge className={`text-xs px-2 py-0.5 ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      {task.schedule && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{task.schedule}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleTaskStatus(task.id)}
                        className="h-8 w-8 p-0"
                      >
                        {task.status === 'active' ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {tasks.length === 0 && !showNewTaskForm && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No ongoing responsibilities yet</p>
                <p className="text-sm text-muted-foreground">Add tasks I should handle regularly</p>
              </div>
            )}
          </div>

          {/* Current Projects */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Current projects we're working on</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewProjectForm(true)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Project
              </Button>
            </div>

            {/* New Project Form */}
            {showNewProjectForm && (
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <h4 className="font-medium text-sm">Add New Project</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Project name (e.g., Website Redesign)"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Project description and goals..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                  <Input
                    placeholder="Next action or milestone..."
                    value={newProjectNextAction}
                    onChange={(e) => setNewProjectNextAction(e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <Button onClick={handleAddProject} size="sm" disabled={!newProjectName.trim()}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Project
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowNewProjectForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Project List */}
            <div className="space-y-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-sm">{project.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {project.progress}% complete
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{project.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Next Action */}
                  <div className="flex items-start space-x-2 text-xs">
                    <Zap className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Next: </span>
                      <span className="text-muted-foreground">{project.next_action}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {projects.length === 0 && !showNewProjectForm && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No active projects yet</p>
                <p className="text-sm text-muted-foreground">Add projects we're collaborating on</p>
              </div>
            )}
          </div>

          {/* Summary */}
          {(tasks.length > 0 || projects.length > 0) && (
            <div className="p-4 bg-muted/50 rounded-lg border border-muted">
              <div className="text-sm font-medium mb-2 flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Responsibilities summary:
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Managing {tasks.filter(t => t.status === 'active').length} active task{tasks.filter(t => t.status === 'active').length !== 1 ? 's' : ''}</li>
                <li>• Working on {projects.filter(p => p.status === 'active').length} active project{projects.filter(p => p.status === 'active').length !== 1 ? 's' : ''}</li>
                {tasks.some(t => t.schedule) && (
                  <li>• {tasks.filter(t => t.schedule).length} scheduled responsibilities</li>
                )}
                {tasks.some(t => t.priority === 'high') && (
                  <li>• {tasks.filter(t => t.priority === 'high').length} high-priority task{tasks.filter(t => t.priority === 'high').length !== 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className="min-w-[120px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Update Tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}