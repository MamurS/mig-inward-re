// Generated from the Supabase schema (project mig-inward-re). Regenerate after each migration.
// Hand edit kept: numeric RPC arguments of change_submission_status also accept exact decimal strings.
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
          net_amount: number | null
          notes: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type: Database["public"]["Enums"]["installment_type"]
          updated_at: string
          updated_by: string | null
          written_off_at: string | null
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
          net_amount?: number | null
          notes?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type?: Database["public"]["Enums"]["installment_type"]
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
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
          net_amount?: number | null
          notes?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          submission_id?: string
          type?: Database["public"]["Enums"]["installment_type"]
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
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
    Views: {
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
          {
            foreignKeyName: "submissions_mga_id_fkey"
            columns: ["mga_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
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
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      can_edit_premium_schedule: {
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
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
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
          net_amount: number | null
          notes: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
          submission_id: string
          type: Database["public"]["Enums"]["installment_type"]
          updated_at: string
          updated_by: string | null
          written_off_at: string | null
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
      run_daily_follow_ups: { Args: never; Returns: Json }
      run_daily_follow_ups_now: { Args: never; Returns: Json }
      run_daily_premium_follow_ups: { Args: never; Returns: Json }
      run_daily_premium_follow_ups_now: { Args: never; Returns: Json }
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
      business_type: "facultative" | "binder"
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
      entity_type: "submission" | "premium" | "claim" | "bordereau" | "receipt"
      follow_up_type:
        | "request_update"
        | "offer_expiry"
        | "other"
        | "premium_overdue"
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
      business_type: ["facultative", "binder"],
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
      ],
      entity_type: ["submission", "premium", "claim", "bordereau", "receipt"],
      follow_up_type: [
        "request_update",
        "offer_expiry",
        "other",
        "premium_overdue",
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
