import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, AlertCircle, ExternalLink, Key, Mail } from 'lucide-react';
import { GmailOAuthSetupForm } from './GmailOAuthSetupForm';
import { SendGridSetupForm } from './SendGridSetupForm';
import { MailgunSetupForm } from './MailgunSetupForm';
import { SMTPSetupForm } from './SMTPSetupForm';
import { toast } from 'react-hot-toast';

interface ChannelService {
  id: string;
  name: string;
  description?: string;
  gradient: string;
  type: 'oauth' | 'api_key' | 'coming_soon';
}

interface ChannelSetupFormsProps {
  service: ChannelService;
  connectingService: string | null;
  // Form state
  connectionName: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  mailgunDomain: string;
  // SMTP form state
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUsername: string;
  smtpPassword: string;
  error: string | null;
  // Form handlers
  onConnectionNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onFromEmailChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  onMailgunDomainChange: (value: string) => void;
  // SMTP form handlers
  onSMTPHostChange: (value: string) => void;
  onSMTPPortChange: (value: string) => void;
  onSMTPSecureChange: (value: string) => void;
  onSMTPUsernameChange: (value: string) => void;
  onSMTPPasswordChange: (value: string) => void;
  // Setup handlers
  onOAuthSetup: (serviceId: string) => void;
  onSendGridSetup: () => void;
  onMailgunSetup: () => void;
  onSMTPSetup: () => void;
  onSetupCancel: () => void;
  onSetupService: (serviceId: string) => void;
}

export function ChannelSetupForms({
  service,
  connectingService,
  connectionName,
  apiKey,
  fromEmail,
  fromName,
  mailgunDomain,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUsername,
  smtpPassword,
  error,
  onConnectionNameChange,
  onApiKeyChange,
  onFromEmailChange,
  onFromNameChange,
  onMailgunDomainChange,
  onSMTPHostChange,
  onSMTPPortChange,
  onSMTPSecureChange,
  onSMTPUsernameChange,
  onSMTPPasswordChange,
  onOAuthSetup,
  onSendGridSetup,
  onMailgunSetup,
  onSMTPSetup,
  onSetupCancel,
  onSetupService
}: ChannelSetupFormsProps) {
  const isConnecting = connectingService === service.id;

  // Discord special case
  if (service.id === 'discord') {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            <span>Discord Bot Setup</span>
          </CardTitle>
          <CardDescription>
            Discord integration requires creating a Discord application and bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Discord integration is available but requires manual setup:</strong></p>
                <p>1. Create a Discord Application at <Button variant="link" className="p-0 h-auto" asChild>
                  <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">
                    Discord Developer Portal <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button></p>
                <p>2. Create a bot and get your bot token</p>
                <p>3. Configure the bot in your agent settings</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            For now, Discord integration is available through the main agent settings page. 
            We're working on streamlining this setup process.
          </div>

          <Button
            onClick={() => {
              toast.info('Please configure Discord through the agent edit page for now.');
              onSetupCancel();
            }}
            variant="outline"
            className="w-full"
          >
            Configure in Agent Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Email Relay provider selection
  if (service.type === 'api_key' && service.id === 'email_relay') {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-purple-500" />
            <span>Email Relay Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose your preferred email service provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => onSetupService('smtp')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium">SMTP Server</div>
                  <div className="text-sm text-muted-foreground">Use your own SMTP server</div>
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => onSetupService('sendgrid')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium">SendGrid</div>
                  <div className="text-sm text-muted-foreground">High-deliverability email service</div>
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => onSetupService('mailgun')}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Mailgun</div>
                  <div className="text-sm text-muted-foreground">Powerful email service with validation</div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // SMTP setup
  if (service.type === 'api_key' && service.id === 'smtp') {
    return (
      <SMTPSetupForm
        smtpHost={smtpHost}
        smtpPort={smtpPort}
        smtpSecure={smtpSecure}
        smtpUsername={smtpUsername}
        smtpPassword={smtpPassword}
        fromEmail={fromEmail}
        fromName={fromName}
        error={error}
        connectingService={connectingService}
        onSMTPHostChange={onSMTPHostChange}
        onSMTPPortChange={onSMTPPortChange}
        onSMTPSecureChange={onSMTPSecureChange}
        onSMTPUsernameChange={onSMTPUsernameChange}
        onSMTPPasswordChange={onSMTPPasswordChange}
        onFromEmailChange={onFromEmailChange}
        onFromNameChange={onFromNameChange}
        onSMTPSetup={onSMTPSetup}
      />
    );
  }

  // OAuth flow (Gmail)
  if (service.type === 'oauth') {
    return (
      <GmailOAuthSetupForm
        service={service}
        connectionName={connectionName}
        isConnecting={isConnecting}
        onConnectionNameChange={onConnectionNameChange}
        onConnect={onOAuthSetup}
      />
    );
  }

  // SendGrid API key setup
  if (service.type === 'api_key' && service.id === 'sendgrid') {
    return (
      <SendGridSetupForm
        service={service}
        apiKey={apiKey}
        fromEmail={fromEmail}
        fromName={fromName}
        connectionName={connectionName}
        error={error}
        isConnecting={isConnecting}
        onApiKeyChange={onApiKeyChange}
        onFromEmailChange={onFromEmailChange}
        onFromNameChange={onFromNameChange}
        onConnectionNameChange={onConnectionNameChange}
        onConnect={onSendGridSetup}
      />
    );
  }

  // Mailgun API key setup
  if (service.type === 'api_key' && service.id === 'mailgun') {
    return (
      <MailgunSetupForm
        service={service}
        apiKey={apiKey}
        mailgunDomain={mailgunDomain}
        connectionName={connectionName}
        error={error}
        isConnecting={isConnecting}
        onApiKeyChange={onApiKeyChange}
        onDomainChange={onMailgunDomainChange}
        onConnectionNameChange={onConnectionNameChange}
        onConnect={onMailgunSetup}
      />
    );
  }

  // Default case - no matching setup form
  return null;
}
