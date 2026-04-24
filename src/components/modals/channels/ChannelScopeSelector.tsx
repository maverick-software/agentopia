import React from 'react';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ChannelScopeSelectorProps {
  editingPermission: AgentPermission | null;
  selectedScopes: string[];
  onScopesChange: (scopes: string[]) => void;
}

export function ChannelScopeSelector({
  editingPermission,
  selectedScopes,
  onScopesChange
}: ChannelScopeSelectorProps) {
  const toggleScope = (scope: string, checked: boolean) => {
    const newScopes = checked 
      ? [...selectedScopes, scope]
      : selectedScopes.filter(s => s !== scope);
    onScopesChange(newScopes);
  };

  const provider = (editingPermission as any)?.provider_name?.toLowerCase() || '';

  if (provider === 'smtp') {
    const smtpScopes = [
      { scope: 'smtp_send_email', label: 'Send Email', description: 'Allow agent to send emails through SMTP.' },
      { scope: 'smtp_email_templates', label: 'Templates', description: 'Allow agent to use saved SMTP templates.' },
      { scope: 'smtp_email_stats', label: 'Stats', description: 'Allow agent to read SMTP delivery stats.' },
    ];

    return (
      <div className="space-y-3">
        {smtpScopes.map(({ scope, label, description }) => (
          <div key={scope} className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={(e) => toggleScope(scope, e.target.checked)}
                className="rounded border-gray-300"
              />
              {label}
            </label>
            <p className="text-xs text-muted-foreground ml-6">{description}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      No permissions available for this service.
    </div>
  );
}
