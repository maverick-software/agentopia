import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase'; // Adjust path as needed
import { useAuth } from '@/contexts/AuthContext'; // Adjust path as needed

interface Client {
  id: string;
  name: string; 
  // Add other relevant client fields if needed for display
}

export const ClientSelector: React.FC = () => {
  const { activeClientId, setActiveClientIdAndFetchPermissions, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      if (user?.global_role !== 'SUPER_ADMIN' && user?.global_role !== 'SUPPORT_REPRESENTATIVE') {
        // Only fetch all clients if user is Super Admin or Support Rep
        // Other roles might have a different way to determine their relevant client(s)
        setClients([]);
        return;
      }

      setLoadingClients(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('clients')
          .select('id, name') // Fetching id and name, add more if needed
          .order('name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }
        setClients(data || []);
      } catch (e: any) {
        console.error('Error fetching clients:', e);
        setError('Failed to load clients.');
        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    if (user) { // Only fetch if user is loaded
        fetchClients();
    }
  }, [user]); // Re-fetch if user changes (e.g. logs in/out or role changes)

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = event.target.value;
    setActiveClientIdAndFetchPermissions(selectedId || null);
  };

  // Do not render the selector if the user is not a Super Admin or Support Rep, 
  // or if there are no clients to select (e.g. for a regular client user)
  if (user?.global_role !== 'SUPER_ADMIN' && user?.global_role !== 'SUPPORT_REPRESENTATIVE') {
    return null; 
  }
  
  if (loadingClients) {
    return <p>Loading clients...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  if (clients.length === 0 && (user?.global_role === 'SUPER_ADMIN' || user?.global_role === 'SUPPORT_REPRESENTATIVE')) {
    return <p>No clients found.</p>;
  }

  return (
    <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
      <h4>Select Client Context</h4>
      <select value={activeClientId || ''} onChange={handleChange} style={{ padding: '8px', minWidth: '200px' }}>
        <option value="">-- Select a Client --</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name} (ID: {client.id})
          </option>
        ))}
      </select>
      {activeClientId && <p style={{ marginTop: '5px' }}>Currently active client ID: {activeClientId}</p>}
    </div>
  );
}; 