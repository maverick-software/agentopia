import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StepManager } from '../task-steps/StepManager';
import { ArrowLeft, ArrowRight, Calendar, Clock, Edit3, Hash, Lightbulb, MessageCircle, RotateCcw, Save, Tag, Target, Wand2, X, Zap } from 'lucide-react';
import { EveryUnit, ScheduleMode, TaskWizardEditingTask } from './types';
import { TaskStep } from '@/types/tasks';

declare global {
  interface Window {
    __agentopiaConversations?: Array<{ conversation_id: string; title?: string }>;
  }
}

interface TaskWizardBodyProps {
  currentStep: number;
  scheduleMode: ScheduleMode;
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  everyInterval: number;
  everyUnit: EveryUnit;
  selectedTimezone: string;
  targetConversationId: string;
  newTaskTitle: string;
  taskSteps: TaskStep[];
  editingTask?: TaskWizardEditingTask | null;
  agentId: string;
  agentName?: string;
  loading: boolean;
  getSupportedTimezones: () => string[];
  formatTimezoneLabel: (timezone: string) => string;
  setScheduleMode: (mode: ScheduleMode) => void;
  setOneTimeDate: (value: string) => void;
  setOneTimeTime: (value: string) => void;
  setRecurringStartDate: (value: string) => void;
  setRecurringEndDate: (value: string) => void;
  setRecurringTime: (value: string) => void;
  setEveryInterval: (value: number) => void;
  setEveryUnit: (value: EveryUnit) => void;
  setSelectedTimezone: (value: string) => void;
  setTaskSteps: React.Dispatch<React.SetStateAction<TaskStep[]>>;
  setStepsValid: React.Dispatch<React.SetStateAction<boolean>>;
  setNewTaskTitle: (value: string) => void;
  setTargetConversationId: (value: string) => void;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSaveTask: () => void;
}

export function TaskWizardBody(props: TaskWizardBodyProps) {
  const {
    currentStep,
    scheduleMode,
    oneTimeDate,
    oneTimeTime,
    recurringStartDate,
    recurringEndDate,
    recurringTime,
    everyInterval,
    everyUnit,
    selectedTimezone,
    targetConversationId,
    newTaskTitle,
    taskSteps,
    editingTask,
    agentId,
    agentName,
    loading,
    getSupportedTimezones,
    formatTimezoneLabel,
    setScheduleMode,
    setOneTimeDate,
    setOneTimeTime,
    setRecurringStartDate,
    setRecurringEndDate,
    setRecurringTime,
    setEveryInterval,
    setEveryUnit,
    setSelectedTimezone,
    setTaskSteps,
    setStepsValid,
    setNewTaskTitle,
    setTargetConversationId,
    onCancel,
    onBack,
    onNext,
    onSaveTask,
  } = props;

  const totalSteps = scheduleMode === 'recurring' ? 6 : 5;
  const isLastStep = currentStep === totalSteps;
  const steps = [
    { num: 1, label: 'Type', icon: Zap, color: 'text-blue-600 dark:text-blue-400' },
    { num: 2, label: 'Schedule', icon: Calendar, color: 'text-blue-600 dark:text-blue-400' },
    ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: RotateCcw, color: 'text-blue-600 dark:text-blue-400' }] : []),
    { num: 4, label: 'Instructions', icon: Wand2, color: 'text-blue-600 dark:text-blue-400' },
    { num: 5, label: 'Title', icon: Tag, color: 'text-blue-600 dark:text-blue-400' },
    { num: 6, label: 'Conversation', icon: MessageCircle, color: 'text-cyan-600 dark:text-cyan-400' },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl bg-background border border-border">
      <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white dark:from-muted dark:to-muted dark:text-foreground rounded-t-xl">
        <h4 className="font-semibold text-lg flex items-center">
          <Wand2 className="w-5 h-5 mr-2" /> {editingTask ? 'Edit Task' : 'Schedule Task'}
        </h4>
        <p className="text-blue-100 dark:text-muted-foreground text-sm mt-1">Create automated tasks for your agent</p>
      </div>

      <div className="px-6 py-3 bg-muted/50">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const adjustedStepNum = scheduleMode === 'recurring' ? step.num : (step.num > 3 ? step.num - 1 : step.num);
            const isActive = currentStep === adjustedStepNum;
            const isCompleted = currentStep > adjustedStepNum;
            return (
              <div key={step.num} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${isActive ? `${step.color} bg-background border-current shadow-lg scale-110` : isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'bg-muted border-border text-muted-foreground'}`}>
                  {isCompleted ? <span className="text-sm">✓</span> : <step.icon className="w-4 h-4" />}
                </div>
                <div className="ml-2">
                  <div className={`text-xs font-medium ${isActive ? step.color : isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>{step.label}</div>
                </div>
                {index < steps.length - 1 && <div className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-blue-500' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 space-y-4 bg-background">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-2">Choose Your Task Type</h3>
              <p className="text-sm text-muted-foreground">Select whether this task runs once or repeats on a schedule</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setScheduleMode('one_time')} className={`group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${scheduleMode === 'one_time' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg' : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-600'}`}>
                <div className="text-center"><Zap className="w-8 h-8 mx-auto text-blue-500 mb-3" /><h4 className="font-semibold text-foreground mb-2">One-time</h4><p className="text-xs text-muted-foreground">Run once at a specific time</p></div>
              </button>
              <button onClick={() => setScheduleMode('recurring')} className={`group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${scheduleMode === 'recurring' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg' : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-600'}`}>
                <div className="text-center"><RotateCcw className="w-8 h-8 mx-auto text-blue-500 mb-3" /><h4 className="font-semibold text-foreground mb-2">Recurring</h4><p className="text-xs text-muted-foreground">Repeat on a schedule</p></div>
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-center"><Calendar className="w-5 h-5 mr-2" />Set Your Schedule</h3>
            </div>
            <div className="bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input type="date" value={scheduleMode === 'one_time' ? oneTimeDate : recurringStartDate} onChange={(e) => (scheduleMode === 'one_time' ? setOneTimeDate : setRecurringStartDate)(e.target.value)} />
                {scheduleMode === 'recurring' && <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input type="time" value={scheduleMode === 'one_time' ? oneTimeTime : recurringTime} onChange={(e) => (scheduleMode === 'one_time' ? setOneTimeTime : setRecurringTime)(e.target.value)} />
                <select value={selectedTimezone} onChange={(e) => setSelectedTimezone(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-background text-foreground">
                  {getSupportedTimezones().map((tz) => (
                    <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && scheduleMode === 'recurring' && (
          <div className="bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400 mb-2"><Hash className="w-4 h-4 mr-2" />Every</label>
                <Input type="number" min={1} value={everyInterval} onChange={(e) => setEveryInterval(Math.max(1, parseInt(e.target.value || '1', 10)))} />
              </div>
              <div className="col-span-2">
                <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400 mb-2"><Clock className="w-4 h-4 mr-2" />Time unit</label>
                <select value={everyUnit} onChange={(e) => setEveryUnit(e.target.value as EveryUnit)} className="w-full p-2 border rounded-lg text-sm bg-background text-foreground">
                  <option value="minute">Minute(s)</option><option value="hour">Hour(s)</option><option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-blue-200 dark:border-blue-800"><p className="text-xs text-blue-700 dark:text-blue-400 flex items-center"><Lightbulb className="w-3 h-3 mr-2" />For weeks and years, intervals greater than 1 are approximated due to cron limits.</p></div>
          </div>
        )}

        {currentStep === 4 && (
          <StepManager
            taskId={editingTask?.id}
            agentId={agentId}
            agentName={agentName}
            initialSteps={taskSteps}
            onStepsChange={setTaskSteps}
            onValidationChange={setStepsValid}
            isEditing={!!editingTask}
            className="bg-card rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-4"
          />
        )}

        {currentStep === 5 && (
          <div className="bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
            <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400 mb-3"><Edit3 className="w-4 h-4 mr-2" />Task Title</label>
            <Input placeholder="e.g., Daily Market Research" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center"><Lightbulb className="w-3 h-3 mr-2" />Choose a title that makes it easy to identify this task later</p>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="bg-card rounded-xl p-6 border border-cyan-200 dark:border-cyan-800 shadow-sm">
            <label className="flex items-center text-sm font-medium text-cyan-700 dark:text-cyan-400 mb-3"><MessageCircle className="w-4 h-4 mr-2" />Conversation destination</label>
            <select value={targetConversationId} onChange={(e) => setTargetConversationId(e.target.value)} className="w-full p-3 border border-cyan-300 dark:border-cyan-700 rounded-lg text-sm bg-background text-foreground">
              <option value="">Create a new conversation</option>
              {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c) => (
                <option key={c.conversation_id} value={c.conversation_id}>{c.title || 'Conversation'}</option>
              ))}
            </select>
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-cyan-200 dark:border-cyan-800"><p className="text-xs text-cyan-700 dark:text-cyan-400 flex items-center"><Target className="w-3 h-3 mr-2" />{targetConversationId ? 'Task results will be added to the selected conversation' : 'A new conversation will be created for this task'}</p></div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-muted/30 border-t border-border rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            <Button variant="outline" size="sm" onClick={onCancel}><X className="w-4 h-4 mr-1" />Cancel</Button>
            {currentStep > 1 && <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>}
          </div>
          <div className="flex space-x-3">
            {!isLastStep && (
              <Button
                size="sm"
                onClick={onNext}
                disabled={
                  (currentStep === 2 && ((scheduleMode === 'one_time' && (!oneTimeDate || !oneTimeTime)) || (scheduleMode === 'recurring' && (!recurringStartDate || !recurringTime)))) ||
                  (currentStep === 3 && scheduleMode === 'recurring' && everyInterval < 1) ||
                  (currentStep === 4 && taskSteps.length === 0) ||
                  (currentStep === 5 && !newTaskTitle.trim())
                }
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {isLastStep && (
              <Button size="sm" onClick={onSaveTask} disabled={loading || !newTaskTitle.trim()}>
                <Save className="w-4 h-4 mr-1" /> {editingTask ? 'Update Task' : 'Save Task'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

