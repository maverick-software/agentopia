import { supabase } from '../supabase'; // Adjust path if necessary
import type { Session } from '@supabase/supabase-js';

// TODO: Move these types to a shared types file e.g., src/types/api.ts or src/types/toolboxes.ts
export type AccountToolEnvironmentStatus = 
  | "inactive"
  | "pending_creation"
  | "creating"
  | "active"
  | "error_creation"
  | "pending_deletion"
  | "deleting"
  | "error_deletion"
  | "unresponsive"
  | "scaling"
  | "pending_provision"
  | "provisioning"
  | "error_provisioning"
  | "pending_deprovision"
  | "deprovisioning"
  | "deprovisioned"
  | "error_deprovisioning";

export interface AccountToolEnvironmentRecord {
  id: string;
  name: string | null;
  do_droplet_name?: string | null; // Actual name assigned by DigitalOcean
  description: string | null;
  status: AccountToolEnvironmentStatus;
  region_slug: string;
  size_slug: string;
  public_ip_address: string | null;
  created_at: string;
  updated_at: string;
  do_droplet_id: number | null;
  provisioning_error_message: string | null;
  user_id: string; // Ensure this is part of the record if needed client-side, though often just for DB
  dtma_bearer_token?: string | null; // Optional fields from DB schema
  dtma_health_details_json?: any | null;
  dtma_last_known_version?: string | null;
  image_slug?: string;
  last_heartbeat_at?: string | null;
}

export interface ProvisionToolboxPayload {
  name: string;
  description?: string;
  regionSlug: string;
  sizeSlug: string;
  imageSlug?: string; // Optional, service provides default
}

const getApiUrl = (path: string) => {
  // Use the proper Supabase functions URL pattern like other parts of the app
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
  }
  return `${supabaseUrl}/functions/v1/toolboxes-user${path}`;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('User not authenticated or session expired.');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export const listToolboxes = async (): Promise<AccountToolEnvironmentRecord[]> => {
  const { data, error } = await supabase.functions.invoke('toolboxes-user', { method: 'GET' });
  if (error) {
    console.error('Error listing toolboxes:', error);
    throw new Error(error.message || 'Failed to list toolboxes.');
  }
  return (data as AccountToolEnvironmentRecord[]) || [];
};

export const provisionToolbox = async (payload: ProvisionToolboxPayload): Promise<AccountToolEnvironmentRecord> => {
  const { data, error } = await supabase.functions.invoke('toolboxes-user', {
    method: 'POST',
    body: payload,
  });
  if (error) {
    console.error('Error provisioning toolbox:', error);
    const message = (error as any).details || (error as any).message || 'Failed to provision toolbox.';
    throw new Error(message);
  }
  return data as AccountToolEnvironmentRecord;
};

export const deprovisionToolbox = async (toolboxId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const response = await fetch(getApiUrl(`/${toolboxId}`), {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    console.error('Error deprovisioning toolbox:', errorData);
    throw new Error(errorData.message || `Failed to deprovision toolbox. Status: ${response.status}`);
  }
  // DELETE often returns 204 No Content, so no JSON body to parse on success.
};

export const refreshToolboxStatus = async (toolboxId: string): Promise<AccountToolEnvironmentRecord> => {
  const headers = await getAuthHeaders();
  const response = await fetch(getApiUrl(`/${toolboxId}/refresh-status`), {
    method: 'POST',
    headers,
    body: JSON.stringify({}), // Empty body for POST if required by server, or omit if not
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    console.error('Error refreshing toolbox status:', errorData);
    throw new Error(errorData.message || `Failed to refresh toolbox status. Status: ${response.status}`);
  }
  return response.json() as Promise<AccountToolEnvironmentRecord>; 
};

// Optional: Function to get a single toolbox by ID if needed by UI later
export const getToolboxById = async (toolboxId: string): Promise<AccountToolEnvironmentRecord | null> => {
  // This would also use fetch with the path `/${toolboxId}` and method GET
  const headers = await getAuthHeaders();
  const response = await fetch(getApiUrl(`/${toolboxId}`), {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    if (response.status === 404) return null; // Handle not found gracefully
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    console.error('Error fetching toolbox by ID:', errorData);
    throw new Error(errorData.message || `Failed to fetch toolbox. Status: ${response.status}`);
  }
  return response.json() as Promise<AccountToolEnvironmentRecord>;
};

// New types for DigitalOcean options
export interface DORegionOption {
    slug: string;
    name: string;
    available: boolean;
    features?: string[];
    sizes?: string[];
}

export interface DOSizeOption {
    slug: string;
    memory: number;
    vcpus: number;
    disk: number;
    transfer: number;
    price_monthly: number;
    price_hourly: number;
    regions: string[];
    available: boolean;
    description: string;
}

const getDOOptionsApiUrl = (path: string) => {
  // Use the proper Supabase functions URL pattern like other parts of the app
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
  }
  return `${supabaseUrl}/functions/v1/digitalocean-options${path}`;
};

export const listDORegions = async (): Promise<DORegionOption[]> => {
    // No auth typically needed for listing general options, but if it were, use getAuthHeaders()
    // const headers = await getAuthHeaders(); 
    const response = await fetch(getDOOptionsApiUrl('/regions'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }, // Add other headers if needed
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('Error fetching DigitalOcean regions:', errorData);
        throw new Error(errorData.message || `Failed to fetch DO regions. Status: ${response.status}`);
    }
    return response.json() as Promise<DORegionOption[]>;
};

export const listDOSizes = async (): Promise<DOSizeOption[]> => {
    // const headers = await getAuthHeaders(); 
    const response = await fetch(getDOOptionsApiUrl('/sizes'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }, 
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('Error fetching DigitalOcean sizes:', errorData);
        throw new Error(errorData.message || `Failed to fetch DO sizes. Status: ${response.status}`);
    }
    return response.json() as Promise<DOSizeOption[]>;
}; 