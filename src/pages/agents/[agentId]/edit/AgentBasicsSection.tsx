import type { ChangeEvent } from 'react';
import { PencilLine } from 'lucide-react';
import { AgentIntegrationsManager } from '@/integrations/agent-management';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Agent } from '@/types';

const personalityTemplates = [
  { id: 'helpful', name: 'Helpful', description: 'Friendly and eager to assist' },
  { id: 'professional', name: 'Professional', description: 'Formal and business-oriented' },
  { id: 'cheerful', name: 'Cheerful', description: 'Upbeat and positive' },
];

interface AgentBasicsSectionProps {
  agentId: string;
  agentData: Partial<Agent>;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (value: string) => void;
  onOpenProfileModal: () => void;
  onOpenInstructionsModal: () => void;
}

export function AgentBasicsSection({
  agentId,
  agentData,
  onInputChange,
  onSelectChange,
  onOpenProfileModal,
  onOpenInstructionsModal,
}: AgentBasicsSectionProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-2 border-border">
                {agentData.avatar_url ? (
                  <AvatarImage src={agentData.avatar_url} alt={agentData.name || 'Agent'} />
                ) : (
                  <AvatarFallback className="text-3xl">{agentData.name?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full">
                <Button size="sm" variant="ghost" className="text-white" onClick={onOpenProfileModal}>
                  <PencilLine className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={agentData.name || ''}
              onChange={onInputChange}
              placeholder="My Helpful Agent"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={agentData.description || ''}
              onChange={onInputChange}
              placeholder="Provide a brief description of the agent's purpose."
              className="min-h-[80px] resize-y"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Agent Settings</CardTitle>
          <CardDescription>Configure personality and behavior options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentPersonality">Personality</Label>
            <Select name="personality" value={agentData.personality || ''} onValueChange={onSelectChange}>
              <SelectTrigger id="agentPersonality">
                <SelectValue placeholder="Select a personality template" />
              </SelectTrigger>
              <SelectContent>
                {personalityTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={onOpenInstructionsModal} className="w-full">
            <PencilLine className="h-4 w-4 mr-2" />
            Edit Instructions
          </Button>
        </CardContent>
      </Card>

      <AgentIntegrationsManager
        agentId={agentId}
        category="channel"
        title="Channels"
        description="Connect communication channels to this agent"
      />
    </div>
  );
}
