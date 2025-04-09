import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient, User, AuthError } from '@supabase/supabase-js';

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

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials are not properly configured. Please check your environment variables.');
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      if (err instanceof Error) {
        handleAuthError(err as AuthError);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      if (error) throw error;
    } catch (err) {
      if (err instanceof Error) {
        handleAuthError(err as AuthError);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      throw err;
    }
  };

  const signOut = async () => {
    try {
      clearError();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while signing out.');
      }
      throw err;
    }
  };

  // Show loading state
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