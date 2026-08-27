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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          anonymous_title: string | null
          business_name: string | null
          city: string | null
          created_at: string
          desired_timeline: string | null
          employees: number | null
          id: string
          industry: string | null
          reason_for_sale: string | null
          region: string | null
          seller_id: string
          state: string | null
          status: string
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          anonymous_title?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          desired_timeline?: string | null
          employees?: number | null
          id?: string
          industry?: string | null
          reason_for_sale?: string | null
          region?: string | null
          seller_id: string
          state?: string | null
          status?: string
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          anonymous_title?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          desired_timeline?: string | null
          employees?: number | null
          id?: string
          industry?: string | null
          reason_for_sale?: string | null
          region?: string | null
          seller_id?: string
          state?: string | null
          status?: string
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_interest_tests: {
        Row: {
          approved_at: string | null
          business_id: string
          created_at: string
          id: string
          matched_buyer_count: number
          seller_id: string
          status: string
          teaser_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          business_id: string
          created_at?: string
          id?: string
          matched_buyer_count?: number
          seller_id: string
          status?: string
          teaser_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          business_id?: string
          created_at?: string
          id?: string
          matched_buyer_count?: number
          seller_id?: string
          status?: string
          teaser_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_interest_tests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_interest_tests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_interest_tests_teaser_id_fkey"
            columns: ["teaser_id"]
            isOneToOne: false
            referencedRelation: "teasers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_profiles: {
        Row: {
          available_capital: number | null
          buyer_id: string
          buyer_type: string | null
          created_at: string
          id: string
          proof_of_funds_status: string
          target_geographies: string[] | null
          target_industries: string[] | null
          target_revenue_max: number | null
          target_revenue_min: number | null
          target_sde_max: number | null
          target_sde_min: number | null
          timeline_to_acquire: string | null
          updated_at: string
        }
        Insert: {
          available_capital?: number | null
          buyer_id: string
          buyer_type?: string | null
          created_at?: string
          id?: string
          proof_of_funds_status?: string
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_revenue_max?: number | null
          target_revenue_min?: number | null
          target_sde_max?: number | null
          target_sde_min?: number | null
          timeline_to_acquire?: string | null
          updated_at?: string
        }
        Update: {
          available_capital?: number | null
          buyer_id?: string
          buyer_type?: string | null
          created_at?: string
          id?: string
          proof_of_funds_status?: string
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_revenue_max?: number | null
          target_revenue_min?: number | null
          target_sde_max?: number | null
          target_sde_min?: number | null
          timeline_to_acquire?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_profiles_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_uploads: {
        Row: {
          business_id: string
          created_at: string
          file_size: number | null
          file_type: string | null
          id: string
          mime_type: string | null
          original_file_name: string | null
          storage_bucket: string | null
          storage_path: string | null
          uploader_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          original_file_name?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          uploader_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          mime_type?: string | null
          original_file_name?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_uploads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_uploads_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nda_requests: {
        Row: {
          business_id: string | null
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_profile_id: string | null
          confidentiality_accepted: boolean
          id: string
          signature_text: string | null
          status: string
          submitted_at: string
          teaser_id: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_profile_id?: string | null
          confidentiality_accepted?: boolean
          id?: string
          signature_text?: string | null
          status?: string
          submitted_at?: string
          teaser_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_profile_id?: string | null
          confidentiality_accepted?: boolean
          id?: string
          signature_text?: string | null
          status?: string
          submitted_at?: string
          teaser_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nda_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nda_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nda_requests_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "buyer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nda_requests_teaser_id_fkey"
            columns: ["teaser_id"]
            isOneToOne: false
            referencedRelation: "teasers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_connections: {
        Row: {
          access_token_expires_at: string | null
          business_id: string | null
          company_name: string | null
          connected_at: string | null
          created_at: string
          environment: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          realm_id: string
          refresh_token_expires_at: string | null
          scope: string | null
          seller_id: string
          status: string
          token_secret_id: string | null
          updated_at: string
        }
        Insert: {
          access_token_expires_at?: string | null
          business_id?: string | null
          company_name?: string | null
          connected_at?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          realm_id: string
          refresh_token_expires_at?: string | null
          scope?: string | null
          seller_id: string
          status?: string
          token_secret_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token_expires_at?: string | null
          business_id?: string | null
          company_name?: string | null
          connected_at?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          realm_id?: string
          refresh_token_expires_at?: string | null
          scope?: string | null
          seller_id?: string
          status?: string
          token_secret_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_connections_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_oauth_states: {
        Row: {
          business_id: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          seller_id: string
          state_hash: string
        }
        Insert: {
          business_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          seller_id: string
          state_hash: string
        }
        Update: {
          business_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          seller_id?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_oauth_states_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_report_snapshots: {
        Row: {
          accounting_method: string | null
          availability: string | null
          business_id: string
          checksum: string | null
          connection_id: string
          created_at: string
          entity_count: number | null
          fetched_at: string | null
          financial_row_count: number | null
          id: string
          normalized_payload: Json
          parser_version: string | null
          period_end: string | null
          period_start: string | null
          privacy_tier: string | null
          raw_payload: Json
          report_basis: string | null
          report_type: string
          reports_api_generation: string | null
          request_path: string | null
          row_count: number | null
          source_generated_at: string | null
          source_key: string | null
          source_kind: string | null
          source_label: string | null
          status: string
          structural_node_count: number | null
          sync_run_id: string | null
          transaction_count: number | null
        }
        Insert: {
          accounting_method?: string | null
          availability?: string | null
          business_id: string
          checksum?: string | null
          connection_id: string
          created_at?: string
          entity_count?: number | null
          fetched_at?: string | null
          financial_row_count?: number | null
          id?: string
          normalized_payload?: Json
          parser_version?: string | null
          period_end?: string | null
          period_start?: string | null
          privacy_tier?: string | null
          raw_payload?: Json
          report_basis?: string | null
          report_type: string
          reports_api_generation?: string | null
          request_path?: string | null
          row_count?: number | null
          source_generated_at?: string | null
          source_key?: string | null
          source_kind?: string | null
          source_label?: string | null
          status?: string
          structural_node_count?: number | null
          sync_run_id?: string | null
          transaction_count?: number | null
        }
        Update: {
          accounting_method?: string | null
          availability?: string | null
          business_id?: string
          checksum?: string | null
          connection_id?: string
          created_at?: string
          entity_count?: number | null
          fetched_at?: string | null
          financial_row_count?: number | null
          id?: string
          normalized_payload?: Json
          parser_version?: string | null
          period_end?: string | null
          period_start?: string | null
          privacy_tier?: string | null
          raw_payload?: Json
          report_basis?: string | null
          report_type?: string
          reports_api_generation?: string | null
          request_path?: string | null
          row_count?: number | null
          source_generated_at?: string | null
          source_key?: string | null
          source_kind?: string | null
          source_label?: string | null
          status?: string
          structural_node_count?: number | null
          sync_run_id?: string | null
          transaction_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_report_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_report_snapshots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "quickbooks_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_report_snapshots_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "quickbooks_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_sync_runs: {
        Row: {
          business_id: string
          completed_at: string | null
          connection_id: string
          created_at: string
          error_codes: string[]
          failed_count: number
          id: string
          requested_report_types: string[]
          results: Json
          seller_id: string
          started_at: string
          status: string
          successful_count: number
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          connection_id: string
          created_at?: string
          error_codes?: string[]
          failed_count?: number
          id?: string
          requested_report_types?: string[]
          results?: Json
          seller_id: string
          started_at?: string
          status?: string
          successful_count?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          error_codes?: string[]
          failed_count?: number
          id?: string
          requested_report_types?: string[]
          results?: Json
          seller_id?: string
          started_at?: string
          status?: string
          successful_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "quickbooks_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_sync_runs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_answers: {
        Row: {
          book_quality: string | null
          business_id: string
          created_at: string
          customer_concentration: string | null
          facility_status: string | null
          id: string
          key_employees: string | null
          owner_relationships: string | null
          revenue_type: string | null
          transition_support: string | null
          updated_at: string
        }
        Insert: {
          book_quality?: string | null
          business_id: string
          created_at?: string
          customer_concentration?: string | null
          facility_status?: string | null
          id?: string
          key_employees?: string | null
          owner_relationships?: string | null
          revenue_type?: string | null
          transition_support?: string | null
          updated_at?: string
        }
        Update: {
          book_quality?: string | null
          business_id?: string
          created_at?: string
          customer_concentration?: string | null
          facility_status?: string | null
          id?: string
          key_employees?: string | null
          owner_relationships?: string | null
          revenue_type?: string | null
          transition_support?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_answers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_financials: {
        Row: {
          business_id: string
          created_at: string
          estimated_sde: number | null
          gross_profit: number | null
          id: string
          net_income: number | null
          one_time_expenses: number | null
          operating_expenses: number | null
          other_addbacks: number | null
          owner_compensation: number | null
          period_end: string | null
          period_start: string | null
          personal_addbacks: number | null
          raw_payload: Json
          revenue: number | null
          source: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          estimated_sde?: number | null
          gross_profit?: number | null
          id?: string
          net_income?: number | null
          one_time_expenses?: number | null
          operating_expenses?: number | null
          other_addbacks?: number | null
          owner_compensation?: number | null
          period_end?: string | null
          period_start?: string | null
          personal_addbacks?: number | null
          raw_payload?: Json
          revenue?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          estimated_sde?: number | null
          gross_profit?: number | null
          id?: string
          net_income?: number | null
          one_time_expenses?: number | null
          operating_expenses?: number | null
          other_addbacks?: number | null
          owner_compensation?: number | null
          period_end?: string | null
          period_start?: string | null
          personal_addbacks?: number | null
          raw_payload?: Json
          revenue?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_financials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      teasers: {
        Row: {
          approved_for_outreach: boolean
          business_id: string
          buyer_fit: string | null
          confidentiality_note: string | null
          created_at: string
          financial_snapshot: Json
          growth_opportunities: Json
          id: string
          investment_highlights: Json
          overview: string | null
          share_slug: string | null
          title: string | null
          transition_profile: string | null
          updated_at: string
          valuation_id: string | null
        }
        Insert: {
          approved_for_outreach?: boolean
          business_id: string
          buyer_fit?: string | null
          confidentiality_note?: string | null
          created_at?: string
          financial_snapshot?: Json
          growth_opportunities?: Json
          id?: string
          investment_highlights?: Json
          overview?: string | null
          share_slug?: string | null
          title?: string | null
          transition_profile?: string | null
          updated_at?: string
          valuation_id?: string | null
        }
        Update: {
          approved_for_outreach?: boolean
          business_id?: string
          buyer_fit?: string | null
          confidentiality_note?: string | null
          created_at?: string
          financial_snapshot?: Json
          growth_opportunities?: Json
          id?: string
          investment_highlights?: Json
          overview?: string | null
          share_slug?: string | null
          title?: string | null
          transition_profile?: string | null
          updated_at?: string
          valuation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teasers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teasers_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          base_multiple: number | null
          base_value: number | null
          business_id: string
          buyer_concerns: Json
          confidence: string | null
          created_at: string
          disclaimer: string | null
          estimated_sde: number | null
          financials_id: string | null
          high_multiple: number | null
          high_value: number | null
          id: string
          likely_buyer_types: Json
          low_multiple: number | null
          low_value: number | null
          methodology: string | null
          updated_at: string
          upside_opportunities: Json
          value_drivers: Json
        }
        Insert: {
          base_multiple?: number | null
          base_value?: number | null
          business_id: string
          buyer_concerns?: Json
          confidence?: string | null
          created_at?: string
          disclaimer?: string | null
          estimated_sde?: number | null
          financials_id?: string | null
          high_multiple?: number | null
          high_value?: number | null
          id?: string
          likely_buyer_types?: Json
          low_multiple?: number | null
          low_value?: number | null
          methodology?: string | null
          updated_at?: string
          upside_opportunities?: Json
          value_drivers?: Json
        }
        Update: {
          base_multiple?: number | null
          base_value?: number | null
          business_id?: string
          buyer_concerns?: Json
          confidence?: string | null
          created_at?: string
          disclaimer?: string | null
          estimated_sde?: number | null
          financials_id?: string | null
          high_multiple?: number | null
          high_value?: number | null
          id?: string
          likely_buyer_types?: Json
          low_multiple?: number | null
          low_value?: number | null
          methodology?: string | null
          updated_at?: string
          upside_opportunities?: Json
          value_drivers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "valuations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_financials_id_fkey"
            columns: ["financials_id"]
            isOneToOne: false
            referencedRelation: "seller_financials"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_business: { Args: { _business_id: string }; Returns: boolean }
      service_qb_consume_oauth_state: {
        Args: { _state_hash: string }
        Returns: {
          business_id: string
          seller_id: string
        }[]
      }
      service_qb_create_token_secret: {
        Args: { _bundle: Json; _name: string }
        Returns: string
      }
      service_qb_delete_token_secret: {
        Args: { _secret_id: string }
        Returns: undefined
      }
      service_qb_get_token_secret: {
        Args: { _secret_id: string }
        Returns: Json
      }
      service_qb_update_token_secret: {
        Args: { _bundle: Json; _secret_id: string }
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
    Enums: {},
  },
} as const
