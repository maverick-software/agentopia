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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Brain,
  MessageCircle,
  BookOpen,
  Users,
  Lightbulb,
  Target,
  Sparkles
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface HowIThinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    system_instructions?: string;
    assistant_instructions?: string;
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

const THINKING_PRESETS = [
  {
    id: 'helpful_tutor',
    name: 'Helpful Tutor',
    icon: BookOpen,
    gradient: 'from-blue-500 to-indigo-600',
    systemPrompt: `I approach problems by breaking them down into manageable steps and always checking for understanding. I ask clarifying questions to make sure I truly understand what you need before diving into solutions.`,
    assistantPrompt: `I communicate in a clear, educational manner. I like to explain my reasoning and provide examples. I always ask if you need more detail or have questions before moving on.`,
    description: 'Patient, educational, step-by-step approach'
  },
  {
    id: 'creative_partner',
    name: 'Creative Partner',
    icon: Sparkles,
    gradient: 'from-purple-500 to-pink-500',
    systemPrompt: `I think outside the box and love exploring creative solutions. I approach challenges by brainstorming multiple possibilities and considering unconventional angles.`,
    assistantPrompt: `I'm enthusiastic and collaborative in my communication. I love building on ideas together and asking "what if" questions. I encourage experimentation and creative thinking.`,
    description: 'Innovative, collaborative, idea-focused'
  },
  {
    id: 'professional_assistant',
    name: 'Professional Assistant',
    icon: Target,
    gradient: 'from-green-600 to-emerald-600',
    systemPrompt: `I focus on efficiency and clear outcomes. I analyze tasks systematically, prioritize effectively, and always consider the business impact of decisions.`,
    assistantPrompt: `I communicate concisely and professionally. I provide structured responses with clear action items and timelines. I focus on practical solutions that deliver results.`,
    description: 'Efficient, organized, results-oriented'
  },
  {
    id: 'research_buddy',
    name: 'Research Buddy',
    icon: Lightbulb,
    gradient: 'from-orange-500 to-red-500',
    systemPrompt: `I love diving deep into topics and finding connections between ideas. I approach research systematically, checking multiple sources and considering different perspectives.`,
    assistantPrompt: `I share my findings in an engaging way and love discussing implications. I ask thought-provoking questions and help you explore topics from multiple angles.`,
    description: 'Curious, thorough, analytical'
  },
  {
    id: 'team_collaborator',
    name: 'Team Collaborator',
    icon: Users,
    gradient: 'from-cyan-500 to-blue-600',
    systemPrompt: `I consider how decisions affect everyone involved and work to build consensus. I think about communication, team dynamics, and how to bring out the best in group work.`,
    assistantPrompt: `I facilitate discussions and help everyone stay on the same page. I'm encouraging and make sure all voices are heard. I focus on shared goals and team success.`,
    description: 'Collaborative, inclusive, team-focused'
  }
];

export function HowIThinkModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: HowIThinkModalProps) {
  const supabase = useSupabaseClient();
  
  // Form state
  const [problemApproach, setProblemApproach] = useState('');
  const [communicationStyle, setCommunicationStyle] = useState('');
  const [specialGuidelines, setSpecialGuidelines] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize form data when modal opens or agent data changes
  useEffect(() => {
    if (isOpen && agentData) {
      // Parse existing system instructions to populate fields
      const systemInstructions = agentData.system_instructions || '';
      const assistantInstructions = agentData.assistant_instructions || '';
      
      // Try to extract sections if they exist, otherwise use the full text
      setProblemApproach(systemInstructions);
      setCommunicationStyle(assistantInstructions);
      setSpecialGuidelines(''); // This could be extracted from instructions if needed
      setSelectedPreset(null);
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

  const applyPreset = (preset: typeof THINKING_PRESETS[0]) => {
    setProblemApproach(preset.systemPrompt);
    setCommunicationStyle(preset.assistantPrompt);
    setSelectedPreset(preset.id);
  };

  const handleSave = useCallback(async () => {
    if (!agentId) return;
    
    setLoading(true);
    
    try {
      const { data: updatedAgent, error } = await supabase
        .from('agents')
        .update({
          system_instructions: problemApproach.trim(),
          assistant_instructions: communicationStyle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Your thinking style has been updated! 🧠');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated && updatedAgent) {
        onAgentUpdated(updatedAgent);
      }
      
    } catch (error: any) {
      console.error('Error updating agent thinking:', error);
      toast.error('Failed to update thinking style');
    } finally {
      setLoading(false);
    }
  }, [agentId, problemApproach, communicationStyle, supabase, onAgentUpdated]);

  const hasChanges = () => {
    if (!agentData) return true;
    return (
      problemApproach !== (agentData.system_instructions || '') ||
      communicationStyle !== (agentData.assistant_instructions || '')
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🧠 Behavior
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Help me understand how you'd like me to think and communicate so I can be most helpful to you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Quick Presets */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              🎯 Quick Personality Presets
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {THINKING_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.id;
                
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`flex items-center p-3 rounded-lg border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${preset.gradient} flex items-center justify-center mr-3 flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {preset.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a preset or customize below to define your unique thinking style
            </p>
          </div>

          {/* Problem Approach */}
          <div className="space-y-2">
            <Label htmlFor="problem-approach" className="text-sm font-medium flex items-center">
              <Brain className="h-4 w-4 mr-2" />
              How should I think about problems?
            </Label>
            <Textarea
              id="problem-approach"
              value={problemApproach}
              onChange={(e) => {
                setProblemApproach(e.target.value);
                setSelectedPreset(null); // Clear preset when manually editing
              }}
              placeholder="I like to break things down step by step and ask clarifying questions to make sure I understand what you need..."
              className="bg-background border-border min-h-[100px] resize-none"
            />
          </div>

          {/* Communication Style */}
          <div className="space-y-2">
            <Label htmlFor="communication-style" className="text-sm font-medium flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              What's my communication style?
            </Label>
            <Textarea
              id="communication-style"
              value={communicationStyle}
              onChange={(e) => {
                setCommunicationStyle(e.target.value);
                setSelectedPreset(null); // Clear preset when manually editing
              }}
              placeholder="I prefer to be conversational and explain things clearly. I like to check if you need more detail and ask follow-up questions..."
              className="bg-background border-border min-h-[100px] resize-none"
            />
          </div>

          {/* Special Guidelines */}
          <div className="space-y-2">
            <Label htmlFor="special-guidelines" className="text-sm font-medium flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Any special guidelines I should follow?
            </Label>
            <Textarea
              id="special-guidelines"
              value={specialGuidelines}
              onChange={(e) => setSpecialGuidelines(e.target.value)}
              placeholder="Always ask permission before taking actions. Be encouraging and supportive. Focus on practical solutions..."
              className="bg-background border-border min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Any specific rules or preferences for how I should behave
            </p>
          </div>

          {/* Current Preset Indicator */}
          {selectedPreset && (
            <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Using "{THINKING_PRESETS.find(p => p.id === selectedPreset)?.name}" preset
              </span>
              <Badge variant="secondary" className="text-xs">
                Customize above to make it your own
              </Badge>
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
            className="min-w-[140px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Update How I Think'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}