import { FileDown, FileUp, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactsHeaderProps {
  onImport: () => void;
  onExport: () => void;
  onAddContact: () => void;
}

export function ContactsHeader({ onImport, onExport, onAddContact }: ContactsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">Manage your contact list and communication channels</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onImport} className="flex items-center gap-2">
          <FileUp className="w-4 h-4" />
          Import
        </Button>
        <Button variant="outline" onClick={onExport} className="flex items-center gap-2">
          <FileDown className="w-4 h-4" />
          Export
        </Button>
        <Button onClick={onAddContact} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add Contact
        </Button>
      </div>
    </div>
  );
}
