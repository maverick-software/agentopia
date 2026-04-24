import React from 'react';
import { cn } from '@/lib/utils';

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function OptionButton({ selected, onClick, children, disabled = false }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-2 text-sm rounded-lg border transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50',
        selected ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-background text-muted-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

