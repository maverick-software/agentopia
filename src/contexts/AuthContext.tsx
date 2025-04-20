import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  userRoles: string[];
  isAdmin: boolean;
  rolesLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const fetchUserRoles = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setUserRoles([]);
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    try {
      const { data, error } = await supabaseClient
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
      }
    } catch (err: any) {
      console.error("Error in fetchUserRoles:", err);
      setError(err instanceof Error ? `Error fetching roles: ${err.message}` : 'An unknown error occurred fetching roles.');
      setUserRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        const fetchedUserId = session?.user?.id;
        setUser(currentUser => {
          if(currentUser?.id !== fetchedUserId) {
            return session?.user ?? null;
          }
          return currentUser;
        });
        fetchUserRoles(fetchedUserId);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        const fetchedUserId = session?.user?.id;
        setUser(currentUser => {
          if(currentUser?.id !== fetchedUserId) {
            return session?.user ?? null;
          }
          return currentUser;
        });
        fetchUserRoles(fetchedUserId);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRoles]);

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

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      handleAuthError(err as AuthError);
      throw err;
    }
  }, [clearError, handleAuthError]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabaseClient.auth.signUp({ 
        email, 
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` }
      });
      if (error) throw error;
    } catch (err: any) {
      handleAuthError(err as AuthError);
      throw err;
    }
  }, [clearError, handleAuthError]);

  const signOut = useCallback(async () => {
    try {
      clearError();
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign out.');
      throw err;
    }
  }, [clearError]);

  const isAdmin = useMemo(() => userRoles.includes('admin'), [userRoles]);

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
    clearError
  }), [user, userRoles, isAdmin, rolesLoading, loading, error, signIn, signUp, signOut, clearError]);

  const initialLoading = loading || rolesLoading;

  if (initialLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading Session...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}