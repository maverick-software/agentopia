import { useState, useEffect } from 'react';
import { useSupabase } from '../contexts/DatabaseContext';

interface ReasoningSettings {
  threshold: number;
  autoAdjust: boolean;
  preferredStyle?: 'inductive' | 'abductive' | 'deductive';
}

export const useReasoningSettings = (agentId?: string) => {
  const { supabase } = useSupabase();
  const [settings, setSettings] = useState<ReasoningSettings>({
    threshold: 0.3,
    autoAdjust: true,
  });
  const [loading, setLoading] = useState(false);

  // Load settings from localStorage and database
  useEffect(() => {
    const loadSettings = async () => {
      // First, try localStorage for immediate UI response
      const localKey = agentId ? `reasoning-settings-${agentId}` : 'reasoning-settings-global';
      const localSettings = localStorage.getItem(localKey);
      
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.warn('Failed to parse local reasoning settings:', e);
        }
      }

      // Then load from database if agent-specific
      if (agentId && supabase) {
        try {
          const { data: agent } = await supabase
            .from('agents')
            .select('metadata')
            .eq('id', agentId)
            .single();

          const reasoningSettings = agent?.metadata?.reasoning_settings;
          if (reasoningSettings) {
            setSettings(prev => ({ ...prev, ...reasoningSettings }));
          }
        } catch (error) {
          console.warn('Failed to load reasoning settings from database:', error);
        }
      }
    };

    loadSettings();
  }, [agentId, supabase]);

  // Save settings to localStorage and database
  const updateSettings = async (newSettings: Partial<ReasoningSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // Save to localStorage immediately
    const localKey = agentId ? `reasoning-settings-${agentId}` : 'reasoning-settings-global';
    localStorage.setItem(localKey, JSON.stringify(updated));

    // Save to database if agent-specific
    if (agentId && supabase) {
      setLoading(true);
      try {
        const { data: agent } = await supabase
          .from('agents')
          .select('metadata')
          .eq('id', agentId)
          .single();

        const currentMetadata = agent?.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          reasoning_settings: updated
        };

        await supabase
          .from('agents')
          .update({ metadata: updatedMetadata })
          .eq('id', agentId);

        console.log('Reasoning settings saved to database');
      } catch (error) {
        console.error('Failed to save reasoning settings to database:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return {
    settings,
    updateSettings,
    loading,
  };
};
