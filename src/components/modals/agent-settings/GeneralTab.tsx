import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';

interface GeneralTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    role?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function GeneralTab({ agentId, agentData, onAgentUpdated }: GeneralTabProps) {
  const [name, setName] = useState(agentData?.name || '');
  const [role, setRole] = useState(agentData?.role || '');
  const [description, setDescription] = useState(agentData?.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    setName(agentData?.name || '');
    setRole(agentData?.role || '');
    setDescription(agentData?.description || '');
  }, [agentData]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          role: role.trim() || null,
          description: description.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Agent details updated successfully');
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('Failed to update agent details');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    name !== (agentData?.name || '') ||
    role !== (agentData?.role || '') ||
    description !== (agentData?.description || '');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">General Information</h3>
        <p className="text-sm text-muted-foreground">
          Configure your agent's basic information and identity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Details</CardTitle>
          <CardDescription>
            Set the fundamental information that defines your agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter agent name..."
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              This is how your agent will be identified in conversations.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-role">Role</Label>
            <Input
              id="agent-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Customer Support Agent, Research Assistant..."
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Optional role or title that describes the agent's primary function.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this agent does and its purpose..."
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A brief description of the agent's capabilities and intended use.
            </p>
          </div>

          {hasChanges && (
            <div className="flex items-center justify-end pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isLoading || !name.trim()}
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
