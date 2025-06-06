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
      clients: {
        Row: {
          address: string | null
          annual_revenue: number | null
          brand_colors: Json | null
          brand_fonts: Json | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          competitors: Json | null
          competitors_info: Json | null
          contact_email: string
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          employee_count: number | null
          ethos: Json | null
          goals: Json | null
          id: string
          industry: string | null
          key_messages: Json | null
          logo_url: string | null
          mission: string | null
          name: string
          owner_auth_user_id: string | null
          positioning_statement: string | null
          primary_contact_name: string | null
          social_media: Json | null
          target_audience: Json | null
          updated_at: string | null
          value_proposition: string | null
          vision: string | null
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          brand_colors?: Json | null
          brand_fonts?: Json | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          competitors?: Json | null
          competitors_info?: Json | null
          contact_email: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          ethos?: Json | null
          goals?: Json | null
          id?: string
          industry?: string | null
          key_messages?: Json | null
          logo_url?: string | null
          mission?: string | null
          name: string
          owner_auth_user_id?: string | null
          positioning_statement?: string | null
          primary_contact_name?: string | null
          social_media?: Json | null
          target_audience?: Json | null
          updated_at?: string | null
          value_proposition?: string | null
          vision?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          brand_colors?: Json | null
          brand_fonts?: Json | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          competitors?: Json | null
          competitors_info?: Json | null
          contact_email?: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_count?: number | null
          ethos?: Json | null
          goals?: Json | null
          id?: string
          industry?: string | null
          key_messages?: Json | null
          logo_url?: string | null
          mission?: string | null
          name?: string
          owner_auth_user_id?: string | null
          positioning_statement?: string | null
          primary_contact_name?: string | null
          social_media?: Json | null
          target_audience?: Json | null
          updated_at?: string | null
          value_proposition?: string | null
          vision?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
      intake_forms: {
        Row: {
          completed_at: string | null
          form_data: Json
          id: string
          project_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          form_data: Json
          id?: string
          project_id: string
          sent_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          form_data?: Json
          id?: string
          project_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          project_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          project_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          project_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          item_type: string
          name: string
          price: number | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_type: string
          name: string
          price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_type?: string
          name?: string
          price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          default_client_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          default_client_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          default_client_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_client_id_fkey"
            columns: ["default_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assets: {
        Row: {
          file_path: string
          id: string
          name: string
          project_id: string
          type: string
          uploaded_at: string | null
        }
        Insert: {
          file_path: string
          id?: string
          name: string
          project_id: string
          type: string
          uploaded_at?: string | null
        }
        Update: {
          file_path?: string
          id?: string
          name?: string
          project_id?: string
          type?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_elements: {
        Row: {
          condition_logic: Json | null
          config: Json
          created_at: string
          element_key: string
          element_order: number
          element_type: string
          help_text: string | null
          id: string
          is_required: boolean
          label: string | null
          placeholder: string | null
          step_id: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          condition_logic?: Json | null
          config?: Json
          created_at?: string
          element_key: string
          element_order: number
          element_type: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string | null
          placeholder?: string | null
          step_id: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          condition_logic?: Json | null
          config?: Json
          created_at?: string
          element_key?: string
          element_order?: number
          element_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          label?: string | null
          placeholder?: string | null
          step_id?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_flow_elements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_instances: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_steps: Json
          created_project_id: string | null
          current_step_id: string | null
          current_step_number: number
          error_message: string | null
          flow_id: string
          id: string
          last_activity_at: string
          metadata: Json | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_steps?: Json
          created_project_id?: string | null
          current_step_id?: string | null
          current_step_number?: number
          error_message?: string | null
          flow_id: string
          id?: string
          last_activity_at?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_steps?: Json
          created_project_id?: string | null
          current_step_id?: string | null
          current_step_number?: number
          error_message?: string | null
          flow_id?: string
          id?: string
          last_activity_at?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_flow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_flow_instances_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_flow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_flow_instances_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "project_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_step_data: {
        Row: {
          created_at: string
          data_type: string
          data_value: Json
          element_key: string
          id: string
          instance_id: string
          is_valid: boolean
          step_id: string
          updated_at: string
          validation_errors: Json | null
        }
        Insert: {
          created_at?: string
          data_type: string
          data_value: Json
          element_key: string
          id?: string
          instance_id: string
          is_valid?: boolean
          step_id: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Update: {
          created_at?: string
          data_type?: string
          data_value?: Json
          element_key?: string
          id?: string
          instance_id?: string
          is_valid?: boolean
          step_id?: string
          updated_at?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_flow_step_data_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "project_flow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_flow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_steps: {
        Row: {
          allow_skip: boolean
          auto_advance: boolean
          condition_logic: Json | null
          created_at: string
          description: string | null
          flow_id: string
          id: string
          is_required: boolean
          name: string
          show_progress: boolean
          step_number: number
          updated_at: string
        }
        Insert: {
          allow_skip?: boolean
          auto_advance?: boolean
          condition_logic?: Json | null
          created_at?: string
          description?: string | null
          flow_id: string
          id?: string
          is_required?: boolean
          name: string
          show_progress?: boolean
          step_number: number
          updated_at?: string
        }
        Update: {
          allow_skip?: boolean
          auto_advance?: boolean
          condition_logic?: Json | null
          created_at?: string
          description?: string | null
          flow_id?: string
          id?: string
          is_required?: boolean
          name?: string
          show_progress?: boolean
          step_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "project_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flows: {
        Row: {
          auto_create_project: boolean
          color: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          estimated_duration_minutes: number | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          requires_products_services: boolean
          requires_template_selection: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_create_project?: boolean
          color?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_products_services?: boolean
          requires_template_selection?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_create_project?: boolean
          color?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_products_services?: boolean
          requires_template_selection?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          order: number
          priority: string | null
          project_stage_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          order: number
          priority?: string | null
          project_stage_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          order?: number
          priority?: string | null
          project_stage_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_stage_id_fkey"
            columns: ["project_stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_tasks: {
        Row: {
          assignee_member_id: string | null
          created_at: string
          default_assignee_role: string | null
          description: string | null
          due_date: string | null
          estimated_duration_hours: number | null
          id: string
          name: string
          order: number
          priority: string | null
          template_stage_id: string
          updated_at: string
        }
        Insert: {
          assignee_member_id?: string | null
          created_at?: string
          default_assignee_role?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration_hours?: number | null
          id?: string
          name: string
          order: number
          priority?: string | null
          template_stage_id: string
          updated_at?: string
        }
        Update: {
          assignee_member_id?: string | null
          created_at?: string
          default_assignee_role?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration_hours?: number | null
          id?: string
          name?: string
          order?: number
          priority?: string | null
          template_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_tasks_template_stage_id_fkey"
            columns: ["template_stage_id"]
            isOneToOne: false
            referencedRelation: "project_template_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          id: string
          name: string
          status: string
          template_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          name: string
          status: string
          template_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          name: string
          permissions: Json | null
          role_type: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          name: string
          permissions?: Json | null
          role_type: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          permissions?: Json | null
          role_type?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      target_audiences: {
        Row: {
          avatar_url: string | null
          client_id: string
          created_at: string | null
          demographics: Json | null
          description: string | null
          id: string
          is_icp: boolean
          name: string
          psychographics: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          client_id: string
          created_at?: string | null
          demographics?: Json | null
          description?: string | null
          id?: string
          is_icp?: boolean
          name: string
          psychographics?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          client_id?: string
          created_at?: string | null
          demographics?: Json | null
          description?: string | null
          id?: string
          is_icp?: boolean
          name?: string
          psychographics?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_audiences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          auth_user_id: string
          client_id: string
          created_at: string
          id: string
          invited_by_auth_user_id: string | null
          status: Database["public"]["Enums"]["team_member_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          client_id: string
          created_at?: string
          id?: string
          invited_by_auth_user_id?: string | null
          status?: Database["public"]["Enums"]["team_member_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          client_id?: string
          created_at?: string
          id?: string
          invited_by_auth_user_id?: string | null
          status?: Database["public"]["Enums"]["team_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_elements: {
        Row: {
          client_visible: boolean | null
          condition_logic: Json | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          element_key: string
          element_order: number
          element_type: string
          help_text: string | null
          id: string
          is_required: boolean | null
          label: string | null
          placeholder: string | null
          step_id: string
          updated_at: string | null
          updated_by: string | null
          validation_rules: Json | null
        }
        Insert: {
          client_visible?: boolean | null
          condition_logic?: Json | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          element_key: string
          element_order: number
          element_type: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string | null
          placeholder?: string | null
          step_id: string
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Update: {
          client_visible?: boolean | null
          condition_logic?: Json | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          element_key?: string
          element_order?: number
          element_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string | null
          placeholder?: string | null
          step_id?: string
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_elements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "unified_workflow_elements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_elements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_instances: {
        Row: {
          assigned_team_id: string | null
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          created_by: string | null
          current_stage_id: string | null
          current_step_id: string | null
          current_task_id: string | null
          description: string | null
          due_date: string | null
          id: string
          instance_data: Json | null
          name: string
          project_id: string | null
          started_at: string | null
          status: string | null
          template_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          current_stage_id?: string | null
          current_step_id?: string | null
          current_task_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instance_data?: Json | null
          name: string
          project_id?: string | null
          started_at?: string | null
          status?: string | null
          template_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string | null
          current_stage_id?: string | null
          current_step_id?: string | null
          current_task_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instance_data?: Json | null
          name?: string
          project_id?: string | null
          started_at?: string | null
          status?: string | null
          template_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "project_template_stages_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_task_id_fkey"
            columns: ["current_task_id"]
            isOneToOne: false
            referencedRelation: "project_template_tasks_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_task_id_fkey"
            columns: ["current_task_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["flow_id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flows_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_migration_log: {
        Row: {
          created_at: string | null
          data_counts: Json | null
          id: string
          migration_step: string
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_counts?: Json | null
          id?: string
          migration_step: string
          notes?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_counts?: Json | null
          id?: string
          migration_step?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unified_workflow_stages: {
        Row: {
          allow_skip: boolean | null
          auto_advance: boolean | null
          client_description: string | null
          client_visible: boolean | null
          color: string | null
          condition_logic: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_required: boolean | null
          name: string
          stage_order: number
          template_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allow_skip?: boolean | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          color?: string | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_required?: boolean | null
          name: string
          stage_order: number
          template_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allow_skip?: boolean | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          color?: string | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_required?: boolean | null
          name?: string
          stage_order?: number
          template_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["flow_id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flows_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_step_data: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_type: string | null
          element_id: string | null
          element_key: string
          element_value: Json | null
          id: string
          instance_id: string
          is_valid: boolean | null
          step_id: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
          updated_by: string | null
          validation_errors: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_type?: string | null
          element_id?: string | null
          element_key: string
          element_value?: Json | null
          id?: string
          instance_id: string
          is_valid?: boolean | null
          step_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validation_errors?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_type?: string | null
          element_id?: string | null
          element_key?: string
          element_value?: Json | null
          id?: string
          instance_id?: string
          is_valid?: boolean | null
          step_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validation_errors?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_step_data_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "project_flow_instances_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_steps: {
        Row: {
          allow_back_navigation: boolean | null
          allow_skip: boolean | null
          auto_advance: boolean | null
          client_description: string | null
          client_visible: boolean | null
          condition_logic: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_required: boolean | null
          name: string
          save_progress: boolean | null
          show_progress: boolean | null
          step_order: number
          step_type: string | null
          task_id: string
          updated_at: string | null
          updated_by: string | null
          validation_rules: Json | null
        }
        Insert: {
          allow_back_navigation?: boolean | null
          allow_skip?: boolean | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          name: string
          save_progress?: boolean | null
          show_progress?: boolean | null
          step_order: number
          step_type?: string | null
          task_id: string
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Update: {
          allow_back_navigation?: boolean | null
          allow_skip?: boolean | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          name?: string
          save_progress?: boolean | null
          show_progress?: boolean | null
          step_order?: number
          step_type?: string | null
          task_id?: string
          updated_at?: string | null
          updated_by?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_template_tasks_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_tasks: {
        Row: {
          allow_skip: boolean | null
          assigned_to: string | null
          auto_advance: boolean | null
          client_description: string | null
          client_visible: boolean | null
          condition_logic: Json | null
          created_at: string | null
          created_by: string | null
          depends_on_task_ids: string[] | null
          description: string | null
          due_date_offset_days: number | null
          estimated_duration_minutes: number | null
          id: string
          is_required: boolean | null
          name: string
          stage_id: string
          task_order: number
          task_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allow_skip?: boolean | null
          assigned_to?: string | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          depends_on_task_ids?: string[] | null
          description?: string | null
          due_date_offset_days?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_required?: boolean | null
          name: string
          stage_id: string
          task_order: number
          task_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allow_skip?: boolean | null
          assigned_to?: string | null
          auto_advance?: boolean | null
          client_description?: string | null
          client_visible?: boolean | null
          condition_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          depends_on_task_ids?: string[] | null
          description?: string | null
          due_date_offset_days?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_required?: boolean | null
          name?: string
          stage_id?: string
          task_order?: number
          task_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_template_stages_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_workflow_templates: {
        Row: {
          auto_create_project: boolean | null
          category: string | null
          client_description: string | null
          client_visible: boolean | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          estimated_duration_minutes: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          name: string
          requires_products_services: boolean | null
          tags: string[] | null
          template_type: string
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          auto_create_project?: boolean | null
          category?: string | null
          client_description?: string | null
          client_visible?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          name: string
          requires_products_services?: boolean | null
          tags?: string[] | null
          template_type?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          auto_create_project?: boolean | null
          category?: string | null
          client_description?: string | null
          client_visible?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          name?: string
          requires_products_services?: boolean | null
          tags?: string[] | null
          template_type?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          ai_model_used: string | null
          ai_output: Json | null
          ai_prompt: string | null
          completed_at: string | null
          completed_by: string | null
          description: string
          final_output: Json | null
          human_edits: Json | null
          id: string
          name: string
          phase: string
          project_id: string
          research_state: string | null
          status: string
          step_number: number
        }
        Insert: {
          ai_model_used?: string | null
          ai_output?: Json | null
          ai_prompt?: string | null
          completed_at?: string | null
          completed_by?: string | null
          description: string
          final_output?: Json | null
          human_edits?: Json | null
          id?: string
          name: string
          phase: string
          project_id: string
          research_state?: string | null
          status: string
          step_number: number
        }
        Update: {
          ai_model_used?: string | null
          ai_output?: Json | null
          ai_prompt?: string | null
          completed_at?: string | null
          completed_by?: string | null
          description?: string
          final_output?: Json | null
          human_edits?: Json | null
          id?: string
          name?: string
          phase?: string
          project_id?: string
          research_state?: string | null
          status?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          name: string
          phase: string
          step_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          name: string
          phase: string
          step_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          phase?: string
          step_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      migration_validation_summary: {
        Row: {
          entity: string | null
          migrated_count: number | null
          migration_status: string | null
          original_count: number | null
        }
        Relationships: []
      }
      project_flow_elements_unified_view: {
        Row: {
          condition_logic: Json | null
          config: Json | null
          created_at: string | null
          element_key: string | null
          element_order: number | null
          element_type: string | null
          help_text: string | null
          id: string | null
          is_required: boolean | null
          label: string | null
          placeholder: string | null
          step_id: string | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Relationships: []
      }
      project_flow_instances_unified_view: {
        Row: {
          client_id: string | null
          completed_at: string | null
          completed_steps: Json | null
          created_project_id: string | null
          current_step_id: string | null
          current_step_number: number | null
          error_message: string | null
          flow_id: string | null
          id: string | null
          last_activity_at: string | null
          metadata: Json | null
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["flow_id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "project_flows_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "project_templates_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_instances_template_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_step_data_unified_view: {
        Row: {
          created_at: string | null
          data_type: string | null
          data_value: Json | null
          element_key: string | null
          id: string | null
          instance_id: string | null
          is_valid: boolean | null
          step_id: string | null
          updated_at: string | null
          validation_errors: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_step_data_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "project_flow_instances_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_elements_unified_view"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_step_data_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      project_flow_steps_unified_view: {
        Row: {
          allow_skip: boolean | null
          auto_advance: boolean | null
          condition_logic: Json | null
          created_at: string | null
          description: string | null
          flow_id: string | null
          id: string | null
          is_required: boolean | null
          name: string | null
          show_progress: boolean | null
          step_number: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      project_flows_unified_view: {
        Row: {
          auto_create_project: boolean | null
          color: string | null
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          estimated_duration_minutes: number | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          requires_products_services: boolean | null
          requires_template_selection: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          auto_create_project?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_products_services?: boolean | null
          requires_template_selection?: never
          sort_order?: never
          updated_at?: string | null
        }
        Update: {
          auto_create_project?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_products_services?: boolean | null
          requires_template_selection?: never
          sort_order?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      project_template_stages_unified_view: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          order: number | null
          template_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flow_steps_unified_view"
            referencedColumns: ["flow_id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_flows_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_tasks_unified_view: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string | null
          description: string | null
          estimated_duration_minutes: number | null
          id: string | null
          name: string | null
          order: number | null
          stage_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_workflow_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_template_stages_unified_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_workflow_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "unified_workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates_unified_view: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_impersonate: {
        Args: { admin_user_id: string }
        Returns: boolean
      }
      check_user_has_permission: {
        Args: {
          p_user_id: string
          p_permission_key: string
          p_client_id?: string
        }
        Returns: boolean
      }
      create_project_from_template: {
        Args: {
          p_client_id: string
          p_template_id: string
          p_project_name: string
          p_created_by_user_id: string
        }
        Returns: string
      }
      duplicate_project_template: {
        Args: {
          original_template_id: string
          new_template_name: string
          new_created_by_user_id: string
        }
        Returns: string
      }
      get_client_default_id: {
        Args: { user_id: string }
        Returns: string
      }
      get_project_flow_with_steps_elements: {
        Args: { input_flow_id: string }
        Returns: {
          flow_id: string
          flow_name: string
          flow_description: string
          steps: Json
        }[]
      }
      get_project_template_with_stages_tasks: {
        Args: { input_template_id: string }
        Returns: {
          template_id: string
          template_name: string
          template_description: string
          stages: Json
        }[]
      }
      get_template_type: {
        Args: { template_id: string }
        Returns: string
      }
      get_user_global_role_names: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_user_profile_id: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_role_ids: {
        Args: { p_user_id: string; p_client_id?: string }
        Returns: string[]
      }
      is_owner_of_client: {
        Args: { user_id: string; target_client_id: string }
        Returns: boolean
      }
      is_team_member_of_client: {
        Args: {
          user_id: string
          target_client_id: string
          required_status?: Database["public"]["Enums"]["team_member_status"]
        }
        Returns: boolean
      }
      is_user_project_lead: {
        Args: { p_user_id: string; p_project_id: string }
        Returns: boolean
      }
      is_user_project_member: {
        Args: { p_user_id: string; p_project_id: string }
        Returns: boolean
      }
      is_valid_competitor: {
        Args: { competitor: Json }
        Returns: boolean
      }
      is_valid_json: {
        Args: { input_json: Json }
        Returns: boolean
      }
      is_valid_social_media: {
        Args: { social: Json }
        Returns: boolean
      }
      is_valid_staff_member: {
        Args: { staff: Json }
        Returns: boolean
      }
      update_user_global_role: {
        Args: { p_user_id: string; p_new_role_name: string }
        Returns: undefined
      }
    }
    Enums: {
      global_user_role:
        | "SUPER_ADMIN"
        | "DEVELOPER"
        | "SUPPORT_REP"
        | "CLIENT"
        | "ADMIN"
      project_member_role_enum:
        | "PROJECT_LEAD"
        | "PROJECT_EDITOR"
        | "PROJECT_VIEWER"
      team_member_status: "PENDING" | "ACTIVE" | "INACTIVE"
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
  public: {
    Enums: {
      global_user_role: [
        "SUPER_ADMIN",
        "DEVELOPER",
        "SUPPORT_REP",
        "CLIENT",
        "ADMIN",
      ],
      project_member_role_enum: [
        "PROJECT_LEAD",
        "PROJECT_EDITOR",
        "PROJECT_VIEWER",
      ],
      team_member_status: ["PENDING", "ACTIVE", "INACTIVE"],
    },
  },
} as const
