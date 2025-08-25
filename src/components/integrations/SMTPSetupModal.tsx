/**
 * SMTP Setup Modal Component
 * Modal for creating and editing SMTP configurations
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Server, 
  Shield, 
  Settings, 
  Info, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  SMTPConfiguration, 
  SMTPConfigurationCreate, 
  SMTPConfigurationFormData,
  SMTP_PROVIDER_PRESETS,
  SMTPProviderPreset
} from '@/types/smtp';
import { useTheme } from '@/contexts/ThemeContext';

interface SMTPSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SMTPConfigurationCreate) => Promise<void>;
  editingConfig?: SMTPConfiguration;
}

export const SMTPSetupModal: React.FC<SMTPSetupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingConfig
}) => {
  const { theme } = useTheme();
  const [loading, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SMTPProviderPreset | null>(null);
  const [formData, setFormData] = useState<SMTPConfigurationFormData>({
    connection_name: '',
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    reply_to_email: '',
    connection_timeout: '60000',
    socket_timeout: '60000',
    greeting_timeout: '30000',
    max_emails_per_day: '100',
    max_recipients_per_email: '50'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when editing
  useEffect(() => {
    if (editingConfig) {
      setFormData({
        connection_name: editingConfig.connection_name,
        host: editingConfig.host,
        port: editingConfig.port.toString(),
        secure: editingConfig.secure,
        username: editingConfig.username,
        password: '', // Don't populate password for security
        from_email: editingConfig.from_email,
        from_name: editingConfig.from_name || '',
        reply_to_email: editingConfig.reply_to_email || '',
        connection_timeout: editingConfig.connection_timeout.toString(),
        socket_timeout: editingConfig.socket_timeout.toString(),
        greeting_timeout: editingConfig.greeting_timeout.toString(),
        max_emails_per_day: editingConfig.max_emails_per_day.toString(),
        max_recipients_per_email: editingConfig.max_recipients_per_email.toString()
      });
    } else {
      // Reset form for new configuration
      setFormData({
        connection_name: '',
        host: '',
        port: '587',
        secure: false,
        username: '',
        password: '',
        from_email: '',
        from_name: '',
        reply_to_email: '',
        connection_timeout: '60000',
        socket_timeout: '60000',
        greeting_timeout: '30000',
        max_emails_per_day: '100',
        max_recipients_per_email: '50'
      });
    }
    setErrors({});
    setSelectedPreset(null);
  }, [editingConfig, isOpen]);

  const handlePresetSelect = (preset: SMTPProviderPreset) => {
    setSelectedPreset(preset);
    setFormData(prev => ({
      ...prev,
      host: preset.host,
      port: preset.port.toString(),
      secure: preset.secure,
      connection_name: prev.connection_name || preset.displayName
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.connection_name.trim()) {
      newErrors.connection_name = 'Connection name is required';
    }
    if (!formData.host.trim()) {
      newErrors.host = 'SMTP host is required';
    }
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.password.trim() && !editingConfig) {
      newErrors.password = 'Password is required';
    }
    if (!formData.from_email.trim()) {
      newErrors.from_email = 'From email is required';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.from_email && !emailRegex.test(formData.from_email)) {
      newErrors.from_email = 'Invalid email address';
    }
    if (formData.reply_to_email && !emailRegex.test(formData.reply_to_email)) {
      newErrors.reply_to_email = 'Invalid email address';
    }

    // Numeric validation
    const port = parseInt(formData.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }

    const connectionTimeout = parseInt(formData.connection_timeout);
    if (isNaN(connectionTimeout) || connectionTimeout < 1000) {
      newErrors.connection_timeout = 'Connection timeout must be at least 1000ms';
    }

    const socketTimeout = parseInt(formData.socket_timeout);
    if (isNaN(socketTimeout) || socketTimeout < 1000) {
      newErrors.socket_timeout = 'Socket timeout must be at least 1000ms';
    }

    const greetingTimeout = parseInt(formData.greeting_timeout);
    if (isNaN(greetingTimeout) || greetingTimeout < 1000) {
      newErrors.greeting_timeout = 'Greeting timeout must be at least 1000ms';
    }

    const maxEmailsPerDay = parseInt(formData.max_emails_per_day);
    if (isNaN(maxEmailsPerDay) || maxEmailsPerDay < 1) {
      newErrors.max_emails_per_day = 'Daily email limit must be at least 1';
    }

    const maxRecipientsPerEmail = parseInt(formData.max_recipients_per_email);
    if (isNaN(maxRecipientsPerEmail) || maxRecipientsPerEmail < 1) {
      newErrors.max_recipients_per_email = 'Recipients per email must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const config: SMTPConfigurationCreate = {
        connection_name: formData.connection_name.trim(),
        host: formData.host.trim(),
        port: parseInt(formData.port),
        secure: formData.secure,
        username: formData.username.trim(),
        password: formData.password, // Only include if provided
        from_email: formData.from_email.trim(),
        from_name: formData.from_name.trim() || undefined,
        reply_to_email: formData.reply_to_email.trim() || undefined,
        connection_timeout: parseInt(formData.connection_timeout),
        socket_timeout: parseInt(formData.socket_timeout),
        greeting_timeout: parseInt(formData.greeting_timeout),
        max_emails_per_day: parseInt(formData.max_emails_per_day),
        max_recipients_per_email: parseInt(formData.max_recipients_per_email)
      };

      // Don't include password if editing and it's empty
      if (editingConfig && !formData.password.trim()) {
        delete config.password;
      }

      await onSave(config);
    } catch (error) {
      console.error('Error saving SMTP configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SMTPConfigurationFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {editingConfig ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
          </DialogTitle>
          <DialogDescription>
            Configure an SMTP server for sending emails. All credentials are encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="limits">Limits</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            {!editingConfig && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Setup</CardTitle>
                  <CardDescription className="text-xs">
                    Choose a preset for common email providers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Popular Personal Email Providers */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Popular Email Providers</p>
                      <div className="grid grid-cols-3 gap-2">
                        {SMTP_PROVIDER_PRESETS.filter(preset => 
                          ['gmail', 'outlook', 'yahoo', 'icloud'].includes(preset.name)
                        ).map((preset) => (
                          <Button
                            key={preset.name}
                            variant={selectedPreset?.name === preset.name ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePresetSelect(preset)}
                            className="justify-start text-xs"
                          >
                            {preset.displayName}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Business Email Services */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Business Email Services</p>
                      <div className="grid grid-cols-3 gap-2">
                        {SMTP_PROVIDER_PRESETS.filter(preset => 
                          ['zoho', 'amazonses', 'sendgrid', 'mailjet', 'smtpcom'].includes(preset.name)
                        ).map((preset) => (
                          <Button
                            key={preset.name}
                            variant={selectedPreset?.name === preset.name ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePresetSelect(preset)}
                            className="justify-start text-xs"
                          >
                            {preset.displayName}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Secure Email Providers */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Secure Email Providers</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SMTP_PROVIDER_PRESETS.filter(preset => 
                          ['protonmail'].includes(preset.name)
                        ).map((preset) => (
                          <Button
                            key={preset.name}
                            variant={selectedPreset?.name === preset.name ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePresetSelect(preset)}
                            className="justify-start text-xs"
                          >
                            {preset.displayName}
                          </Button>
                        ))}
                        
                        {/* Custom option */}
                        <Button
                          variant={selectedPreset?.name === 'custom' ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePresetSelect(SMTP_PROVIDER_PRESETS.find(p => p.name === 'custom')!)}
                          className="justify-start text-xs"
                        >
                          Custom Server
                        </Button>
                      </div>
                    </div>
                  </div>
                  {selectedPreset?.setupInstructions && (
                    <Alert className="mt-3">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedPreset.setupInstructions}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connection_name">Connection Name *</Label>
                <Input
                  id="connection_name"
                  value={formData.connection_name}
                  onChange={(e) => handleInputChange('connection_name', e.target.value)}
                  placeholder="e.g., Company Gmail, Personal Outlook"
                  className={errors.connection_name ? 'border-red-500' : ''}
                />
                {errors.connection_name && (
                  <p className="text-sm text-red-500">{errors.connection_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">SMTP Host *</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => handleInputChange('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className={errors.host ? 'border-red-500' : ''}
                  />
                  {errors.host && (
                    <p className="text-sm text-red-500">{errors.host}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', e.target.value)}
                    placeholder="587"
                    className={errors.port ? 'border-red-500' : ''}
                  />
                  {errors.port && (
                    <p className="text-sm text-red-500">{errors.port}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="secure"
                  checked={formData.secure}
                  onCheckedChange={(checked) => handleInputChange('secure', checked)}
                />
                <Label htmlFor="secure" className="text-sm">
                  Use SSL (port 465) instead of TLS (port 587)
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="your-email@domain.com"
                  className={errors.username ? 'border-red-500' : ''}
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {!editingConfig && '*'}
                  {editingConfig && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (leave empty to keep current password)
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder={editingConfig ? "Enter new password" : "Enter password"}
                    className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_email">From Email *</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => handleInputChange('from_email', e.target.value)}
                  placeholder="noreply@yourcompany.com"
                  className={errors.from_email ? 'border-red-500' : ''}
                />
                {errors.from_email && (
                  <p className="text-sm text-red-500">{errors.from_email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_name">From Name (Optional)</Label>
                <Input
                  id="from_name"
                  value={formData.from_name}
                  onChange={(e) => handleInputChange('from_name', e.target.value)}
                  placeholder="Your Company Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply_to_email">Reply-To Email (Optional)</Label>
                <Input
                  id="reply_to_email"
                  type="email"
                  value={formData.reply_to_email}
                  onChange={(e) => handleInputChange('reply_to_email', e.target.value)}
                  placeholder="support@yourcompany.com"
                  className={errors.reply_to_email ? 'border-red-500' : ''}
                />
                {errors.reply_to_email && (
                  <p className="text-sm text-red-500">{errors.reply_to_email}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connection_timeout">Connection Timeout (ms)</Label>
                <Input
                  id="connection_timeout"
                  type="number"
                  value={formData.connection_timeout}
                  onChange={(e) => handleInputChange('connection_timeout', e.target.value)}
                  placeholder="60000"
                  className={errors.connection_timeout ? 'border-red-500' : ''}
                />
                {errors.connection_timeout && (
                  <p className="text-sm text-red-500">{errors.connection_timeout}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Time to wait for initial connection (default: 60000ms)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="socket_timeout">Socket Timeout (ms)</Label>
                <Input
                  id="socket_timeout"
                  type="number"
                  value={formData.socket_timeout}
                  onChange={(e) => handleInputChange('socket_timeout', e.target.value)}
                  placeholder="60000"
                  className={errors.socket_timeout ? 'border-red-500' : ''}
                />
                {errors.socket_timeout && (
                  <p className="text-sm text-red-500">{errors.socket_timeout}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Time to wait for socket operations (default: 60000ms)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting_timeout">Greeting Timeout (ms)</Label>
                <Input
                  id="greeting_timeout"
                  type="number"
                  value={formData.greeting_timeout}
                  onChange={(e) => handleInputChange('greeting_timeout', e.target.value)}
                  placeholder="30000"
                  className={errors.greeting_timeout ? 'border-red-500' : ''}
                />
                {errors.greeting_timeout && (
                  <p className="text-sm text-red-500">{errors.greeting_timeout}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Time to wait for server greeting (default: 30000ms)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_emails_per_day">Daily Email Limit</Label>
                <Input
                  id="max_emails_per_day"
                  type="number"
                  value={formData.max_emails_per_day}
                  onChange={(e) => handleInputChange('max_emails_per_day', e.target.value)}
                  placeholder="100"
                  className={errors.max_emails_per_day ? 'border-red-500' : ''}
                />
                {errors.max_emails_per_day && (
                  <p className="text-sm text-red-500">{errors.max_emails_per_day}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Maximum number of emails that can be sent per day using this configuration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_recipients_per_email">Recipients Per Email Limit</Label>
                <Input
                  id="max_recipients_per_email"
                  type="number"
                  value={formData.max_recipients_per_email}
                  onChange={(e) => handleInputChange('max_recipients_per_email', e.target.value)}
                  placeholder="50"
                  className={errors.max_recipients_per_email ? 'border-red-500' : ''}
                />
                {errors.max_recipients_per_email && (
                  <p className="text-sm text-red-500">{errors.max_recipients_per_email}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Maximum number of recipients (To + CC + BCC) per email
                </p>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Rate Limiting:</strong> These limits help prevent abuse and ensure compliance with 
                  email provider policies. Individual agents can have more restrictive limits set in their permissions.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                {editingConfig ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                {editingConfig ? 'Update Configuration' : 'Create Configuration'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SMTPSetupModal;
