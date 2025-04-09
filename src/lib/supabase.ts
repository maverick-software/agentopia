import { createClient } from '@supabase/supabase-js';
import { backOff } from 'exponential-backoff';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined in environment variables');
}

// Create a single instance of the Supabase client with optimized settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'agentopia',
    },
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  },
  // Increase timeout and add proper error handling
  opts: {
    timeout: 60000, // Increased to 60 seconds
    retries: 3
  }
});

// Export types for better type safety
export type Database = {
  public: {
    Tables: {
      datastores: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          type: 'pinecone' | 'getzep';
          config: {
            apiKey?: string;
            region?: string;
            host?: string;
            indexName?: string;
            dimensions?: number;
            projectId?: string;
            collectionName?: string;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['datastores']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['datastores']['Insert']>;
      };
    };
  };
};

// Improved utility function to check Supabase connection with better error handling
export const isSupabaseConnected = async () => {
  try {
    // First verify the environment variables are properly loaded
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
      return false;
    }

    console.log('Attempting to connect to Supabase at:', supabaseUrl);

    // Test the connection with a simple query and retry logic
    await backOff(
      async () => {
        // Use the agents table which we know exists in our schema
        const { error } = await supabase
          .from('agents')
          .select('id')
          .limit(1);

        if (error) {
          console.error('Supabase connection test error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        return true;
      },
      {
        numOfAttempts: 3,
        startingDelay: 2500,
        maxDelay: 10000,
        timeMultiple: 2,
        retry: (e, attemptNumber) => {
          console.warn(`Supabase connection test attempt ${attemptNumber} failed:`, {
            error: e,
            message: e.message,
            name: e.name
          });
          return true; // Always retry until max attempts reached
        }
      }
    );
    
    console.log('Successfully connected to Supabase');
    return true;
  } catch (error) {
    console.error('Failed to connect to Supabase after all retries:', {
      error,
      message: error.message,
      name: error.name,
      stack: error.stack,
      url: supabaseUrl
    });
    return false;
  }
};

// Initialize connection check
isSupabaseConnected().then(connected => {
  if (connected) {
    console.log('Initial Supabase connection test successful');
  } else {
    console.error('Initial Supabase connection test failed');
  }
});