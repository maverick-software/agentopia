import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ChannelCardItem, ChannelSettings } from './types';

interface ChannelCardsProps {
  channels: ChannelCardItem[];
  onToggle: (channel: keyof ChannelSettings, enabled: boolean) => Promise<void>;
}

export function ChannelCards({ channels, onToggle }: ChannelCardsProps) {
  return (
    <div className="space-y-4">
      {channels.map((channel) => {
        const Icon = channel.icon;
        const isConfigured = channel.status === 'configured';
        const isDisabled = Boolean(channel.disabled);

        return (
          <Card key={channel.id} className={isDisabled ? 'opacity-50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      isDisabled
                        ? 'bg-muted text-muted-foreground/50'
                        : channel.enabled && isConfigured
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium ${isDisabled ? 'text-muted-foreground' : ''}`}>{channel.name}</h4>
                      {isDisabled ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                          Coming Soon
                        </Badge>
                      ) : isConfigured ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {channel.requiresAuth} Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {isDisabled ? 'This integration is coming soon and not yet available.' : channel.description}
                    </p>
                    {!isDisabled && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Providers:</p>
                        {channel.providers.map((provider) => (
                          <Badge key={provider} variant="secondary" className="text-xs">
                            {provider}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isConfigured && !isDisabled && (
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Configure
                    </Button>
                  )}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={channel.id}
                      checked={channel.enabled}
                      onCheckedChange={(checked) => void onToggle(channel.id, checked)}
                      disabled={isDisabled}
                    />
                    <Label htmlFor={channel.id} className="sr-only">
                      Toggle {channel.name}
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
