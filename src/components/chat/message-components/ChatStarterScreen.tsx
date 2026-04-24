import React from 'react';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { supabase } from '@/lib/supabase';
import type { ChatStarterScreenProps } from './types';

export function ChatStarterScreen({ agent, user }: ChatStarterScreenProps) {
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [firstName, setFirstName] = React.useState('');

  React.useEffect(() => {
    const fetchFirstName = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single();
      if (profile?.first_name) setFirstName(profile.first_name);
      else if (user?.email) setFirstName(user.email.split('@')[0]);
      else setFirstName('there');
    };
    fetchFirstName();
  }, [user?.id, user?.email]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto px-6 animate-fade-in">
        {resolvedAvatarUrl ? (
          <img
            src={resolvedAvatarUrl}
            alt={agent?.name || 'Agent'}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-6 shadow-lg"
            onError={(e) => {
              console.warn('Avatar image failed to load:', resolvedAvatarUrl);
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
        >
          <span className="text-white text-xl font-medium">{agent?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
        </div>
        <h2 className="text-xl font-medium text-muted-foreground mb-2">{agent?.name || 'Agent'}</h2>
        <h3 className="text-4xl font-semibold text-foreground">Hi {firstName || 'there'}, How Can I Help?</h3>
      </div>
    </div>
  );
}
