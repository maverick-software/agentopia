import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Settings, 
  Eye,
  EyeOff,
  Shield,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Agent {
  id: string;
  name: string;
  user_id: string;
}

interface Contact {
  id: string;
  display_name: string;
  organization?: string;
  job_title?: string;
  contact_type: string;
  contact_status: string;
  tags: string[];
  primary_email?: string;
  primary_phone?: string;
  last_contacted_at?: string;
  created_at: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  group_type: string;
  member_count: number;
  color: string;
  icon: string;
}

interface AgentPermission {
  id: string;
  permission_type: string;
  can_view: boolean;
  can_contact: boolean;
  can_edit: boolean;
  can_delete: boolean;
  expires_at?: string;
  total_contacts_accessed: number;
  specific_contacts_count: number;
  accessible_groups_count: number;
}

interface ContactsTabProps {
  agent: Agent;
}

export default function ContactsTab({ agent }: ContactsTabProps) {
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [agentPermission, setAgentPermission] = useState<AgentPermission | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('permissions');

  // Permission settings state
  const [permissionSettings, setPermissionSettings] = useState({
    permission_type: 'no_access' as 'all_contacts' | 'specific_contacts' | 'contact_groups' | 'no_access',
    can_view: true,
    can_contact: true,
    can_edit: false,
    can_delete: false,
    expires_at: '',
    allowed_channels: [] as string[],
    restricted_channels: [] as string[]
  });

  // Communication channels
  const communicationChannels = [
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'telegram', label: 'Telegram', icon: MessageSquare },
    { value: 'slack', label: 'Slack', icon: MessageSquare },
    { value: 'discord', label: 'Discord', icon: MessageSquare }
  ];

  // Load initial data
  useEffect(() => {
    if (user && agent) {
      loadContactData();
      loadAgentPermissions();
    }
  }, [user, agent]);

  const loadContactData = async () => {
    setLoading(true);
    try {
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          display_name,
          organization,
          job_title,
          contact_type,
          contact_status,
          tags,
          created_at,
          last_contacted_at
        `)
        .eq('user_id', user.id)
        .eq('contact_status', 'active')
        .is('deleted_at', null)
        .order('display_name');

      if (contactsError) throw contactsError;

      // Process contacts to extract primary email/phone
      const processedContacts = await Promise.all(
        contactsData.map(async (contact: any) => {
          // Load channels separately
          const { data: channels } = await supabase
            .from('contact_communication_channels')
            .select('channel_type, channel_identifier, is_primary')
            .eq('contact_id', contact.id)
            .eq('is_active', true);

          const channelsArray = channels || [];
          const primaryEmail = channelsArray.find((c: any) => c.channel_type === 'email' && c.is_primary)?.channel_identifier;
          const primaryPhone = channelsArray.find((c: any) => c.channel_type === 'phone' && c.is_primary)?.channel_identifier;
          
          return {
            ...contact,
            primary_email: primaryEmail,
            primary_phone: primaryPhone
          };
        })
      );

      setContacts(processedContacts);

      // Load contact groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('contact_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (groupsError) throw groupsError;
      setContactGroups(groupsData || []);

    } catch (error: any) {
      console.error('Error loading contact data:', error);
      toast.error('Failed to load contact data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentPermissions = async () => {
    try {
      const { data: permissionData, error } = await supabase
        .from('agent_contact_permissions')
        .select('*')
        .eq('agent_id', agent.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (permissionData) {
        setAgentPermission(permissionData);
        setPermissionSettings({
          permission_type: permissionData.permission_type || 'all_contacts',
          can_view: permissionData.can_view ?? true,
          can_contact: permissionData.can_contact ?? true,
          can_edit: permissionData.can_edit ?? false,
          can_delete: permissionData.can_delete ?? false,
          expires_at: permissionData.expires_at || '',
          allowed_channels: permissionData.allowed_channels || [],
          restricted_channels: permissionData.restricted_channels || []
        });
      } else {
        // Set default permissions if none exist
        setPermissionSettings({
          permission_type: 'all_contacts',
          can_view: true,
          can_contact: true,
          can_edit: false,
          can_delete: false,
          expires_at: '',
          allowed_channels: [],
          restricted_channels: []
        });
      }
    } catch (error: any) {
      console.error('Error loading agent permissions:', error);
      // Set defaults on error
      setPermissionSettings({
        permission_type: 'all_contacts',
        can_view: true,
        can_contact: true,
        can_edit: false,
        can_delete: false,
        expires_at: '',
        allowed_channels: [],
        restricted_channels: []
      });
    }
  };

  const handleSavePermissions = async () => {
    setLoading(true);
    try {
      // Create or update agent permissions and get the record
      const { data: permissionData, error: permissionError } = await supabase
        .from('agent_contact_permissions')
        .upsert({
          agent_id: agent.id,
          user_id: user.id,
          permission_type: permissionSettings.permission_type,
          can_view: permissionSettings.can_view,
          can_contact: permissionSettings.can_contact,
          can_edit: permissionSettings.can_edit,
          can_delete: permissionSettings.can_delete,
          expires_at: permissionSettings.expires_at || null,
          allowed_channels: permissionSettings.allowed_channels,
          restricted_channels: permissionSettings.restricted_channels,
          granted_by_user_id: user.id,
          granted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'agent_id' // Specify the conflict resolution column
        })
        .select()
        .single();

      if (permissionError) throw permissionError;
      if (!permissionData) throw new Error('Failed to create/update permissions');

      // Handle specific contacts
      if (permissionSettings.permission_type === 'specific_contacts' && selectedContacts.size > 0) {
        const specificAccessData = Array.from(selectedContacts).map(contactId => ({
          agent_id: agent.id,
          contact_id: contactId,
          permission_id: permissionData.id, // Add the required permission_id
          user_id: user.id,
          access_level: 'view_and_contact'
        }));

        // Delete existing specific access
        await supabase
          .from('agent_specific_contact_access')
          .delete()
          .eq('agent_id', agent.id);

        // Insert new specific access
        const { error: specificError } = await supabase
          .from('agent_specific_contact_access')
          .insert(specificAccessData);

        if (specificError) throw specificError;
      }

      // Handle group access
      if (permissionSettings.permission_type === 'contact_groups' && selectedGroups.size > 0) {
        const groupAccessData = Array.from(selectedGroups).map(groupId => ({
          agent_id: agent.id,
          group_id: groupId,
          permission_id: permissionData.id, // Add the required permission_id
          user_id: user.id,
          access_level: 'view_and_contact'
        }));

        // Delete existing group access
        await supabase
          .from('agent_group_access')
          .delete()
          .eq('agent_id', agent.id);

        // Insert new group access
        const { error: groupError } = await supabase
          .from('agent_group_access')
          .insert(groupAccessData);

        if (groupError) throw groupError;
      }

      // Reload permissions
      await loadAgentPermissions();

      toast.success('Agent contact permissions updated successfully.');

    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.organization && contact.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (contact.job_title && contact.job_title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Contact Access</h3>
          <p className="text-sm text-muted-foreground">
            Manage {agent.name}'s access to your contact list
          </p>
        </div>
        <Button 
          onClick={handleSavePermissions} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Settings className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* Current Permission Status */}
      {agentPermission && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4" />
              Current Access Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {agentPermission.permission_type.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground">Permission Type</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {agentPermission.total_contacts_accessed}
                </div>
                <div className="text-xs text-muted-foreground">Contacts Accessed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {agentPermission.specific_contacts_count}
                </div>
                <div className="text-xs text-muted-foreground">Specific Access</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {agentPermission.accessible_groups_count}
                </div>
                <div className="text-xs text-muted-foreground">Group Access</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="contacts">Specific Contacts</TabsTrigger>
          <TabsTrigger value="groups">Contact Groups</TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Level</CardTitle>
              <CardDescription>
                Choose what level of access this agent should have to your contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="permission-type">Permission Type</Label>
                <Select
                  value={permissionSettings.permission_type}
                  onValueChange={(value: any) => 
                    setPermissionSettings(prev => ({ ...prev, permission_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select permission type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_access">No Access</SelectItem>
                    <SelectItem value="all_contacts">All Contacts</SelectItem>
                    <SelectItem value="specific_contacts">Specific Contacts</SelectItem>
                    <SelectItem value="contact_groups">Contact Groups</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {permissionSettings.permission_type !== 'no_access' && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="can-view"
                        checked={permissionSettings.can_view}
                        onCheckedChange={(checked) =>
                          setPermissionSettings(prev => ({ ...prev, can_view: checked }))
                        }
                      />
                      <Label htmlFor="can-view" className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Can View
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="can-contact"
                        checked={permissionSettings.can_contact}
                        onCheckedChange={(checked) =>
                          setPermissionSettings(prev => ({ ...prev, can_contact: checked }))
                        }
                      />
                      <Label htmlFor="can-contact" className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Can Contact
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="can-edit"
                        checked={permissionSettings.can_edit}
                        onCheckedChange={(checked) =>
                          setPermissionSettings(prev => ({ ...prev, can_edit: checked }))
                        }
                      />
                      <Label htmlFor="can-edit" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Can Edit
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="can-delete"
                        checked={permissionSettings.can_delete}
                        onCheckedChange={(checked) =>
                          setPermissionSettings(prev => ({ ...prev, can_delete: checked }))
                        }
                      />
                      <Label htmlFor="can-delete" className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4" />
                        Can Delete
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires-at">Access Expires (Optional)</Label>
                    <Input
                      id="expires-at"
                      type="datetime-local"
                      value={permissionSettings.expires_at}
                      onChange={(e) =>
                        setPermissionSettings(prev => ({ ...prev, expires_at: e.target.value }))
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Specific Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {permissionSettings.permission_type === 'specific_contacts' ? (
            <Card>
              <CardHeader>
                <CardTitle>Select Specific Contacts</CardTitle>
                <CardDescription>
                  Choose which contacts this agent can access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-2 p-2 border rounded hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contact.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedContacts);
                              if (e.target.checked) {
                                newSelected.add(contact.id);
                              } else {
                                newSelected.delete(contact.id);
                              }
                              setSelectedContacts(newSelected);
                            }}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{contact.display_name}</div>
                            {contact.organization && (
                              <div className="text-sm text-muted-foreground">
                                {contact.organization}
                              </div>
                            )}
                            {contact.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {contact.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {selectedContacts.size} of {filteredContacts.length} contacts selected
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select "Specific Contacts" permission type to choose individual contacts</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contact Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          {permissionSettings.permission_type === 'contact_groups' ? (
            <Card>
              <CardHeader>
                <CardTitle>Select Contact Groups</CardTitle>
                <CardDescription>
                  Choose which contact groups this agent can access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {contactGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center space-x-2 p-3 border rounded hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(group.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedGroups);
                          if (e.target.checked) {
                            newSelected.add(group.id);
                          } else {
                            newSelected.delete(group.id);
                          }
                          setSelectedGroups(newSelected);
                        }}
                      />
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: group.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{group.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {group.member_count} members • {group.group_type}
                        </div>
                        {group.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {group.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-sm text-muted-foreground mt-4">
                  {selectedGroups.size} of {contactGroups.length} groups selected
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select "Contact Groups" permission type to choose contact groups</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
