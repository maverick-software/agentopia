export function providerNameForServiceId(serviceId: string): string {
  switch (serviceId) {
    case 'gmail':
      return 'gmail';
    case 'sendgrid':
      return 'sendgrid';
    case 'mailgun':
      return 'mailgun';
    default:
      return serviceId;
  }
}

export function defaultScopesForService(serviceId: string): string[] {
  if (serviceId === 'gmail') {
    return [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ];
  }

  if (serviceId === 'sendgrid') {
    return ['sendgrid_send_email', 'sendgrid_email_templates', 'sendgrid_email_stats'];
  }

  if (serviceId === 'mailgun') {
    return [
      'mailgun_send_email',
      'mailgun_email_templates',
      'mailgun_email_stats',
      'mailgun_email_validation',
      'mailgun_suppression_management',
    ];
  }

  if (serviceId === 'smtp') {
    return ['smtp_send_email', 'smtp_email_templates', 'smtp_email_stats'];
  }

  return [];
}
