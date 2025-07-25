export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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

      agent_droplet_tools: {
        Row: {
          actual_installed_version: string | null
          agent_droplet_id: string
          config_values: Json | null
          created_at: string
          enabled: boolean
          error_message: string | null
          id: string
          runtime_details: Json | null
          status: Database["public"]["Enums"]["tool_installation_status_enum"]
          tool_catalog_id: string
          updated_at: string
          version_to_install: string
        }
        Insert: {
          actual_installed_version?: string | null
          agent_droplet_id: string
          config_values?: Json | null
          created_at?: string
          enabled?: boolean
          error_message?: string | null
          id?: string
          runtime_details?: Json | null
          status?: Database["public"]["Enums"]["tool_installation_status_enum"]
          tool_catalog_id: string
          updated_at?: string
          version_to_install: string
        }
        Update: {
          actual_installed_version?: string | null
          agent_droplet_id?: string
          config_values?: Json | null
          created_at?: string
          enabled?: boolean
          error_message?: string | null
          id?: string
          runtime_details?: Json | null
          status?: Database["public"]["Enums"]["tool_installation_status_enum"]
          tool_catalog_id?: string
          updated_at?: string
          version_to_install?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_droplet_tools_agent_droplet_id_fkey"
            columns: ["agent_droplet_id"]
            isOneToOne: false
            referencedRelation: "agent_droplets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_droplet_tools_tool_catalog_id_fkey"
            columns: ["tool_catalog_id"]
            isOneToOne: false
            referencedRelation: "tool_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_droplets: {
        Row: {
          agent_id: string
          configuration: Json | null
          created_at: string
          do_created_at: string | null
          do_droplet_id: number | null
          dtma_auth_token: string | null
          dtma_last_known_version: string | null
          dtma_last_reported_status: Json | null
          error_message: string | null
          id: string
          image_slug: string
          ip_address: unknown | null
          last_heartbeat_at: string | null
          name: string | null
          region_slug: string
          size_slug: string
          status: Database["public"]["Enums"]["droplet_status_enum"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          configuration?: Json | null
          created_at?: string
          do_created_at?: string | null
          do_droplet_id?: number | null
          dtma_auth_token?: string | null
          dtma_last_known_version?: string | null
          dtma_last_reported_status?: Json | null
          error_message?: string | null
          id?: string
          image_slug: string
          ip_address?: unknown | null
          last_heartbeat_at?: string | null
          name?: string | null
          region_slug: string
          size_slug: string
          status?: Database["public"]["Enums"]["droplet_status_enum"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          configuration?: Json | null
          created_at?: string
          do_created_at?: string | null
          do_droplet_id?: number | null
          dtma_auth_token?: string | null
          dtma_last_known_version?: string | null
          dtma_last_reported_status?: Json | null
          error_message?: string | null
          id?: string
          image_slug?: string
          ip_address?: unknown | null
          last_heartbeat_at?: string | null
          name?: string | null
          region_slug?: string
          size_slug?: string
          status?: Database["public"]["Enums"]["droplet_status_enum"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_droplets_agent_id_fkey"
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

          id: string
          name: string
          personality: string | null
          system_instructions: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          assistant_instructions?: string | null
          created_at?: string | null
          description: string
          id?: string
          name: string
          personality?: string | null
          system_instructions?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          assistant_instructions?: string | null
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          personality?: string | null
          system_instructions?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          name: string
          topic: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          name: string
          topic?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string
          topic?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_room_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          sender_agent_id: string | null
          sender_user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          sender_agent_id?: string | null
          sender_user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          sender_agent_id?: string | null
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          full_name: string
          hopes_goals: string | null
          id: string
          mobile: string | null
          title: string | null
          updated_at: string | null
          usage_reason: Json | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          full_name: string
          hopes_goals?: string | null
          id: string
          mobile?: string | null
          title?: string | null
          updated_at?: string | null
          usage_reason?: Json | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          full_name?: string
          hopes_goals?: string | null
          id?: string
          mobile?: string | null
          title?: string | null
          updated_at?: string | null
          usage_reason?: Json | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          agent_id: string
          joined_at: string
          reports_to_agent_id: string | null
          reports_to_user: boolean
          team_id: string
          team_role: string | null
          team_role_description: string | null
        }
        Insert: {
          agent_id: string
          joined_at?: string
          reports_to_agent_id?: string | null
          reports_to_user?: boolean
          team_id: string
          team_role?: string | null
          team_role_description?: string | null
        }
        Update: {
          agent_id?: string
          joined_at?: string
          reports_to_agent_id?: string | null
          reports_to_user?: boolean
          team_id?: string
          team_role?: string | null
          team_role_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_reports_to_agent_id_fkey"
            columns: ["reports_to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tool_catalog: {
        Row: {
          categories: string[] | null
          created_at: string
          default_config_template: Json | null
          description: string | null
          developer_org_name: string | null
          documentation_url: string | null
          icon_url: string | null
          id: string
          package_identifier: string
          packaging_type: Database["public"]["Enums"]["tool_packaging_type_enum"]
          required_secrets_schema: Json | null
          resource_requirements: Json | null
          status: Database["public"]["Enums"]["catalog_tool_status_enum"]
          tool_name: string
          updated_at: string
          version_info: Json
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          default_config_template?: Json | null
          description?: string | null
          developer_org_name?: string | null
          documentation_url?: string | null
          icon_url?: string | null
          id?: string
          package_identifier: string
          packaging_type?: Database["public"]["Enums"]["tool_packaging_type_enum"]
          required_secrets_schema?: Json | null
          resource_requirements?: Json | null
          status?: Database["public"]["Enums"]["catalog_tool_status_enum"]
          tool_name: string
          updated_at?: string
          version_info?: Json
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          default_config_template?: Json | null
          description?: string | null
          developer_org_name?: string | null
          documentation_url?: string | null
          icon_url?: string | null
          id?: string
          package_identifier?: string
          packaging_type?: Database["public"]["Enums"]["tool_packaging_type_enum"]
          required_secrets_schema?: Json | null
          resource_requirements?: Json | null
          status?: Database["public"]["Enums"]["catalog_tool_status_enum"]
          tool_name?: string
          updated_at?: string
          version_info?: Json
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
      user_team_memberships: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          added_by_user_id: string | null
          agent_id: string | null
          created_at: string
          id: string
          role: string | null
          team_id: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          added_by_user_id?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          team_id?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          added_by_user_id?: string | null
          agent_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          team_id?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          context_window_size: number
          context_window_token_limit: number
          created_at: string
          id: string
          name: string
          owner_user_id: string
        }
        Insert: {
          context_window_size?: number
          context_window_token_limit?: number
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
        }
        Update: {
          context_window_size?: number
          context_window_token_limit?: number
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_manage_chat_room_members: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      can_manage_workspace_members: {
        Args: { p_workspace_id: string; p_user_id: string }
        Returns: boolean
      }
      get_chat_messages_with_details: {
        Args: { p_channel_id: string }
        Returns: {
          id: string
          channel_id: string
          sender_user_id: string
          sender_agent_id: string
          content: string
          metadata: Json
          embedding: string
          created_at: string
          user_profile: Json
          agent: Json
        }[]
      }
      get_room_id_for_channel: {
        Args: { p_channel_id: string }
        Returns: string
      }
      get_room_members: {
        Args: { p_room_id: string }
        Returns: Database["public"]["CompositeTypes"]["room_member_details"][]
      }
      get_team_id_for_channel: {
        Args: { p_channel_id: string }
        Returns: string
      }
      get_user_chat_rooms: {
        Args: { p_user_id: string }
        Returns: {
          context_window_size: number
          context_window_token_limit: number
          created_at: string
          id: string
          name: string
          owner_user_id: string
        }[]
      }
      get_workspace_id_for_channel: {
        Args: { p_channel_id: string }
        Returns: string
      }
      get_workspace_members_with_details: {
        Args: { p_workspace_id: string }
        Returns: {
          id: string
          role: string
          created_at: string
          workspace_id: string
          user_id: string
          agent_id: string
          team_id: string
          user_profile: Json
          agent: Json
          team: Json
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_agent_owner: {
        Args: { agent_id_to_check: string }
        Returns: boolean
      }
      is_chat_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      is_global_admin: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_admin_or_pm: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { p_workspace_id: string; p_user_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { p_workspace_id: string; p_user_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      list_room_channels: {
        Args: { p_room_id: string }
        Returns: {
          created_at: string
          id: string
          last_message_at: string | null
          name: string
          topic: string | null
          workspace_id: string
        }[]
      }
      match_channel_messages: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_channel_id: string
        }
        Returns: {
          id: string
          channel_id: string
          content: string
          similarity: number
        }[]
      }
      search_chat_history: {
        Args: {
          p_channel_id: string
          p_search_query: string
          p_search_type?: string
          p_match_count?: number
          p_match_threshold?: number
        }
        Returns: {
          channel_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          sender_agent_id: string | null
          sender_user_id: string | null
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_worker_status: {
        Args: { connection_id_in: string; new_status_in: string }
        Returns: undefined
      }
      user_has_role: {
        Args: { user_id: string; role_name: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      catalog_tool_status_enum:
        | "available"
        | "beta"
        | "experimental"
        | "deprecated"
        | "archived"
      chat_member_type: "user" | "agent" | "team"
      droplet_status_enum:
        | "pending_creation"
        | "creating"
        | "active"
        | "error_creation"
        | "pending_deletion"
        | "deleting"
        | "deleted"
        | "error_deletion"
        | "unresponsive"
      tool_installation_status_enum:
        | "pending_install"
        | "installing"
        | "active"
        | "error_install"
        | "pending_uninstall"
        | "uninstalling"
        | "uninstalled"
        | "error_uninstall"
        | "pending_config"
        | "stopped"
        | "starting"
        | "stopping"
        | "error_runtime"
        | "disabled"
      tool_packaging_type_enum: "docker_image"
    }
    CompositeTypes: {
      room_member_details: {
        member_entry_id: string | null
        room_id: string | null
        member_type: string | null
        member_id: string | null
        added_at: string | null
        member_name: string | null
        member_avatar_url: string | null
      }
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
  public: {
    Enums: {
      catalog_tool_status_enum: [
        "available",
        "beta",
        "experimental",
        "deprecated",
        "archived",
      ],
      chat_member_type: ["user", "agent", "team"],
      droplet_status_enum: [
        "pending_creation",
        "creating",
        "active",
        "error_creation",
        "pending_deletion",
        "deleting",
        "deleted",
        "error_deletion",
        "unresponsive",
      ],
      tool_installation_status_enum: [
        "pending_install",
        "installing",
        "active",
        "error_install",
        "pending_uninstall",
        "uninstalling",
        "uninstalled",
        "error_uninstall",
        "pending_config",
        "stopped",
        "starting",
        "stopping",
        "error_runtime",
        "disabled",
      ],
      tool_packaging_type_enum: ["docker_image"],
    },
  },
} as const
