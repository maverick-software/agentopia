import { Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REQUIRED_WEBHOOK_EVENTS } from './types';

interface WebhooksTabProps {
  lastSync: string | null;
}

export function WebhooksTab({ lastSync }: WebhooksTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Webhook Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="webhook_url">Webhook Endpoint URL</Label>
          <Input id="webhook_url" type="url" value={`${window.location.origin}/functions/v1/stripe-webhook`} readOnly className="bg-gray-50 dark:bg-gray-800" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Configure this URL in your Stripe Dashboard - Developers - Webhooks.</p>
        </div>
        <div>
          <Label>Required Events</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {REQUIRED_WEBHOOK_EVENTS.map((event) => <Badge key={event} variant="outline" className="justify-start">{event}</Badge>)}
          </div>
        </div>
        {lastSync && (
          <div>
            <Label>Last Sync</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(lastSync).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
