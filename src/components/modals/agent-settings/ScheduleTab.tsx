import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus, Clock, Play } from 'lucide-react';

// Import task management components (these would be the existing task components)
// import { TaskManagerModal } from '../TaskManagerModal';

interface ScheduleTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export function ScheduleTab({ agentId, agentData, onAgentUpdated }: ScheduleTabProps) {
  const [showTaskManager, setShowTaskManager] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Schedule & Tasks</h3>
        <p className="text-sm text-muted-foreground">
          Manage automated tasks and scheduling for your agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Task Management
          </CardTitle>
          <CardDescription>
            Create and manage automated tasks for your agent to execute on schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-dashed border-border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Automated Tasks</h4>
                <p className="text-sm text-muted-foreground">
                  Schedule one-time or recurring tasks for your agent
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowTaskManager(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg inline-block mb-3">
                  <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-medium mb-1">One-Time Tasks</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Schedule tasks to run at a specific date and time
                </p>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add One-Time Task
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg inline-block mb-3">
                  <Play className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-medium mb-1">Recurring Tasks</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Set up tasks that repeat on a schedule
                </p>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Recurring Task
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Task Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Multi-step workflows with context passing</li>
              <li>• Timezone-aware scheduling</li>
              <li>• Conversation integration for results</li>
              <li>• Automated execution via PostgreSQL cron</li>
              <li>• Comprehensive task management interface</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Task Manager Modal would be rendered here */}
      {/* {showTaskManager && (
        <TaskManagerModal
          isOpen={showTaskManager}
          onClose={() => setShowTaskManager(false)}
          agentId={agentId}
        />
      )} */}
    </div>
  );
}
