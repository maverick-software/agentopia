export interface Contact {
  id: string;
  display_name: string;
  first_name: string;
  last_name?: string;
  organization?: string;
  job_title?: string;
  contact_type: string;
  contact_status: string;
  tags: string[];
  primary_email?: string;
  primary_phone?: string;
  last_contacted_at?: string;
  created_at: string;
  interaction_count?: number;
}

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  group_type: string;
  member_count: number;
  color: string;
  icon: string;
}

export interface ContactStats {
  total: number;
  active: number;
  recent: number;
  withEmail: number;
  withPhone: number;
}
