import { Edit, Mail, MessageSquare, Phone, Trash2, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from './types';

interface ContactsListProps {
  loading: boolean;
  contacts: Contact[];
  searchQuery: string;
  filterType: string;
  selectedContacts: Set<string>;
  onToggleSelection: (contactId: string, checked: boolean) => void;
  onAddContact: () => void;
  onDeleteContact: (contactId: string) => void;
}

export function ContactsList({
  loading,
  contacts,
  searchQuery,
  filterType,
  selectedContacts,
  onToggleSelection,
  onAddContact,
  onDeleteContact,
}: ContactsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Contacts ({contacts.length})
          </span>
          {selectedContacts.size > 0 && <Badge variant="secondary">{selectedContacts.size} selected</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No contacts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first contact'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <Button onClick={onAddContact}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedContacts.has(contact.id)}
                    onChange={(event) => onToggleSelection(contact.id, event.target.checked)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{contact.display_name}</h4>
                      <Badge
                        variant={
                          contact.contact_type === 'internal'
                            ? 'default'
                            : contact.contact_type === 'customer'
                              ? 'secondary'
                              : contact.contact_type === 'prospect'
                                ? 'outline'
                                : 'secondary'
                        }
                      >
                        {contact.contact_type}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contact.organization && <span>{contact.organization}</span>}
                      {contact.organization && contact.job_title && <span> • </span>}
                      {contact.job_title && <span>{contact.job_title}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      {contact.primary_email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{contact.primary_email}</span>
                        </div>
                      )}
                      {contact.primary_phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{contact.primary_phone}</span>
                        </div>
                      )}
                      {(contact.interaction_count || 0) > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="w-3 h-3" />
                          <span>{contact.interaction_count} interactions</span>
                        </div>
                      )}
                    </div>
                    {contact.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {contact.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{contact.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteContact(contact.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
