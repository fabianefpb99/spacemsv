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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          meta: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bonus: number
          bonus_applied: number | null
          confirmed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance: number | null
          payer_first_name: string | null
          payer_ip: string | null
          payer_last_name: string | null
          payer_phone: string | null
          payer_self: boolean | null
          prev_balance: number | null
          reference: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bonus?: number
          bonus_applied?: number | null
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance?: number | null
          payer_first_name?: string | null
          payer_ip?: string | null
          payer_last_name?: string | null
          payer_phone?: string | null
          payer_self?: boolean | null
          prev_balance?: number | null
          reference: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bonus?: number
          bonus_applied?: number | null
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"]
          new_balance?: number | null
          payer_first_name?: string | null
          payer_ip?: string | null
          payer_last_name?: string | null
          payer_phone?: string | null
          payer_self?: boolean | null
          prev_balance?: number | null
          reference?: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      game_bets: {
        Row: {
          amount: number
          cashout_multiplier: number | null
          client_action_id: string
          created_at: string
          id: string
          payout: number | null
          round_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["game_bet_status"]
          user_id: string
        }
        Insert: {
          amount: number
          cashout_multiplier?: number | null
          client_action_id: string
          created_at?: string
          id?: string
          payout?: number | null
          round_id: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["game_bet_status"]
          user_id: string
        }
        Update: {
          amount?: number
          cashout_multiplier?: number | null
          client_action_id?: string
          created_at?: string
          id?: string
          payout?: number | null
          round_id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["game_bet_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          betting_ends_at: string
          client_seed: string | null
          crash_multiplier: number | null
          created_at: string
          ended_at: string | null
          game: string
          id: string
          server_seed: string | null
          server_seed_hash: string
          started_at: string | null
          status: Database["public"]["Enums"]["game_round_status"]
        }
        Insert: {
          betting_ends_at: string
          client_seed?: string | null
          crash_multiplier?: number | null
          created_at?: string
          ended_at?: string | null
          game: string
          id?: string
          server_seed?: string | null
          server_seed_hash: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_round_status"]
        }
        Update: {
          betting_ends_at?: string
          client_seed?: string | null
          crash_multiplier?: number | null
          created_at?: string
          ended_at?: string | null
          game?: string
          id?: string
          server_seed?: string | null
          server_seed_hash?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_round_status"]
        }
        Relationships: []
      }
      game_rtp_config: {
        Row: {
          game: string
          is_active: boolean
          rtp_baseline: number
          rtp_target: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          game: string
          is_active?: boolean
          rtp_baseline: number
          rtp_target: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          game?: string
          is_active?: boolean
          rtp_baseline?: number
          rtp_target?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          bet_amount: number
          client_action_id: string
          client_seed: string | null
          closed_at: string | null
          created_at: string
          game: string
          id: string
          nonce: number
          payout: number | null
          public_state: Json
          server_seed: string
          server_seed_hash: string
          state: Json
          status: Database["public"]["Enums"]["game_session_status"]
          user_id: string
        }
        Insert: {
          bet_amount: number
          client_action_id: string
          client_seed?: string | null
          closed_at?: string | null
          created_at?: string
          game: string
          id?: string
          nonce?: number
          payout?: number | null
          public_state?: Json
          server_seed: string
          server_seed_hash: string
          state?: Json
          status?: Database["public"]["Enums"]["game_session_status"]
          user_id: string
        }
        Update: {
          bet_amount?: number
          client_action_id?: string
          client_seed?: string | null
          closed_at?: string | null
          created_at?: string
          game?: string
          id?: string
          nonce?: number
          payout?: number | null
          public_state?: Json
          server_seed?: string
          server_seed_hash?: string
          state?: Json
          status?: Database["public"]["Enums"]["game_session_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          document_issue_date: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          first_name: string | null
          id: string
          is_blocked: boolean
          last_name: string | null
          phone: string | null
          updated_at: string
          username: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          document_issue_date?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          is_blocked?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          document_issue_date?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_blocked?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          client_action_id: string | null
          created_at: string
          game: string | null
          game_round_id: string | null
          id: string
          meta: Json
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          client_action_id?: string | null
          created_at?: string
          game?: string | null
          game_round_id?: string | null
          id?: string
          meta?: Json
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          client_action_id?: string | null
          created_at?: string
          game?: string | null
          game_round_id?: string | null
          id?: string
          meta?: Json
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_balances: {
        Row: {
          balance: number
          bonus_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_users_overview: {
        Row: {
          balance: number | null
          bonus_balance: number | null
          created_at: string | null
          email: string | null
          id: string | null
          is_blocked: boolean | null
          username: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      game_sessions_public: {
        Row: {
          bet_amount: number | null
          client_seed: string | null
          closed_at: string | null
          created_at: string | null
          game: string | null
          id: string | null
          nonce: number | null
          payout: number | null
          public_state: Json | null
          server_seed: string | null
          server_seed_hash: string | null
          state_revealed: Json | null
          status: Database["public"]["Enums"]["game_session_status"] | null
          user_id: string | null
        }
        Insert: {
          bet_amount?: number | null
          client_seed?: string | null
          closed_at?: string | null
          created_at?: string | null
          game?: string | null
          id?: string | null
          nonce?: number | null
          payout?: number | null
          public_state?: Json | null
          server_seed?: never
          server_seed_hash?: string | null
          state_revealed?: never
          status?: Database["public"]["Enums"]["game_session_status"] | null
          user_id?: string | null
        }
        Update: {
          bet_amount?: number | null
          client_seed?: string | null
          closed_at?: string | null
          created_at?: string | null
          game?: string | null
          id?: string | null
          nonce?: number | null
          payout?: number | null
          public_state?: Json | null
          server_seed?: never
          server_seed_hash?: string | null
          state_revealed?: never
          status?: Database["public"]["Enums"]["game_session_status"] | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _credit_win: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          new_balance: number
          new_bonus: number
        }[]
      }
      _debit_bet: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          from_bonus: number
          from_real: number
          new_balance: number
          new_bonus: number
        }[]
      }
      _gen_deposit_reference: { Args: never; Returns: string }
      _spaceman_gen_crash: { Args: { p_server_seed: string }; Returns: number }
      adjust_balance: {
        Args: {
          p_client_action_id?: string
          p_delta: number
          p_game?: string
          p_game_round_id?: string
          p_meta?: Json
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_user_id: string
        }
        Returns: {
          new_balance: number
          transaction_id: string
          was_duplicate: boolean
        }[]
      }
      admin_adjust_balance: {
        Args: {
          p_delta: number
          p_reason?: string
          p_target: string
          p_target_user_id: string
        }
        Returns: {
          new_balance: number
          new_bonus: number
        }[]
      }
      admin_approve_deposit: {
        Args: { p_id: string }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bonus: number
          bonus_applied: number | null
          confirmed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance: number | null
          payer_first_name: string | null
          payer_ip: string | null
          payer_last_name: string | null
          payer_phone: string | null
          payer_self: boolean | null
          prev_balance: number | null
          reference: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposit_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reject_deposit: {
        Args: { p_id: string; p_reason: string }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bonus: number
          bonus_applied: number | null
          confirmed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance: number | null
          payer_first_name: string | null
          payer_ip: string | null
          payer_last_name: string | null
          payer_phone: string | null
          payer_self: boolean | null
          prev_balance: number | null
          reference: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposit_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_block: {
        Args: { p_blocked: boolean; p_target_user_id: string }
        Returns: boolean
      }
      admin_update_rtp: {
        Args: { p_game: string; p_is_active?: boolean; p_rtp_target: number }
        Returns: {
          game: string
          is_active: boolean
          rtp_baseline: number
          rtp_target: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "game_rtp_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bj_apply_action: {
        Args: {
          p_expected_nonce: number
          p_new_payout?: number
          p_new_public_state: Json
          p_new_state: Json
          p_new_status: Database["public"]["Enums"]["game_session_status"]
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          bet_amount: number
          client_action_id: string
          client_seed: string | null
          closed_at: string | null
          created_at: string
          game: string
          id: string
          nonce: number
          payout: number | null
          public_state: Json
          server_seed: string
          server_seed_hash: string
          state: Json
          status: Database["public"]["Enums"]["game_session_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_deposit_request: {
        Args: {
          p_first_name: string
          p_id: string
          p_ip: string
          p_last_name: string
          p_payer_self: boolean
          p_phone: string
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bonus: number
          bonus_applied: number | null
          confirmed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance: number | null
          payer_first_name: string | null
          payer_ip: string | null
          payer_last_name: string | null
          payer_phone: string | null
          payer_self: boolean | null
          prev_balance: number | null
          reference: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposit_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_deposit_request: {
        Args: {
          p_amount: number
          p_bonus: number
          p_method: Database["public"]["Enums"]["deposit_method"]
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bonus: number
          bonus_applied: number | null
          confirmed_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          new_balance: number | null
          payer_first_name: string | null
          payer_ip: string | null
          payer_last_name: string | null
          payer_phone: string | null
          payer_self: boolean | null
          prev_balance: number | null
          reference: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposit_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_pending_deposits: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      spaceman_cashout: {
        Args: {
          p_client_action_id: string
          p_client_elapsed_ms: number
          p_round_id: string
        }
        Returns: Json
      }
      spaceman_current_round: { Args: never; Returns: Json }
      spaceman_mult_at_ms: { Args: { p_elapsed_ms: number }; Returns: number }
      spaceman_place_bet: {
        Args: {
          p_amount: number
          p_client_action_id: string
          p_round_id: string
        }
        Returns: Json
      }
      spaceman_tick: { Args: never; Returns: Json }
      spin_slot_v1: {
        Args: {
          p_bet_amount: number
          p_client_action_id: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      deposit_method: "nequi" | "breb"
      deposit_status:
        | "pendiente_pago"
        | "pendiente_revision"
        | "aprobada"
        | "rechazada"
        | "expirada"
      game_bet_status: "active" | "cashed_out" | "lost" | "refunded"
      game_round_status: "betting" | "running" | "crashed" | "settled"
      game_session_status:
        | "open"
        | "won"
        | "lost"
        | "cashed_out"
        | "aborted"
        | "closed"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "bet"
        | "win"
        | "bonus"
        | "adjustment"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
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
      app_role: ["admin", "user"],
      deposit_method: ["nequi", "breb"],
      deposit_status: [
        "pendiente_pago",
        "pendiente_revision",
        "aprobada",
        "rechazada",
        "expirada",
      ],
      game_bet_status: ["active", "cashed_out", "lost", "refunded"],
      game_round_status: ["betting", "running", "crashed", "settled"],
      game_session_status: [
        "open",
        "won",
        "lost",
        "cashed_out",
        "aborted",
        "closed",
      ],
      transaction_type: [
        "deposit",
        "withdrawal",
        "bet",
        "win",
        "bonus",
        "adjustment",
      ],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
