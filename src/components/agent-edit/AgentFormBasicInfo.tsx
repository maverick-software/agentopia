import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Agent } from '@/types';
import { Label } from '@/components/ui/label';

// Define personality templates structure (assuming it's passed)
interface PersonalityTemplate {
  id: string;
  name: string;
  description: string;
}

// Define component props
interface AgentFormBasicInfoProps {
  formData: Partial<Agent>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (value: string) => void; // For personality select
  handleSwitchChange: (checked: boolean) => void; // For active switch
  personalityTemplates: PersonalityTemplate[];
}

export const AgentFormBasicInfo: React.FC<AgentFormBasicInfoProps> = ({
  formData,
  handleInputChange,
  handleSelectChange,
  handleSwitchChange,
  personalityTemplates
}) => {

  // State hooks relevant to this form section could be moved here
  // if they aren't needed by the parent for the main save action.
  // Example: Local validation state?
  // const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Agent Name */}
      <div>
        <Label htmlFor="agentName">Name</Label>
        <Input 
          id="agentName" 
          name="name" 
          value={formData.name || ''} 
          onChange={handleInputChange} 
          placeholder="Agent Name" 
          required 
        />
      </div>

      {/* Agent Description */}
      <div>
        <Label htmlFor="agentDescription">Description</Label>
        <Textarea 
          id="agentDescription" 
          name="description" 
          value={formData.description || ''} 
          onChange={handleInputChange} 
          placeholder="What does this agent do?" 
          required 
        />
      </div>

      {/* Agent Personality */}
      <div>
        <Label htmlFor="agentPersonality">Personality</Label>
        <Select 
          name="personality" // Not standard HTML select, name might not be needed here
          value={formData.personality || ''} 
          onValueChange={handleSelectChange} // Use onValueChange for Shadcn Select
        >
          <SelectTrigger id="agentPersonality">
            <SelectValue placeholder="Select a personality template" />
          </SelectTrigger>
          <SelectContent>
            {personalityTemplates.map(template => (
              <SelectItem key={template.id} value={template.id}>
                {template.name} - {template.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Status */}
      <div className="flex items-center space-x-2">
        <Switch 
          id="agentActive" 
          checked={formData.active} 
          onCheckedChange={handleSwitchChange} 
        />
        <Label htmlFor="agentActive">Active</Label>
      </div>

    </div>
  );
}; 