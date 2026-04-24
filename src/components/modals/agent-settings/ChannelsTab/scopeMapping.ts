export const mapOAuthScopesToAgentCapabilities = (oauthScopes: string[], providerName: string): string[] => {
  if (providerName === 'twilio') return ['sms.send', 'sms.receive'];
  if (providerName === 'aws_sns') return ['sms.send'];
  if (providerName === 'smtp') return ['email.send'];
  return ['email.send'];
};
