// Generated from the Supabase schema (project mig-inward-re). Regenerate after each migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      counterparties: {
        Row: {
          active: boolean
          contacts: Json
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["counterparty_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          contacts?: Json
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          type: Database["public"]["Enums"]["counterparty_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          contacts?: Json
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["counterparty_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          active: boolean
          code: string
          name: string
          name_ru: string | null
          name_uz: string | null
        }
        Insert: {
          active?: boolean
          code: string
          name: string
          name_ru?: string | null
          name_uz?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          name?: string
          name_ru?: string | null
          name_uz?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          active: boolean
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          description: string | null
          doc_type: Database["public"]["Enums"]["doc_type"]
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          description?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          description?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          due_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          outcome: string | null
          title: string | null
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          outcome?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          outcome?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          rate_date: string
          rate_to_usd: number
          source: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency: string
          rate_date: string
          rate_to_usd: number
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          rate_date?: string
          rate_to_usd?: number
          source?: string | null
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job: string
          result: Json | null
          started_at: string
          started_by: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      lines_of_business: {
        Row: {
          active: boolean
          code: string
          id: string
          name: string
          name_ru: string | null
          name_uz: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          name: string
          name_ru?: string | null
          name_uz?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          name?: string
          name_ru?: string | null
          name_uz?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_language: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferred_language?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      ref_counters: {
        Row: {
          last_value: number
          scope: string
          year: number
        }
        Insert: {
          last_value?: number
          scope: string
          year: number
        }
        Update: {
          last_value?: number
          scope?: string
          year?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      submission_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          document_id: string | null
          from_status: Database["public"]["Enums"]["submission_status"] | null
          id: number
          signed_share_pct: number | null
          submission_id: string
          to_status: Database["public"]["Enums"]["submission_status"]
          written_share_pct: number | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          document_id?: string | null
          from_status?: Database["public"]["Enums"]["submission_status"] | null
          id?: never
          signed_share_pct?: number | null
          submission_id: string
          to_status: Database["public"]["Enums"]["submission_status"]
          written_share_pct?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          document_id?: string | null
          from_status?: Database["public"]["Enums"]["submission_status"] | null
          id?: never
          signed_share_pct?: number | null
          submission_id?: string
          to_status?: Database["public"]["Enums"]["submission_status"]
          written_share_pct?: number | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          bound_at: string | null
          broker_id: string | null
          brokerage_pct: number
          business_type: Database["public"]["Enums"]["business_type"]
          commission_pct: number
          created_at: string
          created_by: string | null
          currency: string
          decision_reason: string | null
          deductible: number | null
          gross_premium_100: number | null
          id: string
          insured_country: string | null
          insured_name: string
          limit_100: number | null
          lob_id: string | null
          mga_id: string
          next_follow_up_at: string | null
          notes: string | null
          offer_valid_until: string | null
          offered_at: string | null
          payment_terms_days: number | null
          period_from: string | null
          period_to: string | null
          ppw_date: string | null
          received_at: string
          ref_no: string
          risk_description: string | null
          signed_share_pct: number | null
          source_party_id: string
          status: Database["public"]["Enums"]["submission_status"]
          status_changed_at: string
          sum_insured_100: number | null
          underwriter_id: string | null
          updated_at: string
          updated_by: string | null
          written_share_pct: number | null
        }
        Insert: {
          bound_at?: string | null
          broker_id?: string | null
          brokerage_pct?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          currency: string
          decision_reason?: string | null
          deductible?: number | null
          gross_premium_100?: number | null
          id?: string
          insured_country?: string | null
          insured_name: string
          limit_100?: number | null
          lob_id?: string | null
          mga_id: string
          next_follow_up_at?: string | null
          notes?: string | null
          offer_valid_until?: string | null
          offered_at?: string | null
          payment_terms_days?: number | null
          period_from?: string | null
          period_to?: string | null
          ppw_date?: string | null
          received_at?: string
          ref_no: string
          risk_description?: string | null
          signed_share_pct?: number | null
          source_party_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          status_changed_at?: string
          sum_insured_100?: number | null
          underwriter_id?: string | null
          updated_at?: string
          updated_by?: string | null
          written_share_pct?: number | null
        }
        Update: {
          bound_at?: string | null
          broker_id?: string | null
          brokerage_pct?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_reason?: string | null
          deductible?: number | null
          gross_premium_100?: number | null
          id?: string
          insured_country?: string | null
          insured_name?: string
          limit_100?: number | null
          lob_id?: string | null
          mga_id?: string
          next_follow_up_at?: string | null
          notes?: string | null
          offer_valid_until?: string | null
          offered_at?: string | null
          payment_terms_days?: number | null
          period_from?: string | null
          period_to?: string | null
          ppw_date?: string | null
          received_at?: string
          ref_no?: string
          risk_description?: string | null
          signed_share_pct?: number | null
          source_party_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          status_changed_at?: string
          sum_insured_100?: number | null
          underwriter_id?: string | null
          updated_at?: string
          updated_by?: string | null
          written_share_pct?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      follow_ups_v: {
        Row: Database["public"]["Tables"]["follow_ups"]["Row"] & {
          entity_ref: string | null
          entity_label: string | null
          submission_status: Database["public"]["Enums"]["submission_status"] | null
          mga_id: string | null
          mga_name: string | null
          offer_valid_until: string | null
          assigned_to_name: string | null
          done_by_name: string | null
          is_overdue: boolean | null
          days_overdue: number | null
        }
        Relationships: []
      }
      submissions_v: {
        Row: {
          bound_at: string | null
          broker_id: string | null
          broker_name: string | null
          brokerage_amount: number | null
          brokerage_pct: number | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          commission_amount: number | null
          commission_pct: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          days_since_offered: number | null
          decision_reason: string | null
          deductible: number | null
          deductions_amount: number | null
          follow_up_overdue: boolean | null
          fx_rate_to_usd: number | null
          gross_premium_100: number | null
          gross_premium_100_usd: number | null
          id: string | null
          insured_country: string | null
          insured_name: string | null
          limit_100: number | null
          lob_code: string | null
          lob_id: string | null
          lob_name: string | null
          mga_id: string | null
          mga_name: string | null
          next_follow_up_at: string | null
          notes: string | null
          offer_expired: boolean | null
          offer_valid_until: string | null
          offered_at: string | null
          our_gross_premium: number | null
          our_gross_premium_usd: number | null
          our_limit: number | null
          our_net_premium: number | null
          our_net_premium_usd: number | null
          our_sum_insured: number | null
          payment_terms_days: number | null
          period_from: string | null
          period_to: string | null
          ppw_date: string | null
          received_at: string | null
          ref_no: string | null
          risk_description: string | null
          share_pct: number | null
          signed_share_pct: number | null
          source_party_id: string | null
          source_party_name: string | null
          source_party_type: Database["public"]["Enums"]["counterparty_type"] | null
          status: Database["public"]["Enums"]["submission_status"] | null
          status_changed_at: string | null
          sum_insured_100: number | null
          sum_insured_100_usd: number | null
          underwriter_id: string | null
          underwriter_name: string | null
          updated_at: string | null
          updated_by: string | null
          written_share_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_update_user: {
        Args: { p_active: boolean; p_full_name?: string; p_role: Database["public"]["Enums"]["app_role"]; p_user_id: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      auth_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      can_write_entity: { Args: { p_entity_type: string }; Returns: boolean }
      change_submission_status: {
        Args: {
          p_comment?: string
          p_document_id?: string
          p_offer_valid_until?: string
          p_signed_share_pct?: number | string
          p_submission_id: string
          p_to_status: Database["public"]["Enums"]["submission_status"]
          p_written_share_pct?: number | string
        }
        Returns: Database["public"]["Tables"]["submissions"]["Row"]
      }
      fx_rate_to_usd: { Args: { p_currency: string; p_date: string }; Returns: number }
      run_daily_follow_ups_now: { Args: never; Returns: Json }
      has_role: { Args: { roles: Database["public"]["Enums"]["app_role"][] }; Returns: boolean }
      is_app_user: { Args: never; Returns: boolean }
      submission_next_statuses: {
        Args: { p_from: Database["public"]["Enums"]["submission_status"] }
        Returns: Database["public"]["Enums"]["submission_status"][]
      }
    }
    Enums: {
      app_role: "admin" | "underwriter" | "finance" | "claims" | "management"
      business_type: "facultative" | "binder"
      counterparty_type: "mga" | "broker" | "cedent"
      doc_type: "submission" | "slip" | "bordereau" | "invoice" | "debit_note" | "credit_note" | "claim_notice" | "loss_advice" | "correspondence" | "other"
      entity_type: "submission" | "premium" | "claim" | "bordereau"
      follow_up_type: "request_update" | "offer_expiry" | "other"
      submission_status: "received" | "under_review" | "declined" | "offered" | "bound" | "ntu" | "no_response"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "underwriter", "finance", "claims", "management"],
      business_type: ["facultative", "binder"],
      counterparty_type: ["mga", "broker", "cedent"],
      doc_type: ["submission", "slip", "bordereau", "invoice", "debit_note", "credit_note", "claim_notice", "loss_advice", "correspondence", "other"],
      entity_type: ["submission", "premium", "claim", "bordereau"],
      follow_up_type: ["request_update", "offer_expiry", "other"],
      submission_status: ["received", "under_review", "declined", "offered", "bound", "ntu", "no_response"],
    },
  },
} as const
