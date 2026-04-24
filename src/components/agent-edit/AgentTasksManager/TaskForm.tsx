import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScheduleSelector } from '../ScheduleSelector';
import { ToolSelector } from '../ToolSelector';
import { EVENT_TRIGGER_TYPES, TaskFormData } from './types';
import { canProceedToNext, getStepDescription, getStepTitle, TOTAL_STEPS } from './taskUtils';

interface TaskFormProps {
  agentId: string;
  formData: TaskFormData;
  currentStep: number;
  saving: boolean;
  isEditing: boolean;
  onChange: (value: TaskFormData) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSubmit: () => void;
}

export function TaskForm({
  agentId,
  formData,
  currentStep,
  saving,
  isEditing,
  onChange,
  onPrevStep,
  onNextStep,
  onSubmit,
}: TaskFormProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${i + 1 <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </div>
              {i < TOTAL_STEPS - 1 && <div className={`w-8 h-0.5 mx-2 ${i + 1 < currentStep ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">Step {currentStep} of {TOTAL_STEPS}</div>
      </div>

      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">{getStepTitle(currentStep, formData.task_type)}</h3>
        <p className="text-muted-foreground">{getStepDescription(currentStep, formData.task_type)}</p>
      </div>

      <div className="min-h-[300px]">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input id="task-name" value={formData.name} onChange={(e) => onChange({ ...formData, name: e.target.value })} placeholder="e.g., Daily Email Summary" className="text-lg" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-type">Task Type</Label>
              <Select value={formData.task_type} onValueChange={(value: 'scheduled' | 'event_based') => onChange({ ...formData, task_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled (Time-based)</SelectItem>
                  <SelectItem value="event_based">Event-based (Triggered)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-2">
            <Label htmlFor="task-description">What should this task do?</Label>
            <Textarea
              id="task-description"
              value={formData.description}
              onChange={(e) => onChange({ ...formData, description: e.target.value })}
              placeholder="Be specific about what you want the agent to accomplish..."
              rows={6}
              className="text-base"
              autoFocus
            />
          </div>
        )}

        {currentStep === 3 && (
          <>
            {formData.task_type === 'scheduled' ? (
              <ScheduleSelector
                cronExpression={formData.cron_expression}
                timezone={formData.timezone}
                onScheduleChange={(cronExpression, timezone) => onChange({ ...formData, cron_expression: cronExpression, timezone })}
                disabled={saving}
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="event-trigger">What should trigger this task?</Label>
                <Select value={formData.event_trigger_type} onValueChange={(value) => onChange({ ...formData, event_trigger_type: value })}>
                  <SelectTrigger><SelectValue placeholder="Choose what will trigger this task" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TRIGGER_TYPES.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        <div className="flex items-center gap-2"><trigger.icon className="h-4 w-4" />{trigger.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {currentStep === 4 && (
          <ToolSelector
            agentId={agentId}
            selectedTools={formData.selected_tools}
            onToolSelectionChange={(selectedTools) => onChange({ ...formData, selected_tools: selectedTools })}
            disabled={saving}
          />
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date (Optional)</Label>
                <Input id="start-date" type="date" value={formData.start_date} onChange={(e) => onChange({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date (Optional)</Label>
                <Input id="end-date" type="date" value={formData.end_date} onChange={(e) => onChange({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-executions">Max Executions (Optional)</Label>
              <Input
                id="max-executions"
                type="number"
                min="1"
                value={formData.max_executions || ''}
                onChange={(e) => onChange({ ...formData, max_executions: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                placeholder="Leave empty for unlimited"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onPrevStep} disabled={currentStep === 1 || saving}>Previous</Button>
        {currentStep < TOTAL_STEPS ? (
          <Button onClick={onNextStep} disabled={!canProceedToNext(currentStep, formData) || saving}>Next</Button>
        ) : (
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isEditing ? 'Updating...' : 'Creating...'}</> : isEditing ? 'Update Task' : 'Create Task'}
          </Button>
        )}
      </div>
    </div>
  );
}
