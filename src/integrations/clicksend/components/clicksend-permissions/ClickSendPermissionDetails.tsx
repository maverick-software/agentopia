import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DollarSign, ChevronDown, History, Image, MessageSquare } from 'lucide-react';

interface ClickSendPermissionDetailsProps {
  showDetails: boolean;
  permissions: string[];
  isUpdating: boolean;
  onToggleDetails: () => void;
  onPermissionChange: (scope: string, enabled: boolean) => void;
}

const PERMISSION_ROWS = [
  {
    scope: 'sms',
    title: 'Send SMS Messages',
    description: 'Allow agent to send text messages to phone numbers',
    icon: MessageSquare,
    iconClassName: 'text-blue-600',
    detail: '• Standard SMS rates apply',
    detail2: '• 160 character limit per message',
  },
  {
    scope: 'mms',
    title: 'Send MMS Messages',
    description: 'Allow agent to send multimedia messages with images and videos',
    icon: Image,
    iconClassName: 'text-purple-600',
    detail: '• Higher rates than SMS',
    detail2: '• 5MB file size limit',
  },
  {
    scope: 'balance',
    title: 'Check Account Balance',
    description: 'Allow agent to view ClickSend account balance and usage',
    icon: DollarSign,
    iconClassName: 'text-green-600',
    detail: '• Read-only access to account information',
  },
  {
    scope: 'history',
    title: 'Access Message History',
    description: 'Allow agent to view sent message history and delivery status',
    icon: History,
    iconClassName: 'text-orange-600',
    detail: '• View messages sent by this agent only',
  },
] as const;

export function ClickSendPermissionDetails({
  showDetails,
  permissions,
  isUpdating,
  onToggleDetails,
  onPermissionChange,
}: ClickSendPermissionDetailsProps) {
  return (
    <div>
      <Button variant="ghost" className="w-full justify-between p-0" onClick={onToggleDetails}>
        <span className="font-medium text-gray-900">Permission Details</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </Button>

      {showDetails && (
        <div className="space-y-3 mt-4">
          {PERMISSION_ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.scope} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${row.iconClassName}`} />
                  <div>
                    <h5 className="font-medium text-gray-900">{row.title}</h5>
                    <p className="text-sm text-gray-600">{row.description}</p>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{row.detail}</span>
                      {row.detail2 ? <span>{row.detail2}</span> : null}
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={permissions.includes(row.scope)}
                  onCheckedChange={(checked) => onPermissionChange(row.scope, Boolean(checked))}
                  disabled={isUpdating}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
