export const mapOAuthScopesToAgentCapabilities = (oauthScopes: string[], providerName: string): string[] => {
  if (providerName === 'gmail') {
    const capabilities: string[] = [];
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.send')) capabilities.push('email.send');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.readonly')) capabilities.push('email.read');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.modify')) capabilities.push('email.modify');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.compose')) capabilities.push('email.compose');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.insert')) capabilities.push('email.insert');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.labels')) capabilities.push('email.labels');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.metadata')) capabilities.push('email.metadata');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.settings.basic')) capabilities.push('email.settings.basic');
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.settings.sharing')) capabilities.push('email.settings.sharing');
    if (oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email')) capabilities.push('profile.email');
    if (oauthScopes.includes('https://www.googleapis.com/auth/userinfo.profile')) capabilities.push('profile.info');
    if (oauthScopes.includes('openid')) capabilities.push('openid');
    if (oauthScopes.includes('email')) capabilities.push('profile.email');
    if (oauthScopes.includes('profile')) capabilities.push('profile.info');
    return capabilities.length > 0 ? capabilities : ['email.send'];
  }

  if (providerName === 'microsoft-outlook') {
    const capabilities: string[] = [];
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.Send')) capabilities.push('email.send');
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.Read')) capabilities.push('email.read');
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.ReadWrite')) capabilities.push('email.read', 'email.modify');
    if (oauthScopes.includes('https://graph.microsoft.com/Calendars.Read')) capabilities.push('calendar.read');
    if (oauthScopes.includes('https://graph.microsoft.com/Calendars.ReadWrite')) capabilities.push('calendar.read', 'calendar.write');
    if (oauthScopes.includes('https://graph.microsoft.com/Contacts.Read')) capabilities.push('contacts.read');
    if (oauthScopes.includes('https://graph.microsoft.com/Contacts.ReadWrite')) capabilities.push('contacts.read', 'contacts.write');
    if (oauthScopes.includes('https://graph.microsoft.com/User.Read')) capabilities.push('profile.info');
    return capabilities.length > 0 ? capabilities : ['email.send'];
  }

  if (providerName === 'clicksend_sms') {
    const capabilities: string[] = [];
    if (oauthScopes.includes('sms') || oauthScopes.includes('sms.send')) capabilities.push('clicksend_send_sms');
    if (oauthScopes.includes('mms') || oauthScopes.includes('mms.send')) capabilities.push('clicksend_send_mms');
    if (oauthScopes.includes('balance') || oauthScopes.includes('account.balance')) capabilities.push('clicksend_get_balance');
    if (oauthScopes.includes('history') || oauthScopes.includes('sms.history')) capabilities.push('clicksend_get_sms_history');
    if (oauthScopes.includes('delivery_receipts') || oauthScopes.includes('sms.delivery')) capabilities.push('clicksend_get_delivery_receipts');
    return capabilities.length > 0 ? capabilities : ['clicksend_send_sms', 'clicksend_send_mms'];
  }

  if (providerName === 'twilio') return ['sms.send', 'sms.receive'];
  if (providerName === 'aws_sns') return ['sms.send'];
  if (providerName === 'smtp' || providerName === 'sendgrid' || providerName === 'mailgun') return ['email.send'];
  return ['email.send'];
};
