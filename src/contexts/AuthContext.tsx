import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
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

  useEffect(() => {
    let isMounted = true;
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthError = (error: AuthError) => {
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
  };

  const clearError = () => setError(null);

  const signIn = async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      handleAuthError(err as AuthError);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
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
  };

  const signOut = async () => {
    try {
      clearError();
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign out.');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      signIn, 
      signUp, 
      signOut, 
      loading,
      error,
      clearError
    }}>
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