'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EstimatedHoursInputProps {
  value?: number | null;
  onChange: (hours: number | null) => void;
  disabled?: boolean;
  className?: string;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function EstimatedHoursInput({
  value,
  onChange,
  disabled = false,
  className,
  error,
  placeholder = '0',
  min = 0.25, // 15 minutes minimum
  max = 1000
}: EstimatedHoursInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Sync input value when prop changes
  useEffect(() => {
    if (value !== null && value !== undefined) {
      setInputValue(value.toString());
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Parse and validate the input
    if (newValue === '') {
      onChange(null);
      return;
    }

    const parsed = parseFloat(newValue);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    } else if (!isNaN(parsed)) {
      // Value is out of range, but still update the display
      // The error will be shown by validation
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Clean up the input value on blur
    if (value !== null && value !== undefined) {
      setInputValue(value.toString());
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    } else if (hours < 8) {
      return `${hours}h`;
    } else {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      if (remainingHours === 0) {
        return `${days}d`;
      } else {
        return `${days}d ${remainingHours}h`;
      }
    }
  };

  const getValidationError = () => {
    if (!value) return null;
    
    if (value < min) {
      return `Minimum is ${min} hours (${formatDuration(min)})`;
    }
    if (value > max) {
      return `Maximum is ${max} hours`;
    }
    return null;
  };

  const validationError = getValidationError();

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          step="0.25"
          className={cn(
            'pl-10 pr-16',
            (error || validationError) && 'border-destructive',
            className
          )}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <span className="text-sm text-muted-foreground">hrs</span>
        </div>
      </div>
      
      {/* Display human-readable duration when not focused and has value */}
      {!isFocused && value && value > 0 && (
        <div className="text-xs text-muted-foreground mt-1 px-1">
          {formatDuration(value)}
        </div>
      )}
      
      {/* Show validation error or custom error */}
      {(validationError || error) && (
        <p className="text-sm text-destructive mt-1">
          {validationError || error}
        </p>
      )}
    </div>
  );
}

// Utility component for displaying duration in read-only contexts
export function DurationDisplay({ 
  hours, 
  className,
  showIcon = true 
}: { 
  hours: number | null | undefined; 
  className?: string;
  showIcon?: boolean;
}) {
  if (!hours || hours <= 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-muted-foreground text-sm',
        className
      )}>
        {showIcon && <Clock className="h-3 w-3" />}
        Not set
      </span>
    );
  }

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    } else if (hours < 8) {
      return `${hours}h`;
    } else {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      if (remainingHours === 0) {
        return `${days}d`;
      } else {
        return `${days}d ${remainingHours}h`;
      }
    }
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-sm',
      className
    )}>
      {showIcon && <Clock className="h-3 w-3" />}
      {formatDuration(hours)}
    </span>
  );
} 