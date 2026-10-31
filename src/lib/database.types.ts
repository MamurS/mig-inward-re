// Generated from the Supabase schema (project mig-inward-re). Regenerate after each migration
// with scripts/write-db-types.mjs, which keeps the hand edit: numeric share arguments of
// change_submission_status also accept exact decimal strings.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          hits: number
          is_demo: boolean
          kind: string
          last_hit_at: string | null
          model: string
          result: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          hits?: number
          is_demo?: boolean
          kind: string
          last_hit_at?: string | null
          model: string
          result: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          hits?: number
          is_demo?: boolean
          kind?: string
          last_hit_at?: string | null
          model?: string
          result?: Json
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          file_bytes: number | null
          file_name: string | null
          file_sha256: string | null
          id: string
          input_tokens: number | null
          is_demo: boolean
          kind: string
          model: string | null
          output_tokens: number | null
          provider: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          file_bytes?: number | null
          file_name?: string | null
          file_sha256?: string | null
          id?: string
          input_tokens?: number | null
          is_demo?: boolean
          kind: string
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          file_bytes?: number | null
          file_name?: string | null
          file_sha256?: string | null
          id?: string
          input_tokens?: number | null
          is_demo?: boolean
          kind?: string
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      binder_lobs: {
        Row: {
          binder_id: string
          is_demo: boolean
          limit_100: number | null
          lob_id: string
        }
        Insert: {
          binder_id: string
          is_demo?: boolean
          limit_100?: number | null
          lob_id: string
        }
        Update: {
          binder_id?: string
          is_demo?: boolean
          limit_100?: number | null
          lob_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "binder_lobs_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder_capacity_v"
            referencedColumns: ["binder_id"]
          },
          {
            foreignKeyName: "binder_lobs_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binder_lobs_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binder_lobs_lob_id_fkey"
            columns: ["lob_id"]
            isOneToOne: false
            referencedRelation: "lines_of_business"
            referencedColumns: ["id"]
          },
        ]
      }
      binders: {
        Row: {
          aggregate_limit: number | null
          binder_ref: string
          bordereau_due_days: number
          bordereau_frequency: Database["public"]["Enums"]["bordereau_frequency"]
          bordereau_kinds: Database["public"]["Enums"]["bordereau_kind"][]
          broker_id: string | null
          brokerage_pct: number
          capacity_alerted_pct: number
          commission_pct: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_demo: boolean
          limit_per_risk: number | null
          mga_id: string
          notes: string | null
          our_share_pct: number
          period_from: string
          period_to: string
          status: Database["public"]["Enums"]["binder_status"]
          territories: string[]
          underwriter_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aggregate_limit?: number | null
          binder_ref: string
          bordereau_due_days?: number
          bordereau_frequency?: Database["public"]["Enums"]["bordereau_frequency"]
          bordereau_kinds?: Database["public"]["Enums"]["bordereau_kind"][]
          broker_id?: string | null
          brokerage_pct?: number
          capacity_alerted_pct?: number
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          is_demo?: boolean
          limit_per_risk?: number | null
          mga_id: string
          notes?: string | null
          our_share_pct: number
          period_from: string
          period_to: string
          status?: Database["public"]["Enums"]["binder_status"]
          territories?: string[]
          underwriter_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aggregate_limit?: number | null
          binder_ref?: string
          bordereau_due_days?: number
          bordereau_frequency?: Database["public"]["Enums"]["bordereau_frequency"]
          bordereau_kinds?: Database["public"]["Enums"]["bordereau_kind"][]
          broker_id?: string | null
          brokerage_pct?: number
          capacity_alerted_pct?: number
          commission_pct?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_demo?: boolean
          limit_per_risk?: number | null
          mga_id?: string
          notes?: string | null
          our_share_pct?: number
          period_from?: string
          period_to?: string
          status?: Database["public"]["Enums"]["binder_status"]
          territories?: string[]
          underwriter_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "binders_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "binders_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bordereau_lines: {
        Row: {
          binder_id: string
          bordereau_id: string
          cause: string | null
          claim_id: string | null
          claim_ref: string | null
          comment: string | null
          currency: string | null
          date_of_loss: string | null
          dup_key: string
          gross_premium_100: number | null
          id: string
          insured_country: string | null
          insured_name: string | null
          is_demo: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          limit_100: number | null
          line_no: number
          lob_id: string | null
          messages: Json
          notified_date: string | null
          outstanding_100: number | null
          paid_100: number | null
          period_from: string | null
          period_to: string | null
          policy_ref: string | null
          raw: Json
          status: Database["public"]["Enums"]["bordereau_line_status"]
          sum_insured_100: number | null
        }
        Insert: {
          binder_id: string
          bordereau_id: string
          cause?: string | null
          claim_id?: string | null
          claim_ref?: string | null
          comment?: string | null
          currency?: string | null
          date_of_loss?: string | null
          dup_key: string
          gross_premium_100?: number | null
          id?: string
          insured_country?: string | null
          insured_name?: string | null
          is_demo?: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          limit_100?: number | null
          line_no: number
          lob_id?: string | null
          messages?: Json
          notified_date?: string | null
          outstanding_100?: number | null
          paid_100?: number | null
          period_from?: string | null
          period_to?: string | null
          policy_ref?: string | null
          raw?: Json
          status?: Database["public"]["Enums"]["bordereau_line_status"]
          sum_insured_100?: number | null
        }
        Update: {
          binder_id?: string
          bordereau_id?: string
          cause?: string | null
          claim_id?: string | null
          claim_ref?: string | null
          comment?: string | null
          currency?: string | null
          date_of_loss?: string | null
          dup_key?: string
          gross_premium_100?: number | null
          id?: string
          insured_country?: string | null
          insured_name?: string | null
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["bordereau_kind"]
          limit_100?: number | null
          line_no?: number
          lob_id?: string | null
          messages?: Json
          notified_date?: string | null
          outstanding_100?: number | null
          paid_100?: number | null
          period_from?: string | null
          period_to?: string | null
          policy_ref?: string | null
          raw?: Json
          status?: Database["public"]["Enums"]["bordereau_line_status"]
          sum_insured_100?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bordereau_lines_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder_capacity_v"
            referencedColumns: ["binder_id"]
          },
          {
            foreignKeyName: "bordereau_lines_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_lines_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_lines_bordereau_id_fkey"
            columns: ["bordereau_id"]
            isOneToOne: false
            referencedRelation: "bordereaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_lines_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_lines_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_lines_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bordereau_lines_lob_id_fkey"
            columns: ["lob_id"]
            isOneToOne: false
            referencedRelation: "lines_of_business"
            referencedColumns: ["id"]
          },
        ]
      }
      bordereau_templates: {
        Row: {
          created_at: string
          created_by: string | null
          header_row: number
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          mapping: Json
          mga_id: string
          name: string
          sheet: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          header_row?: number
          id?: string
          is_demo?: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          mapping?: Json
          mga_id: string
          name: string
          sheet?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          header_row?: number
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["bordereau_kind"]
          mapping?: Json
          mga_id?: string
          name?: string
          sheet?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bordereau_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereau_templates_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
        ]
      }
      bordereaux: {
        Row: {
          binder_id: string
          computed_total: number | null
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          installment_ids: string[]
          is_demo: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          line_count: number
          notes: string | null
          period_end: string
          period_start: string
          received_date: string
          ref_no: string
          rejected_count: number
          stated_total: number | null
          template_id: string | null
          totals_comment: string | null
          warning_count: number
        }
        Insert: {
          binder_id: string
          computed_total?: number | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          installment_ids?: string[]
          is_demo?: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          line_count?: number
          notes?: string | null
          period_end: string
          period_start: string
          received_date?: string
          ref_no: string
          rejected_count?: number
          stated_total?: number | null
          template_id?: string | null
          totals_comment?: string | null
          warning_count?: number
        }
        Update: {
          binder_id?: string
          computed_total?: number | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          installment_ids?: string[]
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["bordereau_kind"]
          line_count?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          received_date?: string
          ref_no?: string
          rejected_count?: number
          stated_total?: number | null
          template_id?: string | null
          totals_comment?: string | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bordereaux_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder_capacity_v"
            referencedColumns: ["binder_id"]
          },
          {
            foreignKeyName: "bordereaux_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereaux_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereaux_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bordereaux_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bordereau_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_payments: {
        Row: {
          amount: number
          bank_reference: string | null
          claim_id: string
          created_at: string
          currency: string
          entered_by: string | null
          id: string
          is_demo: boolean
          method: Database["public"]["Enums"]["claim_payment_method"]
          notes: string | null
          offset_receipt_id: string | null
          payee_id: string | null
          payment_date: string
          type: Database["public"]["Enums"]["claim_payment_type"]
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          claim_id: string
          created_at?: string
          currency: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          method?: Database["public"]["Enums"]["claim_payment_method"]
          notes?: string | null
          offset_receipt_id?: string | null
          payee_id?: string | null
          payment_date?: string
          type?: Database["public"]["Enums"]["claim_payment_type"]
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          claim_id?: string
          created_at?: string
          currency?: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          method?: Database["public"]["Enums"]["claim_payment_method"]
          notes?: string | null
          offset_receipt_id?: string | null
          payee_id?: string | null
          payment_date?: string
          type?: Database["public"]["Enums"]["claim_payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "claim_payments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_offset_receipt_id_fkey"
            columns: ["offset_receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_offset_receipt_id_fkey"
            columns: ["offset_receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_recoveries: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          entered_by: string | null
          id: string
          is_demo: boolean
          notes: string | null
          recovery_date: string
          type: Database["public"]["Enums"]["claim_recovery_type"]
        }
        Insert: {
          amount: number
          claim_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          recovery_date?: string
          type: Database["public"]["Enums"]["claim_recovery_type"]
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          recovery_date?: string
          type?: Database["public"]["Enums"]["claim_recovery_type"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_recoveries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_recoveries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_recoveries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_reserves: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          entered_by: string | null
          id: string
          is_demo: boolean
          movement_date: string
          reason: string
        }
        Insert: {
          amount: number
          claim_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          movement_date?: string
          reason: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          is_demo?: boolean
          movement_date?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_reserves_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reserves_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reserves_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          cause: string | null
          cedent_claim_ref: string | null
          claim_no: string
          close_comment: string | null
          coverage_comment: string | null
          coverage_issues: string[]
          created_at: string
          created_by: string | null
          currency: string
          date_of_loss: string
          decline_reason: string | null
          description: string | null
          estimate_100: number | null
          handler_id: string | null
          id: string
          is_demo: boolean
          large_loss: boolean
          large_loss_at: string | null
          location: string | null
          notes: string | null
          notified_date: string
          signed_share_pct: number
          status: Database["public"]["Enums"]["claim_status"]
          status_changed_at: string
          submission_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cause?: string | null
          cedent_claim_ref?: string | null
          claim_no: string
          close_comment?: string | null
          coverage_comment?: string | null
          coverage_issues?: string[]
          created_at?: string
          created_by?: string | null
          currency: string
          date_of_loss: string
          decline_reason?: string | null
          description?: string | null
          estimate_100?: number | null
          handler_id?: string | null
          id?: string
          is_demo?: boolean
          large_loss?: boolean
          large_loss_at?: string | null
          location?: string | null
          notes?: string | null
          notified_date?: string
          signed_share_pct: number
          status?: Database["public"]["Enums"]["claim_status"]
          status_changed_at?: string
          submission_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cause?: string | null
          cedent_claim_ref?: string | null
          claim_no?: string
          close_comment?: string | null
          coverage_comment?: string | null
          coverage_issues?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          date_of_loss?: string
          decline_reason?: string | null
          description?: string | null
          estimate_100?: number | null
          handler_id?: string | null
          id?: string
          is_demo?: boolean
          large_loss?: boolean
          large_loss_at?: string | null
          location?: string | null
          notes?: string | null
          notified_date?: string
          signed_share_pct?: number
          status?: Database["public"]["Enums"]["claim_status"]
          status_changed_at?: string
          submission_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "claims_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_ups_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "premium_schedule_check_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          active: boolean
          contacts: Json
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["counterparty_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counterparties_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "counterparties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counterparties_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          name_ru: string | null
          name_uz: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          name: string
          name_ru?: string | null
          name_uz?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          name?: string
          name_ru?: string | null
          name_uz?: string | null
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
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_role: Database["public"]["Enums"]["app_role"] | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          due_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          is_demo: boolean
          outcome: string | null
          title: string | null
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at: string
        }
        Insert: {
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_demo?: boolean
          outcome?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_demo?: boolean
          outcome?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fx_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_rates_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
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
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job: string
          result?: Json | null
          started_at?: string
          started_by?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          job?: string
          result?: Json | null
          started_at?: string
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      premium_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          fx_rate: number | null
          id: string
          installment_amount: number
          installment_id: string
          is_demo: boolean
          receipt_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          fx_rate?: number | null
          id?: string
          installment_amount: number
          installment_id: string
          is_demo?: boolean
          receipt_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          fx_rate?: number | null
          id?: string
          installment_amount?: number
          installment_id?: string
          is_demo?: boolean
          receipt_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "premium_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "premium_installments_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_installments: {
        Row: {
          basis_signed_share_pct: number | null
          brokerage_amount: number
          commission_amount: number
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          gross_amount: number
          id: string
          installment_no: number
          is_demo: boolean
          net_amount: number | null
          notes: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type: Database["public"]["Enums"]["installment_type"]
          updated_at: string
          updated_by: string | null
          written_off_at: string | null
          written_off_by: string | null
          written_off_reason: string | null
        }
        Insert: {
          basis_signed_share_pct?: number | null
          brokerage_amount?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          currency: string
          due_date: string
          gross_amount: number
          id?: string
          installment_no: number
          is_demo?: boolean
          net_amount?: number | null
          notes?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type?: Database["public"]["Enums"]["installment_type"]
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
          written_off_by?: string | null
          written_off_reason?: string | null
        }
        Update: {
          basis_signed_share_pct?: number | null
          brokerage_amount?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          gross_amount?: number
          id?: string
          installment_no?: number
          is_demo?: boolean
          net_amount?: number | null
          notes?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          submission_id?: string
          type?: Database["public"]["Enums"]["installment_type"]
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
          written_off_by?: string | null
          written_off_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_installments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_ups_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "premium_schedule_check_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_written_off_by_fkey"
            columns: ["written_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_receipts: {
        Row: {
          amount: number
          bank_reference: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_demo: boolean
          notes: string | null
          payer_id: string
          received_date: string
          ref_no: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          payer_id: string
          received_date?: string
          ref_no: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          payer_id?: string
          received_date?: string
          ref_no?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_receipts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "premium_receipts_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_receipts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          ui_demo_mode: boolean
          ui_text_size: string
          ui_theme: string
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
          ui_demo_mode?: boolean
          ui_text_size?: string
          ui_theme?: string
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
          ui_demo_mode?: boolean
          ui_text_size?: string
          ui_theme?: string
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
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "submission_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "submission_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_ups_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "submission_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "premium_schedule_check_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "submission_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_v"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          binder_id: string | null
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
          is_demo: boolean
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
          binder_id?: string | null
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
          is_demo?: boolean
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
          binder_id?: string | null
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
          is_demo?: boolean
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
        Relationships: [
          {
            foreignKeyName: "submissions_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder_capacity_v"
            referencedColumns: ["binder_id"]
          },
          {
            foreignKeyName: "submissions_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_insured_country_fkey"
            columns: ["insured_country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_lob_id_fkey"
            columns: ["lob_id"]
            isOneToOne: false
            referencedRelation: "lines_of_business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_source_party_id_fkey"
            columns: ["source_party_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_usage_v: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error: string | null
          file_bytes: number | null
          file_name: string | null
          id: string | null
          input_tokens: number | null
          kind: string | null
          model: string | null
          output_tokens: number | null
          provider: string | null
          search_text: string | null
          status: string | null
          user_id: string | null
          user_name: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      binder_capacity_v: {
        Row: {
          aggregate_limit: number | null
          binder_id: string | null
          missing_rate: number | null
          risk_lines: number | null
          used_100: number | null
        }
        Relationships: []
      }
      binders_v: {
        Row: {
          aggregate_limit: number | null
          binder_ref: string | null
          bordereau_due_days: number | null
          bordereau_frequency:
            | Database["public"]["Enums"]["bordereau_frequency"]
            | null
          bordereau_kinds:
            | Database["public"]["Enums"]["bordereau_kind"][]
            | null
          broker_id: string | null
          broker_name: string | null
          brokerage_pct: number | null
          capacity_missing_rate: number | null
          capacity_pct: number | null
          capacity_used_100: number | null
          commission_pct: number | null
          created_at: string | null
          currency: string | null
          id: string | null
          last_received: string | null
          late_count: number | null
          limit_per_risk: number | null
          lob_codes: string | null
          mga_id: string | null
          mga_name: string | null
          missing_count: number | null
          notes: string | null
          our_share_pct: number | null
          period_from: string | null
          period_to: string | null
          risk_lines: number | null
          search_text: string | null
          status: Database["public"]["Enums"]["binder_status"] | null
          submission_id: string | null
          submission_ref: string | null
          submission_status:
            | Database["public"]["Enums"]["submission_status"]
            | null
          territories: string[] | null
          underwriter_id: string | null
          underwriter_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "binders_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "binders_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binders_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_payments_v: {
        Row: {
          amount: number | null
          amount_usd: number | null
          bank_reference: string | null
          claim_id: string | null
          claim_no: string | null
          created_at: string | null
          currency: string | null
          entered_by: string | null
          entered_by_name: string | null
          fx_rate_to_usd: number | null
          id: string | null
          method: Database["public"]["Enums"]["claim_payment_method"] | null
          mga_id: string | null
          mga_name: string | null
          notes: string | null
          offset_receipt_id: string | null
          offset_receipt_no: string | null
          payee_id: string | null
          payee_name: string | null
          payment_date: string | null
          type: Database["public"]["Enums"]["claim_payment_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "claim_payments_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_offset_receipt_id_fkey"
            columns: ["offset_receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_offset_receipt_id_fkey"
            columns: ["offset_receipt_id"]
            isOneToOne: false
            referencedRelation: "premium_receipts_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
        ]
      }
      claims_v: {
        Row: {
          broker_id: string | null
          broker_name: string | null
          cash_call_due_at: string | null
          cause: string | null
          cedent_claim_ref: string | null
          claim_no: string | null
          close_comment: string | null
          coverage_comment: string | null
          coverage_issues: string[] | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          date_of_loss: string | null
          days_since_reserve: number | null
          decline_reason: string | null
          description: string | null
          estimate_100: number | null
          estimate_our_share: number | null
          estimate_our_share_usd: number | null
          fx_rate_to_usd: number | null
          handler_id: string | null
          handler_name: string | null
          id: string | null
          incurred: number | null
          incurred_usd: number | null
          insured_name: string | null
          large_loss: boolean | null
          large_loss_at: string | null
          last_payment_date: string | null
          last_reserve_date: string | null
          lob_code: string | null
          lob_id: string | null
          lob_name: string | null
          location: string | null
          mga_id: string | null
          mga_name: string | null
          notes: string | null
          notified_date: string | null
          outstanding: number | null
          outstanding_usd: number | null
          paid_total: number | null
          paid_usd: number | null
          period_from: string | null
          period_to: string | null
          recoveries_total: number | null
          recoveries_usd: number | null
          ref_no: string | null
          reserves_total: number | null
          search_text: string | null
          signed_share_pct: number | null
          status: Database["public"]["Enums"]["claim_status"] | null
          status_changed_at: string | null
          submission_id: string | null
          underwriter_id: string | null
          underwriter_name: string | null
          underwriting_year: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "claims_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_ups_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "premium_schedule_check_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_lob_id_fkey"
            columns: ["lob_id"]
            isOneToOne: false
            referencedRelation: "lines_of_business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups_v: {
        Row: {
          assigned_role: Database["public"]["Enums"]["app_role"] | null
          assigned_to: string | null
          assigned_to_name: string | null
          created_at: string | null
          created_by: string | null
          days_overdue: number | null
          done_at: string | null
          done_by: string | null
          done_by_name: string | null
          due_at: string | null
          entity_id: string | null
          entity_label: string | null
          entity_ref: string | null
          entity_type: Database["public"]["Enums"]["entity_type"] | null
          id: string | null
          installment_no: number | null
          is_overdue: boolean | null
          mga_id: string | null
          mga_name: string | null
          offer_valid_until: string | null
          outcome: string | null
          submission_id: string | null
          submission_status:
            | Database["public"]["Enums"]["submission_status"]
            | null
          title: string | null
          type: Database["public"]["Enums"]["follow_up_type"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_installments_v: {
        Row: {
          aging_bucket: string | null
          basis_mismatch: boolean | null
          basis_signed_share_pct: number | null
          broker_id: string | null
          broker_name: string | null
          brokerage_amount: number | null
          commission_amount: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          days_overdue: number | null
          due_date: string | null
          fx_rate_to_usd: number | null
          gross_amount: number | null
          id: string | null
          installment_no: number | null
          insured_name: string | null
          last_receipt_date: string | null
          mga_id: string | null
          mga_name: string | null
          net_amount: number | null
          net_amount_usd: number | null
          notes: string | null
          outstanding_amount: number | null
          outstanding_usd: number | null
          paid_amount: number | null
          payable_amount: number | null
          payable_usd: number | null
          ref_no: string | null
          settled_at: string | null
          signed_share_pct: number | null
          status: Database["public"]["Enums"]["installment_status"] | null
          submission_id: string | null
          submission_status:
            | Database["public"]["Enums"]["submission_status"]
            | null
          type: Database["public"]["Enums"]["installment_type"] | null
          underwriter_id: string | null
          underwriter_name: string | null
          updated_at: string | null
          updated_by: string | null
          written_off_at: string | null
          written_off_by: string | null
          written_off_by_name: string | null
          written_off_reason: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_installments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "binders_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "follow_ups_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "premium_schedule_check_v"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_installments_written_off_by_fkey"
            columns: ["written_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_receipts_v: {
        Row: {
          allocated_amount: number | null
          allocation_count: number | null
          amount: number | null
          amount_usd: number | null
          bank_reference: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          fx_rate_to_usd: number | null
          id: string | null
          notes: string | null
          payer_id: string | null
          payer_name: string | null
          payer_type: Database["public"]["Enums"]["counterparty_type"] | null
          received_date: string | null
          ref_no: string | null
          unallocated_amount: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_receipts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "premium_receipts_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_receipts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_schedule_check_v: {
        Row: {
          basis_mismatch: boolean | null
          currency: string | null
          difference: number | null
          expected_gross: number | null
          expected_net: number | null
          has_schedule: boolean | null
          installment_count: number | null
          payable_total: number | null
          ref_no: string | null
          scheduled_gross: number | null
          scheduled_net: number | null
          signed_share_pct: number | null
          submission_id: string | null
          total_net: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
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
          search_text: string | null
          share_pct: number | null
          signed_share_pct: number | null
          source_party_id: string | null
          source_party_name: string | null
          source_party_type:
            | Database["public"]["Enums"]["counterparty_type"]
            | null
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
        Relationships: [
          {
            foreignKeyName: "submissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_insured_country_fkey"
            columns: ["insured_country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_lob_id_fkey"
            columns: ["lob_id"]
            isOneToOne: false
            referencedRelation: "lines_of_business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_source_party_id_fkey"
            columns: ["source_party_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _seed_demo_binders: { Args: { p_actor: string }; Returns: Json }
      _seed_demo_claims: { Args: { p_actor: string }; Returns: Json }
      _seed_demo_data: { Args: { p_actor: string }; Returns: Json }
      admin_update_user: {
        Args: {
          p_active: boolean
          p_full_name?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_language: string
          role: Database["public"]["Enums"]["app_role"] | null
          ui_demo_mode: boolean
          ui_text_size: string
          ui_theme: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ai_available: { Args: never; Returns: boolean }
      apply_submission_status: {
        Args: {
          p_actor: string
          p_comment?: string
          p_document_id?: string
          p_offer_valid_until?: string
          p_signed_share_pct?: number
          p_submission_id: string
          p_to_status: Database["public"]["Enums"]["submission_status"]
          p_written_share_pct?: number
        }
        Returns: {
          binder_id: string | null
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
          is_demo: boolean
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
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      binder_capacity_alert: {
        Args: { p_binder_id: string }
        Returns: undefined
      }
      binder_periods: {
        Args: { p_binder_id: string }
        Returns: {
          bordereau_id: string
          due_date: string
          kind: Database["public"]["Enums"]["bordereau_kind"]
          period_end: string
          period_start: string
          received_date: string
          ref_no: string
          state: string
        }[]
      }
      can_edit_premium_schedule: {
        Args: { p_submission_id: string }
        Returns: boolean
      }
      can_read_claims_of: {
        Args: { p_submission_id: string }
        Returns: boolean
      }
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
        Returns: {
          binder_id: string | null
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
          is_demo: boolean
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
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_check_large_loss: {
        Args: { p_claim_id: string }
        Returns: undefined
      }
      claim_coverage_issues: {
        Args: {
          p_currency: string
          p_date_of_loss: string
          p_submission_id: string
        }
        Returns: string[]
      }
      claim_outstanding: { Args: { p_claim_id: string }; Returns: number }
      claim_signed_share: {
        Args: { p_date_of_loss: string; p_submission_id: string }
        Returns: number
      }
      create_claim_payment: {
        Args: { p_allocations?: Json; p_payment: Json }
        Returns: {
          amount: number
          bank_reference: string | null
          claim_id: string
          created_at: string
          currency: string
          entered_by: string | null
          id: string
          is_demo: boolean
          method: Database["public"]["Enums"]["claim_payment_method"]
          notes: string | null
          offset_receipt_id: string | null
          payee_id: string | null
          payment_date: string
          type: Database["public"]["Enums"]["claim_payment_type"]
        }
        SetofOptions: {
          from: "*"
          to: "claim_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_premium_receipt: {
        Args: { p_allocations?: Json; p_receipt: Json }
        Returns: {
          amount: number
          bank_reference: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_demo: boolean
          notes: string | null
          payer_id: string
          received_date: string
          ref_no: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "premium_receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_demo_data: { Args: never; Returns: Json }
      demo_data_counts: { Args: never; Returns: Json }
      demo_data_counts_all: { Args: never; Returns: Json }
      demo_link_violations: {
        Args: never
        Returns: {
          detail: string
          kind: string
          row_id: string
        }[]
      }
      demo_mode: { Args: never; Returns: boolean }
      entity_is_demo: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
      fx_rate_to_usd: {
        Args: { p_currency: string; p_date: string }
        Returns: number
      }
      generate_premium_schedule: {
        Args: { p_installments?: Json; p_submission_id: string }
        Returns: {
          basis_signed_share_pct: number | null
          brokerage_amount: number
          commission_amount: number
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          gross_amount: number
          id: string
          installment_no: number
          is_demo: boolean
          net_amount: number | null
          notes: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type: Database["public"]["Enums"]["installment_type"]
          updated_at: string
          updated_by: string | null
          written_off_at: string | null
          written_off_by: string | null
          written_off_reason: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "premium_installments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: { roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      import_bordereau: {
        Args: { p_bordereau: Json; p_lines: Json; p_rejected?: number }
        Returns: {
          binder_id: string
          computed_total: number | null
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          installment_ids: string[]
          is_demo: boolean
          kind: Database["public"]["Enums"]["bordereau_kind"]
          line_count: number
          notes: string | null
          period_end: string
          period_start: string
          received_date: string
          ref_no: string
          rejected_count: number
          stated_total: number | null
          template_id: string | null
          totals_comment: string | null
          warning_count: number
        }
        SetofOptions: {
          from: "*"
          to: "bordereaux"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_app_user: { Args: never; Returns: boolean }
      is_own_installment: {
        Args: { p_installment_id: string }
        Returns: boolean
      }
      next_ref_no: {
        Args: { p_scope: string; p_year: number }
        Returns: string
      }
      premium_close_overdue_follow_ups: {
        Args: { p_installment_id: string; p_reason: string }
        Returns: undefined
      }
      premium_installment_status: {
        Args: {
          p_id: string
          p_net: number
          p_settled_at: string
          p_type: Database["public"]["Enums"]["installment_type"]
          p_written_off_at: string
        }
        Returns: Database["public"]["Enums"]["installment_status"]
      }
      premium_refresh_installment: {
        Args: { p_installment_id: string }
        Returns: undefined
      }
      refresh_next_follow_up: {
        Args: {
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
        }
        Returns: undefined
      }
      run_daily_bordereau_follow_ups: { Args: never; Returns: Json }
      run_daily_claim_follow_ups: { Args: never; Returns: Json }
      run_daily_claim_follow_ups_now: { Args: never; Returns: Json }
      run_daily_follow_ups: { Args: never; Returns: Json }
      run_daily_follow_ups_now: { Args: never; Returns: Json }
      run_daily_premium_follow_ups: { Args: never; Returns: Json }
      run_daily_premium_follow_ups_now: { Args: never; Returns: Json }
      search_norm: { Args: { t: string }; Returns: string }
      seed_demo_data: { Args: never; Returns: Json }
      setting_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      setting_int: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      submission_next_statuses: {
        Args: { p_from: Database["public"]["Enums"]["submission_status"] }
        Returns: Database["public"]["Enums"]["submission_status"][]
      }
      tashkent_today: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "underwriter" | "finance" | "claims" | "management"
      binder_status: "draft" | "active" | "expired" | "cancelled"
      bordereau_frequency: "monthly" | "quarterly"
      bordereau_kind: "risk" | "premium" | "claims"
      bordereau_line_status: "ok" | "warning"
      business_type: "facultative" | "binder"
      claim_payment_method: "cash" | "offset_against_premium"
      claim_payment_type: "indemnity" | "expense" | "cash_call"
      claim_recovery_type: "salvage" | "subrogation" | "other"
      claim_status: "notified" | "open" | "closed" | "reopened" | "declined"
      counterparty_type: "mga" | "broker" | "cedent"
      doc_type:
        | "submission"
        | "slip"
        | "bordereau"
        | "invoice"
        | "debit_note"
        | "credit_note"
        | "claim_notice"
        | "loss_advice"
        | "correspondence"
        | "other"
        | "remittance_advice"
        | "adjuster_report"
        | "proof_of_loss"
        | "cash_call_request"
        | "payment_proof"
      entity_type:
        | "submission"
        | "premium"
        | "claim"
        | "bordereau"
        | "receipt"
        | "binder"
      follow_up_type:
        | "request_update"
        | "offer_expiry"
        | "other"
        | "premium_overdue"
        | "awaiting_documents"
        | "cash_call_due"
        | "claim_review"
        | "large_loss"
        | "bordereau_missing"
        | "capacity_alert"
      installment_status: "open" | "partially_paid" | "paid" | "written_off"
      installment_type: "original" | "additional" | "return"
      submission_status:
        | "received"
        | "under_review"
        | "declined"
        | "offered"
        | "bound"
        | "ntu"
        | "no_response"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "underwriter", "finance", "claims", "management"],
      binder_status: ["draft", "active", "expired", "cancelled"],
      bordereau_frequency: ["monthly", "quarterly"],
      bordereau_kind: ["risk", "premium", "claims"],
      bordereau_line_status: ["ok", "warning"],
      business_type: ["facultative", "binder"],
      claim_payment_method: ["cash", "offset_against_premium"],
      claim_payment_type: ["indemnity", "expense", "cash_call"],
      claim_recovery_type: ["salvage", "subrogation", "other"],
      claim_status: ["notified", "open", "closed", "reopened", "declined"],
      counterparty_type: ["mga", "broker", "cedent"],
      doc_type: [
        "submission",
        "slip",
        "bordereau",
        "invoice",
        "debit_note",
        "credit_note",
        "claim_notice",
        "loss_advice",
        "correspondence",
        "other",
        "remittance_advice",
        "adjuster_report",
        "proof_of_loss",
        "cash_call_request",
        "payment_proof",
      ],
      entity_type: [
        "submission",
        "premium",
        "claim",
        "bordereau",
        "receipt",
        "binder",
      ],
      follow_up_type: [
        "request_update",
        "offer_expiry",
        "other",
        "premium_overdue",
        "awaiting_documents",
        "cash_call_due",
        "claim_review",
        "large_loss",
        "bordereau_missing",
        "capacity_alert",
      ],
      installment_status: ["open", "partially_paid", "paid", "written_off"],
      installment_type: ["original", "additional", "return"],
      submission_status: [
        "received",
        "under_review",
        "declined",
        "offered",
        "bound",
        "ntu",
        "no_response",
      ],
    },
  },
} as const
