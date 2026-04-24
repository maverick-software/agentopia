import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { OAuthProviderFormData } from './types';

interface ProviderFormDialogProps {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  saving: boolean;
  formData: OAuthProviderFormData;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormDataChange: (updater: (prev: OAuthProviderFormData) => OAuthProviderFormData) => void;
}

export function ProviderFormDialog({
  open,
  title,
  description,
  submitLabel,
  saving,
  formData,
  onOpenChange,
  onSubmit,
  onFormDataChange,
}: ProviderFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${title}-name`}>Provider Name</Label>
              <Input
                id={`${title}-name`}
                value={formData.name}
                onChange={(event) =>
                  onFormDataChange((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g., gmail, serper_api"
                required
              />
            </div>
            <div>
              <Label htmlFor={`${title}-display-name`}>Display Name</Label>
              <Input
                id={`${title}-display-name`}
                value={formData.display_name}
                onChange={(event) =>
                  onFormDataChange((prev) => ({ ...prev, display_name: event.target.value }))
                }
                placeholder="e.g., Gmail, Serper API"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${title}-authorization-endpoint`}>Authorization Endpoint</Label>
              <Input
                id={`${title}-authorization-endpoint`}
                value={formData.authorization_endpoint}
                onChange={(event) =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    authorization_endpoint: event.target.value,
                  }))
                }
                placeholder="https://accounts.google.com/o/oauth2/auth"
                required
              />
            </div>
            <div>
              <Label htmlFor={`${title}-token-endpoint`}>Token Endpoint</Label>
              <Input
                id={`${title}-token-endpoint`}
                value={formData.token_endpoint}
                onChange={(event) =>
                  onFormDataChange((prev) => ({ ...prev, token_endpoint: event.target.value }))
                }
                placeholder="https://oauth2.googleapis.com/token"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${title}-revoke-endpoint`}>Revoke Endpoint (Optional)</Label>
              <Input
                id={`${title}-revoke-endpoint`}
                value={formData.revoke_endpoint}
                onChange={(event) =>
                  onFormDataChange((prev) => ({ ...prev, revoke_endpoint: event.target.value }))
                }
                placeholder="https://oauth2.googleapis.com/revoke"
              />
            </div>
            <div>
              <Label htmlFor={`${title}-discovery-endpoint`}>Discovery Endpoint (Optional)</Label>
              <Input
                id={`${title}-discovery-endpoint`}
                value={formData.discovery_endpoint}
                onChange={(event) =>
                  onFormDataChange((prev) => ({ ...prev, discovery_endpoint: event.target.value }))
                }
                placeholder="https://accounts.google.com/.well-known/openid_configuration"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${title}-credentials-location`}>Client Credentials Location</Label>
              <Select
                value={formData.client_credentials_location}
                onValueChange={(value) =>
                  onFormDataChange((prev) => ({ ...prev, client_credentials_location: value }))
                }
              >
                <SelectTrigger id={`${title}-credentials-location`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="body">Body</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${title}-status`}>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'true' | 'false') =>
                  onFormDataChange((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id={`${title}-status`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id={`${title}-pkce-required`}
              checked={formData.pkce_required}
              onCheckedChange={(checked) =>
                onFormDataChange((prev) => ({ ...prev, pkce_required: checked }))
              }
            />
            <Label htmlFor={`${title}-pkce-required`}>PKCE Required</Label>
          </div>

          <div>
            <Label htmlFor={`${title}-scopes-supported`}>Scopes Supported (JSON Array)</Label>
            <Textarea
              id={`${title}-scopes-supported`}
              value={formData.scopes_supported}
              onChange={(event) =>
                onFormDataChange((prev) => ({ ...prev, scopes_supported: event.target.value }))
              }
              rows={3}
              placeholder='["openid", "email", "profile"]'
            />
          </div>

          <div>
            <Label htmlFor={`${title}-configuration-metadata`}>Configuration Metadata (JSON)</Label>
            <Textarea
              id={`${title}-configuration-metadata`}
              value={formData.configuration_metadata}
              onChange={(event) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  configuration_metadata: event.target.value,
                }))
              }
              rows={4}
              placeholder='{"provider_type": "oauth", "requires_api_key": false}'
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
