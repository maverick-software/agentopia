'use client';

import React from 'react';
import { User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MemberSelectorProps {
  value?: string | null; // member ID
  onChange: (memberId: string | null) => void;
  disabled?: boolean;
  className?: string;
  error?: string;
  placeholder?: string;
}

// Mock data - this will be replaced with real data later
const MOCK_MEMBERS = [
  { id: '1', name: 'John Doe', email: 'john@example.com', avatar: null },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', avatar: null },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', avatar: null }
];

export function MemberSelector({
  value,
  onChange,
  disabled = false,
  className,
  error,
  placeholder = 'Select assignee'
}: MemberSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedMember = value ? MOCK_MEMBERS.find(m => m.id === value) : null;

  const handleSelect = (memberId: string | null) => {
    onChange(memberId);
    setIsOpen(false);
  };

  const MemberOption = ({ member, onSelect }: { 
    member: typeof MOCK_MEMBERS[0]; 
    onSelect: () => void;
  }) => (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-sm transition-colors text-left"
    >
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
        <User className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{member.name}</div>
        <div className="text-xs text-muted-foreground truncate">{member.email}</div>
      </div>
    </button>
  );

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedMember && 'text-muted-foreground',
              error && 'border-destructive',
              className
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedMember ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="truncate">{selectedMember.name}</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{placeholder}</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1 bg-card border border-border" align="start">
          <div className="space-y-1">
            {/* Clear selection option */}
            <button
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-sm transition-colors text-left text-muted-foreground"
            >
              <User className="h-4 w-4" />
              <span>No assignee</span>
            </button>
            
            {/* Member options */}
            <div className="border-t border-border my-1" />
            {MOCK_MEMBERS.map((member) => (
              <MemberOption 
                key={member.id}
                member={member} 
                onSelect={() => handleSelect(member.id)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

// Utility component for displaying member info in read-only contexts
export function MemberDisplay({ 
  memberId, 
  className,
  showIcon = true 
}: { 
  memberId: string | null | undefined; 
  className?: string;
  showIcon?: boolean;
}) {
  const member = memberId ? MOCK_MEMBERS.find(m => m.id === memberId) : null;

  if (!member) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-muted-foreground text-sm',
        className
      )}>
        {showIcon && <User className="h-3 w-3" />}
        Not assigned
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-2 text-sm',
      className
    )}>
      {showIcon && (
        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
          <User className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}
      <span className="truncate">{member.name}</span>
    </span>
  );
} 