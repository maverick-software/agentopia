import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Define Profile type locally since it's not imported
interface Profile {
  id: string;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow additional fields
}

interface AuthContextType {
  user: User | null;
  userRoles: string[];
  isAdmin: boolean;
  rolesLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  updateProfile: (profileData: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRoles = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setUserRoles([]);
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', userId);

      console.log(`[AuthContext fetchUserRoles] Raw data for ${userId}:`, data);
      console.log(`[AuthContext fetchUserRoles] Error for ${userId}:`, error);

      if (error) {
        console.error("Error fetching user roles:", error);
        setError(`Failed to fetch user roles: ${error.message}`);
        setUserRoles([]);
      } else {
        const roles = data
          ?.map(item => (item.roles as any)?.name) 
          .filter(Boolean) as string[] || [];
        console.log(`Fetched roles for ${userId}:`, roles);
        setUserRoles(roles);
      }
    } catch (err: any) {
      console.error("Error in fetchUserRoles:", err);
      setError(err instanceof Error ? `Error fetching roles: ${err.message}` : 'An unknown error occurred fetching roles.');
      setUserRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // Fetch user roles when user changes OR on initial load
  useEffect(() => {
    if (user) {
      console.log(`[AuthContext] User detected (${user.id}), fetching roles...`);
      fetchUserRoles(user.id);
    } else {
      // Explicitly set rolesLoading to false if no user
      console.log("[AuthContext] No user detected, clearing roles and setting rolesLoading=false.");
      setUserRoles([]); 
      setRolesLoading(false); 
    }
  }, [user?.id, fetchUserRoles]); // Depend on user.id instead of the whole user object

  // Track the current user ID to prevent unnecessary re-renders on token refresh
  const currentUserIdRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    setLoading(true); 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[AuthContext] onAuthStateChange event: ${_event}, session: ${session ? 'exists' : 'null'}`, {
        timestamp: new Date().toISOString(),
        event: _event
      });
      
      // CRITICAL: Check if this is just a token refresh vs an actual auth change
      const prevUserId = currentUserIdRef.current;
      const newUserId = session?.user?.id;
      
      // Update the ref for next comparison
      currentUserIdRef.current = newUserId;
      
      // Skip state updates if it's the same user and just a token refresh
      if (prevUserId && newUserId && prevUserId === newUserId && _event === 'TOKEN_REFRESHED') {
        console.log('[AuthContext] Token refreshed but same user - SKIPPING state update to prevent re-renders');
        // Ensure loading is false even for token refresh events
        if (loading) {
          console.log('[AuthContext] Setting loading = false for same-user TOKEN_REFRESHED event');
          setLoading(false);
        }
        return; // Don't update state if it's just a token refresh for the same user
      }
      
      // Also skip if event is SIGNED_IN but user hasn't changed
      if (prevUserId && newUserId && prevUserId === newUserId && _event === 'SIGNED_IN') {
        console.log('[AuthContext] SIGNED_IN event but same user - SKIPPING state update');
        // Debug: Check if this is caused by visibility changes
        if (document.hidden) {
          console.log('[AuthContext] SIGNED_IN event triggered while document is hidden (tab switch)');
        }
        
        // CRITICAL FIX: Even if we skip the state update, we need to ensure loading is false
        // This prevents "Loading Session..." from getting stuck on visibility changes
        if (loading) {
          console.log('[AuthContext] Setting loading = false for same-user SIGNED_IN event');
          setLoading(false);
        }
        return;
      }
      
      console.log('[AuthContext] Auth state actually changed, updating user state');
      setUser(session?.user ?? null); 
      // Always set loading false when auth state changes, regardless of current loading state
      console.log('[AuthContext] Setting loading = false inside onAuthStateChange');
      setLoading(false);
    });

    // Still attempt to get session early, and ensure loading gets set to false
    supabase.auth.getSession().then(({ data: { session } }) => {
        // Check if user state is still null from initial useState
        // AND session exists AND listener hasn't set user yet
        if (!user && session) { 
            console.log('[AuthContext] Pre-setting user from initial getSession (listener might update again)');
            setUser(session.user); 
        }
        
        // CRITICAL: Always set loading to false after getSession, as a fallback
        // in case the auth listener doesn't fire or gets missed
        console.log('[AuthContext] Setting loading = false from getSession fallback');
        setLoading(false);
    });

    return () => {
      console.log('[AuthContext] Unsubscribing from onAuthStateChange');
      subscription?.unsubscribe();
    };
  }, []);

  // Removed unused handleAuthError function
  // Error messages are set directly in signIn/signUp methods
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password 
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Sign up successful but no user data returned.');

      console.log(`[AuthContext] User ${authData.user.id} signed up. Creating profile...`);
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ 
            id: authData.user.id,
            full_name: fullName 
        });

      if (profileError) {
        console.error('[AuthContext] CRITICAL: Profile creation failed after sign up:', profileError);
        throw new Error(`Account created, but failed to initialize profile: ${profileError.message}. Please contact support.`);
      }

      console.log(`[AuthContext] Profile created successfully for user ${authData.user.id}`);

    } catch (err: any) {
      console.error('[AuthContext] Sign up or profile creation error:', err);
      setError(err.message || 'Failed to sign up.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => {
    setLoading(true);
    setError(null);
    try {
        const session = await supabase.auth.getSession();
        const currentUserId = session?.data?.session?.user?.id;

        if (!currentUserId) {
            throw new Error('User not authenticated to update profile.');
        }

        console.log(`[AuthContext] Updating profile for user ${currentUserId} with:`, profileData);
        
        const cleanProfileData = Object.entries(profileData).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        const { error: updateError } = await supabase
            .from('profiles')
            .update(cleanProfileData)
            .eq('id', currentUserId);
        
        if (updateError) {
            console.error('[AuthContext] Profile update error:', updateError);
            throw updateError;
        }

        console.log(`[AuthContext] Profile updated successfully for user ${currentUserId}`);

    } catch (err: any) {
        console.error('[AuthContext] updateProfile function error:', err);
        setError(err.message || 'Failed to update profile.');
        throw err;
    } finally {
        setLoading(false);
    }
  };

  const isAdmin = useMemo(() => userRoles.includes('admin'), [userRoles]);

  // CRITICAL: Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    userRoles,
    isAdmin,
    rolesLoading,
    signIn,
    signUp,
    signOut,
    loading,
    error,
    clearError,
    updateProfile
  }), [user, userRoles, isAdmin, rolesLoading, signIn, signUp, signOut, loading, error, clearError, updateProfile]);

  // Logging for debugging
  console.log('[AuthContext Render Check]', {
    loading, // Tracks initial auth check
    rolesLoading, // Tracks role fetching for logged-in user
    user: user ? user.id : null,
    userRoles, // Log the actual roles array
    isAdmin,   // Log the calculated isAdmin value
  });

  // Only block render while waiting for the initial session check
  if (loading) { 
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading Session...</div>
      </div>
    );
  }

  // If loading is false, render the provider. 
  // Downstream components will check user and rolesLoading as needed.
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}