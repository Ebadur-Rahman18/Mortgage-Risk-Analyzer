export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          last_message_at: string | null
          message_count: number
          metadata: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          access_count: number
          agent_id: string
          consolidated: boolean
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance_score: number
          is_active: boolean
          last_accessed_at: string | null
          memory_category: string | null
          memory_type: string
          source_id: string | null
          source_type: string | null
          superseded_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number
          agent_id: string
          consolidated?: boolean
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance_score?: number
          is_active?: boolean
          last_accessed_at?: string | null
          memory_category?: string | null
          memory_type?: string
          source_id?: string | null
          source_type?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number
          agent_id?: string
          consolidated?: boolean
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance_score?: number
          is_active?: boolean
          last_accessed_at?: string | null
          memory_category?: string | null
          memory_type?: string
          source_id?: string | null
          source_type?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "agent_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          metadata: Json
          model_used: string | null
          role: string
          token_metrics: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_used?: string | null
          role: string
          token_metrics?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_used?: string | null
          role?: string
          token_metrics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          category: string | null
          created_at: string
          data_sources: string[] | null
          description: string | null
          id: string
          is_enabled: boolean
          memory_enabled: boolean
          metadata: Json | null
          name: string
          provider_config: Json | null
          required_role: string | null
          slug: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data_sources?: string[] | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          memory_enabled?: boolean
          metadata?: Json | null
          name: string
          provider_config?: Json | null
          required_role?: string | null
          slug: string
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data_sources?: string[] | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          memory_enabled?: boolean
          metadata?: Json | null
          name?: string
          provider_config?: Json | null
          required_role?: string | null
          slug?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      borrowers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          api_payload: Json | null
          city: string | null
          created_at: string
          created_by: string | null
          data_source: string | null
          date_of_birth: string | null
          email: string | null
          external_id: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          ssn_last4: string | null
          state: string | null
          street_address: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          api_payload?: Json | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          ssn_last4?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          api_payload?: Json | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          ssn_last4?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      document_extracts: {
        Row: {
          byte_size: number | null
          content_embedding: string | null
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          knowledge_entry_id: string | null
          metadata: Json
          mime_type: string | null
          page_count: number | null
          parse_error: string | null
          parse_status: string
          parsed_at: string | null
          sections: Json
          storage_bucket: string
          storage_path: string
          tables_json: Json
          updated_at: string
          uploaded_by: string | null
          word_count: number | null
        }
        Insert: {
          byte_size?: number | null
          content_embedding?: string | null
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          knowledge_entry_id?: string | null
          metadata?: Json
          mime_type?: string | null
          page_count?: number | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          sections?: Json
          storage_bucket?: string
          storage_path: string
          tables_json?: Json
          updated_at?: string
          uploaded_by?: string | null
          word_count?: number | null
        }
        Update: {
          byte_size?: number | null
          content_embedding?: string | null
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          knowledge_entry_id?: string | null
          metadata?: Json
          mime_type?: string | null
          page_count?: number | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          sections?: Json
          storage_bucket?: string
          storage_path?: string
          tables_json?: Json
          updated_at?: string
          uploaded_by?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extracts_knowledge_entry_id_fkey"
            columns: ["knowledge_entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          api_key: string | null
          api_key_masked: string | null
          config: Json
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean
          last_validated_at: string | null
          provider_name: string
          updated_at: string
          updated_by: string | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_masked?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          provider_name: string
          updated_at?: string
          updated_by?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_masked?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          provider_name?: string
          updated_at?: string
          updated_by?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: []
      }
      knowledge_categories: {
        Row: {
          aliases: string[]
          archived_at: string | null
          color: string | null
          created_at: string
          deprecated_at: string | null
          description: string | null
          effective_date: string | null
          governance_owner_role: string | null
          icon: string | null
          id: string
          is_regulatory_critical: boolean
          lifecycle_state: string
          metadata: Json
          name: string
          parent_id: string | null
          review_cadence_days: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          color?: string | null
          created_at?: string
          deprecated_at?: string | null
          description?: string | null
          effective_date?: string | null
          governance_owner_role?: string | null
          icon?: string | null
          id?: string
          is_regulatory_critical?: boolean
          lifecycle_state?: string
          metadata?: Json
          name: string
          parent_id?: string | null
          review_cadence_days?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          color?: string | null
          created_at?: string
          deprecated_at?: string | null
          description?: string | null
          effective_date?: string | null
          governance_owner_role?: string | null
          icon?: string | null
          id?: string
          is_regulatory_critical?: boolean
          lifecycle_state?: string
          metadata?: Json
          name?: string
          parent_id?: string | null
          review_cadence_days?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          author_id: string | null
          category: string | null
          category_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          slug: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          slug?: string | null
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          category?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          slug?: string | null
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          api_payload: Json | null
          annual_income: number | null
          appraised_value: number | null
          borrower_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          credit_score: number | null
          data_source: string | null
          dti: number | null
          down_payment: number | null
          employment_years: number | null
          estimated_close_date: string | null
          external_id: string | null
          id: string
          interest_rate: number | null
          loan_amount: number | null
          loan_number: string | null
          loan_officer_id: string | null
          loan_purpose: string | null
          loan_type: string | null
          loan_term_months: number | null
          lock_date: string | null
          lock_expiration_date: string | null
          ltv: number | null
          monthly_debt: number | null
          notes: string | null
          occupancy_type: string | null
          product_id: string | null
          program_id: string | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_zip: string | null
          purpose: string | null
          stage: string | null
          status: string
          underwriter_id: string | null
          updated_at: string
        }
        Insert: {
          api_payload?: Json | null
          annual_income?: number | null
          appraised_value?: number | null
          borrower_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_score?: number | null
          data_source?: string | null
          dti?: number | null
          down_payment?: number | null
          employment_years?: number | null
          estimated_close_date?: string | null
          external_id?: string | null
          id?: string
          interest_rate?: number | null
          loan_amount?: number | null
          loan_number?: string | null
          loan_officer_id?: string | null
          loan_purpose?: string | null
          loan_type?: string | null
          loan_term_months?: number | null
          lock_date?: string | null
          lock_expiration_date?: string | null
          ltv?: number | null
          monthly_debt?: number | null
          notes?: string | null
          occupancy_type?: string | null
          product_id?: string | null
          program_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_zip?: string | null
          purpose?: string | null
          stage?: string | null
          status?: string
          underwriter_id?: string | null
          updated_at?: string
        }
        Update: {
          api_payload?: Json | null
          annual_income?: number | null
          appraised_value?: number | null
          borrower_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_score?: number | null
          data_source?: string | null
          dti?: number | null
          down_payment?: number | null
          employment_years?: number | null
          estimated_close_date?: string | null
          external_id?: string | null
          id?: string
          interest_rate?: number | null
          loan_amount?: number | null
          loan_number?: string | null
          loan_officer_id?: string | null
          loan_purpose?: string | null
          loan_type?: string | null
          loan_term_months?: number | null
          lock_date?: string | null
          lock_expiration_date?: string | null
          ltv?: number | null
          monthly_debt?: number | null
          notes?: string | null
          occupancy_type?: string | null
          product_id?: string | null
          program_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_zip?: string | null
          purpose?: string | null
          stage?: string | null
          status?: string
          underwriter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_risk_analyses: {
        Row: {
          id: string
          loan_id: string
          run_by: string | null
          risk_score: number
          risk_level: string
          summary: string
          risk_factors: Json
          recommendations: Json
          dti: number | null
          ltv: number | null
          model_used: string | null
          latency_ms: number | null
          is_outdated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          run_by?: string | null
          risk_score: number
          risk_level: string
          summary?: string
          risk_factors?: Json
          recommendations?: Json
          dti?: number | null
          ltv?: number | null
          model_used?: string | null
          latency_ms?: number | null
          is_outdated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          run_by?: string | null
          risk_score?: number
          risk_level?: string
          summary?: string
          risk_factors?: Json
          recommendations?: Json
          dti?: number | null
          ltv?: number | null
          model_used?: string | null
          latency_ms?: number | null
          is_outdated?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_risk_analyses_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_risk_chat_messages: {
        Row: {
          id: string
          loan_id: string
          role: string
          content: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          role: string
          content: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          role?: string
          content?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_risk_chat_messages_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          tour_completed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          tour_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tour_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          loan_id: string | null
          priority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          loan_id?: string | null
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          loan_id?: string | null
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_agent_customizations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          knowledge_entry_ids: string[]
          notes: string | null
          system_prompt_override: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          knowledge_entry_ids?: string[]
          notes?: string | null
          system_prompt_override?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          knowledge_entry_ids?: string[]
          notes?: string | null
          system_prompt_override?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_agent_personalizations: {
        Row: {
          additional_prompt: string | null
          agent_id: string
          communication_style: string | null
          created_at: string
          id: string
          metadata: Json
          tone_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_prompt?: string | null
          agent_id: string
          communication_style?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          tone_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_prompt?: string | null
          agent_id?: string
          communication_style?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          tone_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agent_personalizations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_settings: {
        Row: {
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consolidate_short_term_memories: {
        Args: { days_old?: number; p_agent_id: string; p_user_id: string }
        Returns: number
      }
      get_relevant_memories: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_agent_id: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          importance_score: number
          memory_category: string
          memory_type: string
          similarity: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_memory_access: {
        Args: { memory_ids: string[] }
        Returns: undefined
      }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
      prune_short_term_memories: {
        Args: {
          days_old?: number
          importance_threshold?: number
          p_agent_id: string
          p_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "loan_officer" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "loan_officer", "user"],
    },
  },
} as const
