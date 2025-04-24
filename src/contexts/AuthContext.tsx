import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

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
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

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
        setIsAdmin(roles.includes('admin'));
      }
    } catch (err: any) {
      console.error("Error in fetchUserRoles:", err);
      setError(err instanceof Error ? `Error fetching roles: ${err.message}` : 'An unknown error occurred fetching roles.');
      setUserRoles([]);
      setIsAdmin(false);
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
      setIsAdmin(false);
    }
  }, [user, fetchUserRoles]); // Keep fetchUserRoles in dependency array

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[AuthContext] onAuthStateChange event: ${_event}, session: ${session ? 'exists' : 'null'}`);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!user && session) {
            console.log('[AuthContext] Setting user from initial getSession');
            setUser(session.user);
        }
        if(loading) setLoading(false); 
    });

    return () => {
      console.log('[AuthContext] Unsubscribing from onAuthStateChange');
      subscription?.unsubscribe();
    };
  }, []);

  const handleAuthError = useCallback((error: AuthError) => {
    switch (error.message) {
      case 'Invalid login credentials':
        setError('Invalid email or password. Please check your credentials and try again.');
        break;
      case 'User already registered':
        setError('An account with this email already exists. Please sign in instead.');
        break;
      case 'Email rate limit exceeded':
        setError('Too many attempts. Please try again later.');
        break;
      default:
        setError(error.message);
    }
  }, []);

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
      setIsAdmin(false);
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

  // Update isAdmin based on userRoles using useMemo
  useEffect(() => {
    setIsAdmin(userRoles.includes('admin'));
  }, [userRoles]);

  const value = {
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
  };

  // Logging for debugging
  console.log('[AuthContext Render Check]', {
    loading, // Tracks initial auth check
    rolesLoading, // Tracks role fetching for logged-in user
    user: user ? user.id : null,
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