import type { Contact, ContactStats } from './types';

export const defaultContactStats: ContactStats = {
  total: 0,
  active: 0,
  recent: 0,
  withEmail: 0,
  withPhone: 0,
};

export function calculateContactStats(contacts: Contact[]): ContactStats {
  const total = contacts.length;
  const active = contacts.filter((contact) => contact.contact_status === 'active').length;
  const recent = contacts.filter((contact) => {
    const createdDate = new Date(contact.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return createdDate > thirtyDaysAgo;
  }).length;
  const withEmail = contacts.filter((contact) => !!contact.primary_email).length;
  const withPhone = contacts.filter((contact) => !!contact.primary_phone).length;

  return { total, active, recent, withEmail, withPhone };
}

export function filterAndSortContacts(
  contacts: Contact[],
  searchQuery: string,
  filterType: string,
  sortBy: string
): Contact[] {
  return contacts
    .filter((contact) => {
      const searchMatch =
        searchQuery === '' ||
        contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.organization && contact.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.job_title && contact.job_title.toLowerCase().includes(searchQuery.toLowerCase()));

      const typeMatch = filterType === 'all' || contact.contact_type === filterType;
      return searchMatch && typeMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.display_name.localeCompare(b.display_name);
        case 'organization':
          return (a.organization || '').localeCompare(b.organization || '');
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'contacted': {
          const aDate = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const bDate = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          return bDate - aDate;
        }
        default:
          return 0;
      }
    });
}

export function createContactsCsv(data: any[]): string {
  const csvHeaders = [
    'Name',
    'First Name',
    'Last Name',
    'Organization',
    'Job Title',
    'Type',
    'Tags',
    'Email',
    'Phone',
    'Created',
  ];

  const csvRows = data.map((contact: any) => {
    const channels = contact.contact_communication_channels || [];
    const email =
      channels.find((channel: any) => channel.channel_type === 'email' && channel.is_primary)
        ?.channel_identifier || '';
    const phone =
      channels.find((channel: any) => channel.channel_type === 'phone' && channel.is_primary)
        ?.channel_identifier || '';

    return [
      contact.display_name,
      contact.first_name,
      contact.last_name || '',
      contact.organization || '',
      contact.job_title || '',
      contact.contact_type,
      contact.tags.join('; '),
      email,
      phone,
      new Date(contact.created_at).toLocaleDateString(),
    ];
  });

  return [csvHeaders, ...csvRows].map((row) => row.map((field) => `"${field}"`).join(',')).join('\n');
}
