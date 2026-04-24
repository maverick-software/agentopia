import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { adminServiceProviders } from '@/lib/adminServiceProviders';
import { hiddenProviders } from './constants';
import type { OAuthProvider, OAuthProviderFormData } from './types';

const initialFormData: OAuthProviderFormData = {
  name: '',
  display_name: '',
  authorization_endpoint: '',
  token_endpoint: '',
  revoke_endpoint: '',
  discovery_endpoint: '',
  scopes_supported: '[]',
  pkce_required: true,
  client_credentials_location: 'header',
  configuration_metadata: '{}',
  status: 'true',
};

export function useAdminIntegrationManagement() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<OAuthProvider | null>(null);
  const [formData, setFormData] = useState<OAuthProviderFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    try {
      const data = await adminServiceProviders.list();
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching oauth providers:', error);
      toast.error('Failed to load OAuth providers');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedProvider(null);
  };

  const handleEdit = (provider: OAuthProvider) => {
    setSelectedProvider(provider);
    setFormData({
      name: provider.name,
      display_name: provider.display_name,
      authorization_endpoint: provider.authorization_endpoint,
      token_endpoint: provider.token_endpoint,
      revoke_endpoint: provider.revoke_endpoint || '',
      discovery_endpoint: provider.discovery_endpoint || '',
      scopes_supported: JSON.stringify(provider.scopes_supported, null, 2),
      pkce_required: provider.pkce_required,
      client_credentials_location: provider.client_credentials_location,
      configuration_metadata: JSON.stringify(provider.configuration_metadata, null, 2),
      status: provider.is_enabled ? 'true' : 'false',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;

    try {
      await adminServiceProviders.delete(selectedProvider.id);
      toast.success('OAuth provider deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedProvider(null);
      fetchProviders();
    } catch (error) {
      console.error('Error deleting OAuth provider:', error);
      toast.error('Failed to delete OAuth provider');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      toast.error('Name and display name are required');
      return false;
    }

    try {
      setSaving(true);

      let scopesSupported: string[] = [];
      if (formData.scopes_supported.trim()) {
        try {
          scopesSupported = JSON.parse(formData.scopes_supported);
        } catch {
          toast.error('Invalid JSON in scopes supported');
          return false;
        }
      }

      let configMetadata: Record<string, any> = {};
      if (formData.configuration_metadata.trim()) {
        try {
          configMetadata = JSON.parse(formData.configuration_metadata);
        } catch {
          toast.error('Invalid JSON in configuration metadata');
          return false;
        }
      }

      const payload = {
        name: formData.name,
        display_name: formData.display_name,
        authorization_endpoint: formData.authorization_endpoint,
        token_endpoint: formData.token_endpoint,
        revoke_endpoint: formData.revoke_endpoint || null,
        discovery_endpoint: formData.discovery_endpoint || null,
        scopes_supported: scopesSupported,
        pkce_required: formData.pkce_required,
        client_credentials_location: formData.client_credentials_location,
        is_enabled: formData.status === 'true',
        configuration_metadata: configMetadata,
      };

      if (selectedProvider) {
        await adminServiceProviders.update(selectedProvider.id, payload);
      } else {
        await adminServiceProviders.create(payload);
      }

      toast.success(
        selectedProvider ? 'OAuth provider updated successfully' : 'OAuth provider created successfully'
      );
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
      fetchProviders();
      return true;
    } catch (error) {
      console.error('Error saving OAuth provider:', error);
      toast.error('Failed to save OAuth provider');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (hiddenProviders.includes(provider.name.toLowerCase())) return false;

      const matchesSearch =
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.display_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && provider.is_enabled) ||
        (statusFilter === 'disabled' && !provider.is_enabled);

      return matchesSearch && matchesStatus;
    });
  }, [providers, searchTerm, statusFilter]);

  return {
    providers,
    loading,
    searchTerm,
    statusFilter,
    isAddDialogOpen,
    isEditDialogOpen,
    isDeleteDialogOpen,
    selectedProvider,
    formData,
    saving,
    filteredProviders,
    setSearchTerm,
    setStatusFilter,
    setIsAddDialogOpen,
    setIsEditDialogOpen,
    setIsDeleteDialogOpen,
    setSelectedProvider,
    setFormData,
    fetchProviders,
    resetForm,
    handleEdit,
    handleDelete,
    handleSubmit,
  };
}
