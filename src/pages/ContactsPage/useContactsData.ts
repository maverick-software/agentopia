import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Contact, ContactGroup, ContactStats } from './types';
import { calculateContactStats, createContactsCsv, defaultContactStats } from './utils';

interface UseContactsDataParams {
  userId?: string;
}

export function useContactsData({ userId }: UseContactsDataParams) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [stats, setStats] = useState<ContactStats>(defaultContactStats);

  const loadContactData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          display_name,
          first_name,
          last_name,
          organization,
          job_title,
          contact_type,
          contact_status,
          tags,
          created_at,
          last_contacted_at
        `)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('display_name');

      if (contactsError) throw contactsError;

      const processedContacts = await Promise.all(
        (contactsData || []).map(async (contact: any) => {
          const { data: channels } = await supabase
            .from('contact_communication_channels')
            .select('channel_type, channel_identifier, is_primary, is_active')
            .eq('contact_id', contact.id)
            .eq('is_active', true);

          const channelsArray = channels || [];
          const primaryEmail = channelsArray.find(
            (channel: any) => channel.channel_type === 'email' && channel.is_primary
          )?.channel_identifier;
          const primaryPhone = channelsArray.find(
            (channel: any) => channel.channel_type === 'phone' && channel.is_primary
          )?.channel_identifier;

          const { count: interactionCount } = await supabase
            .from('contact_interactions')
            .select('*', { count: 'exact', head: true })
            .eq('contact_id', contact.id);

          return {
            ...contact,
            primary_email: primaryEmail,
            primary_phone: primaryPhone,
            interaction_count: interactionCount || 0,
          } as Contact;
        })
      );

      setContacts(processedContacts);
      setStats(calculateContactStats(processedContacts));
    } catch (error: any) {
      console.error('Error loading contact data:', error);
      toast.error('Failed to load contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadContactGroups = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('contact_groups')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (groupsError) throw groupsError;
      setContactGroups(groupsData || []);
    } catch (error: any) {
      console.error('Error loading contact groups:', error);
    }
  }, [userId]);

  const deleteContact = useCallback(
    async (contactId: string) => {
      if (!userId) return;
      if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
        return;
      }

      try {
        const { error } = await supabase.rpc('gdpr_delete_contact', {
          p_contact_id: contactId,
          p_user_id: userId,
          p_deletion_reason: 'User requested deletion',
        });

        if (error) throw error;

        toast.success('Contact deleted successfully.');
        await loadContactData();
      } catch (error: any) {
        console.error('Error deleting contact:', error);
        toast.error('Failed to delete contact. Please try again.');
      }
    },
    [loadContactData, userId]
  );

  const exportContacts = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          display_name,
          first_name,
          last_name,
          organization,
          job_title,
          contact_type,
          tags,
          created_at,
          contact_communication_channels (
            channel_type,
            channel_identifier,
            is_primary
          )
        `)
        .eq('user_id', userId)
        .eq('contact_status', 'active')
        .is('deleted_at', null);

      if (error) throw error;

      const csvContent = createContactsCsv(data || []);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Contacts exported successfully.');
    } catch (error: any) {
      console.error('Error exporting contacts:', error);
      toast.error('Failed to export contacts. Please try again.');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadContactData();
    loadContactGroups();
  }, [userId, loadContactData, loadContactGroups]);

  return {
    loading,
    contacts,
    contactGroups,
    stats,
    loadContactData,
    deleteContact,
    exportContacts,
  };
}
