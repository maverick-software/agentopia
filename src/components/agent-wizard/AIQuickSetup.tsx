import { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface AIQuickSetupProps {
  onConfigGenerated: (config: any) => void;
  onClose: () => void;
}

export function AIQuickSetup({ onConfigGenerated, onClose }: AIQuickSetupProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = useSupabaseClient();

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please describe your agent');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const { data, error } = await supabase.functions.invoke('generate-agent-config', {
        body: { description: description.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Generation failed');

      toast.success('Configuration generated! 🎉');
      onConfigGenerated(data.configuration);
      onClose();
    } catch (error: any) {
      console.error('Error generating config:', error);
      toast.error(error.message || 'Failed to generate configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const examples = [
    'Create a friendly SEO specialist agent that helps with keyword research, content optimization, and technical SEO audits',
    'I need a patient technical support agent that troubleshoots software issues and provides step-by-step solutions',
    'Create an analytical code review assistant that checks for bugs and suggests improvements'
  ];

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Agent Wizard</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isGenerating}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Describe Your Agent
            </label>
            <Textarea
              placeholder="Example: Create a friendly customer support agent that helps users with technical issues..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isGenerating}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Be specific about the role, personality, and what the agent should help with
            </p>
          </div>

          {/* Example Prompts */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Examples:</p>
            <div className="space-y-2">
              {examples.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setDescription(example)}
                  disabled={isGenerating}
                  className="w-full text-left text-xs p-2 rounded border border-border hover:border-primary/50 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Configuration...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Agent Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


