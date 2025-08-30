import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Loader2, 
  Save,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ChannelsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface ChannelSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  slack_enabled: boolean;
  discord_enabled: boolean;
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
}

export function ChannelsTab({ agentId, agentData, onAgentUpdated }: ChannelsTabProps) {
  const [settings, setSettings] = useState<ChannelSettings>({
    email_enabled: false,
    sms_enabled: false,
    slack_enabled: false,
    discord_enabled: false,
    telegram_enabled: false,
    whatsapp_enabled: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    // Load current channel settings from agent data
    if (agentData) {
      setSettings({
        email_enabled: agentData.email_enabled || false,
        sms_enabled: agentData.sms_enabled || false,
        slack_enabled: agentData.slack_enabled || false,
        discord_enabled: agentData.discord_enabled || false,
        telegram_enabled: agentData.telegram_enabled || false,
        whatsapp_enabled: agentData.whatsapp_enabled || false
      });
    }
  }, [agentData]);

  const handleToggle = (channel: keyof ChannelSettings, enabled: boolean) => {
    setSettings(prev => ({ ...prev, [channel]: enabled }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          email_enabled: settings.email_enabled,
          sms_enabled: settings.sms_enabled,
          slack_enabled: settings.slack_enabled,
          discord_enabled: settings.discord_enabled,
          telegram_enabled: settings.telegram_enabled,
          whatsapp_enabled: settings.whatsapp_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Channel settings updated successfully');
      setHasChanges(false);
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating channel settings:', error);
      toast.error('Failed to update channel settings');
    } finally {
      setIsLoading(false);
    }
  };

  const channels = [
    {
      id: 'email_enabled' as keyof ChannelSettings,
      name: 'Email',
      description: 'Send and receive emails through various providers',
      icon: Mail,
      enabled: settings.email_enabled,
      requiresAuth: 'API or OAuth',
      providers: ['Gmail', 'SMTP', 'SendGrid', 'Mailgun'],
      status: 'configured' // This would be dynamic based on integrations
    },
    {
      id: 'sms_enabled' as keyof ChannelSettings,
      name: 'SMS',
      description: 'Send and receive text messages',
      icon: Phone,
      enabled: settings.sms_enabled,
      requiresAuth: 'API',
      providers: ['Twilio', 'AWS SNS'],
      status: 'not_configured'
    },
    {
      id: 'slack_enabled' as keyof ChannelSettings,
      name: 'Slack',
      description: 'Interact in Slack channels and direct messages',
      icon: MessageSquare,
      enabled: settings.slack_enabled,
      requiresAuth: 'OAuth',
      providers: ['Slack API'],
      status: 'not_configured'
    },
    {
      id: 'discord_enabled' as keyof ChannelSettings,
      name: 'Discord',
      description: 'Respond to mentions in Discord servers',
      icon: MessageSquare,
      enabled: settings.discord_enabled,
      requiresAuth: 'Bot Token',
      providers: ['Discord Bot API'],
      status: 'configured'
    },
    {
      id: 'telegram_enabled' as keyof ChannelSettings,
      name: 'Telegram',
      description: 'Chat with users on Telegram',
      icon: MessageSquare,
      enabled: settings.telegram_enabled,
      requiresAuth: 'Bot Token',
      providers: ['Telegram Bot API'],
      status: 'not_configured'
    },
    {
      id: 'whatsapp_enabled' as keyof ChannelSettings,
      name: 'WhatsApp',
      description: 'Send and receive WhatsApp messages',
      icon: MessageSquare,
      enabled: settings.whatsapp_enabled,
      requiresAuth: 'API',
      providers: ['WhatsApp Business API'],
      status: 'not_configured'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Communication Channels</h3>
        <p className="text-sm text-muted-foreground">
          Configure which communication channels your agent can use to interact with users.
        </p>
      </div>

      <div className="space-y-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const isConfigured = channel.status === 'configured';
          
          return (
            <Card key={channel.id} className={!isConfigured ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      channel.enabled && isConfigured
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{channel.name}</h4>
                        {isConfigured ? (
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
                        {channel.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          Providers:
                        </p>
                        {channel.providers.map((provider, index) => (
                          <Badge key={provider} variant="secondary" className="text-xs">
                            {provider}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isConfigured && (
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                    )}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={channel.id}
                        checked={channel.enabled && isConfigured}
                        onCheckedChange={(checked) => handleToggle(channel.id, checked)}
                        disabled={!isConfigured}
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

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Channel Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            To enable these channels, you'll need to configure the required authentication in the Integrations section.
          </p>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Go to Integrations
          </Button>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isLoading}
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
    </div>
  );
}
