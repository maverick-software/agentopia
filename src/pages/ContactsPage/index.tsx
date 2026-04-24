import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ContactImportModal from '@/components/modals/ContactImportModal';
import AddContactModal from '@/components/modals/AddContactModal';
import { ContactsFilters } from './ContactsFilters';
import { ContactsHeader } from './ContactsHeader';
import { ContactsList } from './ContactsList';
import { ContactsStats } from './ContactsStats';
import { useContactsData } from './useContactsData';
import { filterAndSortContacts } from './utils';

export default function ContactsPageView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  const { loading, contacts, stats, loadContactData, deleteContact, exportContacts } = useContactsData({
    userId: user?.id,
  });

  const filteredContacts = useMemo(
    () => filterAndSortContacts(contacts, searchQuery, filterType, sortBy),
    [contacts, searchQuery, filterType, sortBy]
  );

  const toggleSelectedContact = (contactId: string, checked: boolean) => {
    const nextSelected = new Set(selectedContacts);
    if (checked) {
      nextSelected.add(contactId);
    } else {
      nextSelected.delete(contactId);
    }
    setSelectedContacts(nextSelected);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSortBy('name');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ContactsHeader
        onImport={() => setShowImportModal(true)}
        onExport={exportContacts}
        onAddContact={() => setShowAddContactModal(true)}
      />

      <ContactsStats stats={stats} />

      <ContactsFilters
        searchQuery={searchQuery}
        filterType={filterType}
        sortBy={sortBy}
        onSearchQueryChange={setSearchQuery}
        onFilterTypeChange={setFilterType}
        onSortByChange={setSortBy}
        onClear={clearFilters}
      />

      <ContactsList
        loading={loading}
        contacts={filteredContacts}
        searchQuery={searchQuery}
        filterType={filterType}
        selectedContacts={selectedContacts}
        onToggleSelection={toggleSelectedContact}
        onAddContact={() => setShowAddContactModal(true)}
        onDeleteContact={deleteContact}
      />

      <ContactImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          loadContactData();
        }}
      />

      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onContactAdded={() => {
          setShowAddContactModal(false);
          loadContactData();
        }}
      />
    </div>
  );
}
