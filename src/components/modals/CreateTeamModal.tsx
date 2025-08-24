import React, { useState } from 'react';
import { useTeams } from '../../hooks/useTeams';
import { Save, Loader2, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated?: (teamId: string) => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  onTeamCreated
}) => {
  const { createTeam, loading: saving, error: saveError } = useTeams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Team name is required.');
      return;
    }

    try {
      const newTeam = await createTeam(name.trim(), description.trim());
      if (newTeam) {
        console.log(`Team created successfully: ${newTeam.id}`);
        // Reset form
        setName('');
        setDescription('');
        setValidationError(null);
        // Close modal
        onClose();
        // Notify parent component
        onTeamCreated?.(newTeam.id);
      } else {
        // Error handled by useTeams hook, display saveError
        console.error('Team creation failed, but no specific error from hook?');
      }
    } catch (err) {
      // Should be caught by the hook, but just in case
      console.error("Error during team creation submission:", err);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setName('');
    setDescription('');
    setValidationError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a new team to organize your agents and collaborate with others.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(validationError || saveError) && (
            <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{validationError || saveError?.message || 'An unexpected error occurred.'}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              name="name"
              type="text"
              required
              placeholder="Enter team name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">Description (Optional)</Label>
            <Textarea
              id="team-description"
              name="description"
              rows={3}
              placeholder="Describe the team's purpose"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Team
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
