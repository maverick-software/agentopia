import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MEMORY_PREFERENCES } from '../types';

interface MemoryPreferencesSectionProps {
  memoryPreferences: string[];
  onTogglePreference: (preferenceId: string) => void;
}

export const MemoryPreferencesSection: React.FC<MemoryPreferencesSectionProps> = ({
  memoryPreferences,
  onTogglePreference,
}) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">What should I remember from our chats?</Label>
      <div className="space-y-2">
        {MEMORY_PREFERENCES.map((preference) => {
          const isSelected = memoryPreferences.includes(preference.id);
          const isForgetSessions = preference.id === 'forget_sessions';
          return (
            <div
              key={preference.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? isForgetSessions
                    ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'
                    : 'border-primary bg-primary/5'
                  : 'border-border hover:border-border hover:bg-accent/50'
              }`}
              onClick={() => onTogglePreference(preference.id)}
            >
              <Switch
                checked={isSelected}
                onCheckedChange={() => onTogglePreference(preference.id)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{preference.label}</div>
                <div className="text-xs text-muted-foreground">{preference.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
