import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SMTPConfiguration, AgentSMTPPermissionCreate } from '@/integrations/smtp';
import { Plus } from 'lucide-react';

interface GrantSMTPAccessCardProps {
  availableConfigurations: SMTPConfiguration[];
  selectedConfigId: string;
  setSelectedConfigId: (value: string) => void;
  newPermission: Partial<AgentSMTPPermissionCreate>;
  setNewPermission: React.Dispatch<React.SetStateAction<Partial<AgentSMTPPermissionCreate>>>;
  allowedRecipientsText: string;
  setAllowedRecipientsText: (value: string) => void;
  blockedRecipientsText: string;
  setBlockedRecipientsText: (value: string) => void;
  expiresAtDate: string;
  setExpiresAtDate: (value: string) => void;
  loading: boolean;
  onAddPermission: () => void;
}

export function GrantSMTPAccessCard({
  availableConfigurations,
  selectedConfigId,
  setSelectedConfigId,
  newPermission,
  setNewPermission,
  allowedRecipientsText,
  setAllowedRecipientsText,
  blockedRecipientsText,
  setBlockedRecipientsText,
  expiresAtDate,
  setExpiresAtDate,
  loading,
  onAddPermission,
}: GrantSMTPAccessCardProps) {
  if (availableConfigurations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Grant SMTP Access
        </CardTitle>
        <CardDescription>Give this agent access to an SMTP configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>SMTP Configuration</Label>
          <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an SMTP configuration" />
            </SelectTrigger>
            <SelectContent>
              {availableConfigurations.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.connection_name} ({config.from_email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="can_send_email"
              checked={newPermission.can_send_email ?? true}
              onCheckedChange={(checked) => setNewPermission((prev) => ({ ...prev, can_send_email: checked }))}
            />
            <Label htmlFor="can_send_email" className="text-sm">
              Can Send Emails
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="can_send_attachments"
              checked={newPermission.can_send_attachments ?? false}
              onCheckedChange={(checked) => setNewPermission((prev) => ({ ...prev, can_send_attachments: checked }))}
            />
            <Label htmlFor="can_send_attachments" className="text-sm">
              Can Send Attachments
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="can_use_custom_from"
              checked={newPermission.can_use_custom_from ?? false}
              onCheckedChange={(checked) => setNewPermission((prev) => ({ ...prev, can_use_custom_from: checked }))}
            />
            <Label htmlFor="can_use_custom_from" className="text-sm">
              Can Use Custom From
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daily_limit">Daily Email Limit (Optional)</Label>
            <Input
              id="daily_limit"
              type="number"
              placeholder="Leave empty for config default"
              value={newPermission.daily_email_limit || ''}
              onChange={(event) =>
                setNewPermission((prev) => ({
                  ...prev,
                  daily_email_limit: event.target.value ? parseInt(event.target.value, 10) : undefined,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients_limit">Recipients Per Email Limit (Optional)</Label>
            <Input
              id="recipients_limit"
              type="number"
              placeholder="Leave empty for config default"
              value={newPermission.recipients_per_email_limit || ''}
              onChange={(event) =>
                setNewPermission((prev) => ({
                  ...prev,
                  recipients_per_email_limit: event.target.value ? parseInt(event.target.value, 10) : undefined,
                }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="allowed_recipients">Allowed Recipients (Optional)</Label>
            <Input
              id="allowed_recipients"
              placeholder="user@domain.com, *@company.com"
              value={allowedRecipientsText}
              onChange={(event) => setAllowedRecipientsText(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of allowed email patterns</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocked_recipients">Blocked Recipients (Optional)</Label>
            <Input
              id="blocked_recipients"
              placeholder="spam@domain.com, *@blocked.com"
              value={blockedRecipientsText}
              onChange={(event) => setBlockedRecipientsText(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of blocked email patterns</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expires_at">Expires At (Optional)</Label>
          <Input id="expires_at" type="date" value={expiresAtDate} onChange={(event) => setExpiresAtDate(event.target.value)} />
          <p className="text-xs text-muted-foreground">Leave empty for permanent access</p>
        </div>

        <Button onClick={onAddPermission} disabled={loading || !selectedConfigId} className="w-full">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Adding Permission...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Grant SMTP Access
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
