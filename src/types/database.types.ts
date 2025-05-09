export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_datastores: {
        Row: {
          agent_id: string
          created_at: string | null
          datastore_id: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          datastore_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          datastore_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_datastores_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_datastores_datastore_id_fkey"
            columns: ["datastore_id"]
            isOneToOne: false
            referencedRelation: "datastores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_discord_connections: {
        Row: {
          agent_id: string
          channel_id: string | null
          created_at: string
          discord_app_id: string
          discord_public_key: string
          guild_id: string | null
          id: string
          inactivity_timeout_minutes: number | null
          is_enabled: boolean
          worker_status: string | null
        }
        Insert: {
          agent_id: string
          channel_id?: string | null
          created_at?: string
          discord_app_id: string
          discord_public_key: string
          guild_id?: string | null
          id?: string
          inactivity_timeout_minutes?: number | null
          is_enabled?: boolean
          worker_status?: string | null
        }
        Update: {
          agent_id?: string
          channel_id?: string | null
          created_at?: string
          discord_app_id?: string
          discord_public_key?: string
          guild_id?: string | null
          id?: string
          inactivity_timeout_minutes?: number | null
          is_enabled?: boolean
          worker_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_discord_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          active: boolean | null
          assistant_instructions: string | null
          created_at: string | null
          description: string
          discord_bot_key: string | null
          discord_bot_token_encrypted: string | null
          discord_channel: string | null
          discord_user_id: string | null
          id: string
          name: string
          personality: string
          system_instructions: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          assistant_instructions?: string | null
          created_at?: string | null
          description: string
          discord_bot_key?: string | null
          discord_bot_token_encrypted?: string | null
          discord_channel?: string | null
          discord_user_id?: string | null
          id?: string
          name: string
          personality: string
          system_instructions?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          assistant_instructions?: string | null
          created_at?: string | null
          description?: string
          discord_bot_key?: string | null
          discord_bot_token_encrypted?: string | null
          discord_channel?: string | null
          discord_user_id?: string | null
          id?: string
          name?: string
          personality?: string
          system_instructions?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      datastores: {
        Row: {
          config: Json
          created_at: string | null
          description: string
          id: string
          max_results: number | null
          name: string
          similarity_metric: string | null
          similarity_threshold: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          description: string
          id?: string
          max_results?: number | null
          name: string
          similarity_metric?: string | null
          similarity_threshold?: number | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          description?: string
          id?: string
          max_results?: number | null
          name?: string
          similarity_metric?: string | null
          similarity_threshold?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mcp_configurations: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: number
          is_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: number
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: number
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_configurations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          capabilities: Json | null
          config_id: number | null
          created_at: string | null
          endpoint_url: string
          id: number
          is_active: boolean | null
          max_retries: number | null
          name: string
          priority: number | null
          retry_backoff_ms: number | null
          timeout_ms: number | null
          updated_at: string | null
          vault_api_key_id: string | null
        }
        Insert: {
          capabilities?: Json | null
          config_id?: number | null
          created_at?: string | null
          endpoint_url: string
          id?: number
          is_active?: boolean | null
          max_retries?: number | null
          name: string
          priority?: number | null
          retry_backoff_ms?: number | null
          timeout_ms?: number | null
          updated_at?: string | null
          vault_api_key_id?: string | null
        }
        Update: {
          capabilities?: Json | null
          config_id?: number | null
          created_at?: string | null
          endpoint_url?: string
          id?: number
          is_active?: boolean | null
          max_retries?: number | null
          name?: string
          priority?: number | null
          retry_backoff_ms?: number | null
          timeout_ms?: number | null
          updated_at?: string | null
          vault_api_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "mcp_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_secrets: {
        Row: {
          created_at: string
          encryption_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encryption_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encryption_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_worker_status: {
        Args: { connection_id_in: string; new_status_in: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
