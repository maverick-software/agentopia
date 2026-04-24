export function providerNameForServiceId(serviceId: string): string {
  return serviceId;
}

export function defaultScopesForService(serviceId: string): string[] {
  if (serviceId === 'smtp') {
    return ['smtp_send_email', 'smtp_email_templates', 'smtp_email_stats'];
  }

  return [];
}
