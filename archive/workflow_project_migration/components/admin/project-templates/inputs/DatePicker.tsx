'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string | null; // ISO date string (YYYY-MM-DD)
  onChange: (date: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  disablePastDates?: boolean;
  className?: string;
  error?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  disablePastDates = false,
  className,
  error
}: DatePickerProps) {
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue || null);
  };

  const handleClear = () => {
    onChange(null);
  };

  const minDate = disablePastDates ? new Date().toISOString().split('T')[0] : undefined;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          type="date"
          value={value || ''}
          onChange={handleDateChange}
          disabled={disabled}
          min={minDate}
          className={cn(
            value && !disabled && 'pr-8', // Add padding for clear button when date is selected
            error && 'border-destructive',
            className
          )}
        />
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
} 