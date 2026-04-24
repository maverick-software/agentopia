import { Bot, Loader2, Palette, Settings, Sparkles, User, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AVAILABLE_TOOLS, EYE_COLORS, HAIR_COLORS, MBTI_TYPES, THEMES } from './constants';
import { AgentData, ToolCapability } from './types';

interface ManualWizardStepsProps {
  step: number;
  agentData: AgentData;
  generatingDescription: boolean;
  onUpdateAgentData: (updates: Partial<AgentData>) => void;
  onEnhanceWithAI: () => void;
  onGenerateRandomAttributes: () => void;
}

function NameStep({ agentData, onUpdateAgentData }: Pick<ManualWizardStepsProps, 'agentData' | 'onUpdateAgentData'>) {
  return (
    <div className="text-center bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-6">What's your agent's name?</h3>
      <div className="flex flex-col items-center">
        <Input
          id="agent-name"
          placeholder="e.g., Sarah, Research Assistant, Code Helper..."
          value={agentData.name}
          onChange={(e) => onUpdateAgentData({ name: e.target.value })}
          autoFocus
          className="text-lg py-4 px-4 bg-muted/30 border-muted-foreground/20 rounded focus:bg-background transition-colors text-center w-1/2 min-w-[300px]"
        />
      </div>
    </div>
  );
}

function PurposeStep({ agentData, generatingDescription, onUpdateAgentData, onEnhanceWithAI }: Pick<ManualWizardStepsProps, 'agentData' | 'generatingDescription' | 'onUpdateAgentData' | 'onEnhanceWithAI'>) {
  return (
    <div className="text-center bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-6">What should {agentData.name} be good at?</h3>
      <div className="flex flex-col items-center space-y-4">
        <Textarea
          id="agent-purpose"
          placeholder="e.g., Helping with customer support, Research and analysis, Creative writing, Technical documentation..."
          value={agentData.purpose}
          onChange={(e) => onUpdateAgentData({ purpose: e.target.value })}
          rows={5}
          className="resize-none bg-muted/30 border-muted-foreground/20 rounded focus:bg-background transition-colors py-4 px-4 w-1/2 min-w-[300px]"
        />
        <button
          onClick={onEnhanceWithAI}
          disabled={generatingDescription || !agentData.purpose.trim()}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {generatingDescription ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enhancing...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Enhance with AI</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ToolsStep({ agentData, onUpdateAgentData }: Pick<ManualWizardStepsProps, 'agentData' | 'onUpdateAgentData'>) {
  const selectedTools = agentData.selectedTools || [];
  const communicationTools = AVAILABLE_TOOLS.filter((tool) => tool.category === 'Communication');
  const otherTools = AVAILABLE_TOOLS.filter((tool) => tool.category !== 'Communication');

  const toggleTool = (toolId: string) => {
    const updatedTools = selectedTools.includes(toolId)
      ? selectedTools.filter((id) => id !== toolId)
      : [...selectedTools, toolId];
    onUpdateAgentData({ selectedTools: updatedTools });
  };

  const renderToolCard = (tool: ToolCapability) => {
    const isSelected = selectedTools.includes(tool.id);
    const isComingSoon = tool.comingSoon;
    return (
      <div key={tool.id} className={`flex items-center justify-between p-3 bg-background/50 rounded-lg border border-muted-foreground/10 ${isComingSoon ? 'opacity-50' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${isComingSoon ? 'text-muted-foreground' : ''}`}>{tool.name}</span>
            {isComingSoon && <span className="text-xs text-muted-foreground/70 italic">(coming soon)</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
        </div>
        <Switch checked={isSelected} onCheckedChange={() => toggleTool(tool.id)} disabled={isComingSoon} className="ml-3 flex-shrink-0" />
      </div>
    );
  };

  const selectedAuthTools = AVAILABLE_TOOLS.filter((tool) => selectedTools.includes(tool.id) && tool.requiresAuth && !tool.comingSoon);

  return (
    <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <div className="text-center mb-6">
        <Settings className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Which tools should {agentData.name} have access to?</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Communication</h4>
          <div className="space-y-2">{communicationTools.map(renderToolCard)}</div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Productivity & Research</h4>
          <div className="space-y-2">{otherTools.map(renderToolCard)}</div>
        </div>
      </div>
      {selectedAuthTools.length > 0 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Authentication Required</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            You'll need to connect API keys or OAuth credentials for selected tools after creating your agent.
          </p>
        </div>
      )}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">More Tools Available</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Additional tools will be available after you create your agent and can be enabled in settings.
        </p>
      </div>
    </div>
  );
}

function ThemeStep({ agentData, onUpdateAgentData }: Pick<ManualWizardStepsProps, 'agentData' | 'onUpdateAgentData'>) {
  return (
    <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <div className="text-center mb-6">
        <Palette className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Choose Theme for {agentData.name}</h3>
      </div>
      <div className="space-y-4">
        <Label className="text-sm font-medium">Theme <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((theme) => (
            <Card
              key={theme.id}
              className={`cursor-pointer transition-all rounded-lg ${
                agentData.theme === theme.id ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:border-primary/50 bg-muted/20 hover:bg-muted/30'
              }`}
              onClick={() => onUpdateAgentData({ theme: theme.id })}
            >
              <CardContent className="p-4">
                <div className="font-medium text-sm mb-1">{theme.name}</div>
                <div className="text-xs text-muted-foreground">{theme.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        {agentData.theme === 'custom' && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="custom-instructions" className="text-sm font-medium">Custom Theme Instructions</Label>
            <Textarea
              id="custom-instructions"
              placeholder="Describe your custom theme in detail..."
              value={agentData.customInstructions || ''}
              onChange={(e) => onUpdateAgentData({ customInstructions: e.target.value })}
              rows={4}
              className="resize-none bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomizeStep({ agentData, onUpdateAgentData, onGenerateRandomAttributes }: Pick<ManualWizardStepsProps, 'agentData' | 'onUpdateAgentData' | 'onGenerateRandomAttributes'>) {
  return (
    <div className="bg-muted/10 rounded-lg p-6 border border-muted-foreground/10">
      <div className="text-center mb-6">
        <User className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Customize {agentData.name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label className="text-sm font-medium">Physical Attributes</Label>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Gender</Label>
              <Select value={agentData.gender || ''} onValueChange={(value) => onUpdateAgentData({ gender: value as AgentData['gender'] })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hair Color</Label>
              <Select value={agentData.hairColor || ''} onValueChange={(value) => onUpdateAgentData({ hairColor: value })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"><SelectValue placeholder="Select hair color" /></SelectTrigger>
                <SelectContent>{HAIR_COLORS.map((color) => <SelectItem key={color} value={color}>{color}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Eye Color</Label>
              <Select value={agentData.eyeColor || ''} onValueChange={(value) => onUpdateAgentData({ eyeColor: value })}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"><SelectValue placeholder="Select eye color" /></SelectTrigger>
                <SelectContent>{EYE_COLORS.map((color) => <SelectItem key={color} value={color}>{color}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Label className="text-sm font-medium">Personality Type</Label>
          <div className="space-y-3">
            <Select value={agentData.mbtiType || ''} onValueChange={(value) => onUpdateAgentData({ mbtiType: value })}>
              <SelectTrigger className="bg-muted/30 border-muted-foreground/20 rounded-lg focus:bg-background transition-colors"><SelectValue placeholder="Select MBTI personality" /></SelectTrigger>
              <SelectContent>{MBTI_TYPES.map((mbti) => <SelectItem key={mbti.type} value={mbti.type}>{mbti.type} - {mbti.name}</SelectItem>)}</SelectContent>
            </Select>
            {agentData.mbtiType && (
              <Card className="bg-muted/20 border-muted-foreground/20 rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">{agentData.mbtiType}</Badge>
                    <span className="font-medium text-sm">{MBTI_TYPES.find((m) => m.type === agentData.mbtiType)?.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{MBTI_TYPES.find((m) => m.type === agentData.mbtiType)?.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-6">
        <Button variant="outline" onClick={onGenerateRandomAttributes} className="w-full max-w-sm bg-muted/20 border-muted-foreground/20 rounded-lg hover:bg-muted/30 transition-colors">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Random Attributes
        </Button>
      </div>
    </div>
  );
}

export function ManualWizardSteps(props: ManualWizardStepsProps) {
  if (props.step === 1) return <NameStep agentData={props.agentData} onUpdateAgentData={props.onUpdateAgentData} />;
  if (props.step === 2) return <PurposeStep agentData={props.agentData} generatingDescription={props.generatingDescription} onUpdateAgentData={props.onUpdateAgentData} onEnhanceWithAI={props.onEnhanceWithAI} />;
  if (props.step === 3) return <ToolsStep agentData={props.agentData} onUpdateAgentData={props.onUpdateAgentData} />;
  if (props.step === 4) return <ThemeStep agentData={props.agentData} onUpdateAgentData={props.onUpdateAgentData} />;
  return <CustomizeStep agentData={props.agentData} onUpdateAgentData={props.onUpdateAgentData} onGenerateRandomAttributes={props.onGenerateRandomAttributes} />;
}
