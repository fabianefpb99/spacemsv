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
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          meta: Json
          read_by: string[]
          title: string
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_by?: string[]
          title: string
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          meta?: Json
          read_by?: string[]
          title?: string
          type?: Database["public"]["Enums"]["admin_notification_type"]
        }
        Relationships: []
      }
      arena_rounds: {
        Row: {
          bet_amount: number
          character_bet: string
          client_action_id: string | null
          combat_log: Json
          created_at: string
          id: string
          multiplier: number
          odds_snapshot: Json
          payout: number
          server_seed: string
          server_seed_hash: string
          user_id: string
          winner: string
          won: boolean
        }
        Insert: {
          bet_amount: number
          character_bet: string
          client_action_id?: string | null
          combat_log: Json
          created_at?: string
          id?: string
          multiplier: number
          odds_snapshot: Json
          payout?: number
          server_seed: string
          server_seed_hash: string
          user_id: string
          winner: string
          won: boolean
        }
        Update: {
          bet_amount?: number
          character_bet?: string
          client_action_id?: string | null
          combat_log?: Json
          created_at?: string
          id?: string
          multiplier?: number
          odds_snapshot?: Json
          payout?: number
          server_seed?: string
          server_seed_hash?: string
          user_id?: string
          winner?: string
          won?: boolean
        }
        Relationships: []
      }
      boost_sessions: {
        Row: {
          cleanup_summary: Json | null
          created_at: string
          ended_at: string | null
          ended_by: string | null
          excluded_games: string[]
          id: string
          rtp_value: number
          started_at: string
          started_by: string
          target_user_id: string
        }
        Insert: {
          cleanup_summary?: Json | null
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          excluded_games?: string[]
          id?: string
          rtp_value?: number
          started_at?: string
          started_by: string
          target_user_id: string
        }
        Update: {
          cleanup_summary?: Json | null
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          excluded_games?: string[]
          id?: string
          rtp_value?: number
          started_at?: string
          started_by?: string
          target_user_id?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      game_red_state: {
        Row: {
          game: string
          last_alert_at: string
          last_net: number
        }
        Insert: {
          game: string
          last_alert_at?: string
          last_net?: number
        }
        Update: {
          game?: string
          last_alert_at?: string
          last_net?: number
        }
        Relationships: []
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
      home_featured_games: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link: string
          name: string
          position: number
          tag: string
          tag_color: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          link?: string
          name: string
          position?: number
          tag?: string
          tag_color?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string
          name?: string
          position?: number
          tag?: string
          tag_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_slides: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string
          cta_link: string
          description: string
          eyebrow: string
          id: string
          image_url: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string
          cta_link?: string
          description?: string
          eyebrow?: string
          id?: string
          image_url: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string
          cta_link?: string
          description?: string
          eyebrow?: string
          id?: string
          image_url?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      jackpot_state: {
        Row: {
          amount: number
          id: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          id?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          accent: string
          created_at: string
          cta_label: string
          cta_to: string
          goal: number
          icon_key: string
          id: string
          is_active: boolean
          metric: string
          min_amount: number
          reward_image_url: string | null
          reward_kind: string
          reward_label: string
          reward_value: number
          sort_order: number
          subtitle: string | null
          title: string
          trigger_event: string
          trigger_game: string | null
          type: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          cta_label?: string
          cta_to?: string
          goal?: number
          icon_key?: string
          id?: string
          is_active?: boolean
          metric?: string
          min_amount?: number
          reward_image_url?: string | null
          reward_kind: string
          reward_label?: string
          reward_value?: number
          sort_order?: number
          subtitle?: string | null
          title: string
          trigger_event?: string
          trigger_game?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          cta_label?: string
          cta_to?: string
          goal?: number
          icon_key?: string
          id?: string
          is_active?: boolean
          metric?: string
          min_amount?: number
          reward_image_url?: string | null
          reward_kind?: string
          reward_label?: string
          reward_value?: number
          sort_order?: number
          subtitle?: string | null
          title?: string
          trigger_event?: string
          trigger_game?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_key: string | null
          birth_date: string | null
          created_at: string
          document_issue_date: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          first_deposit_at: string | null
          first_name: string | null
          gender: string | null
          id: string
          is_blocked: boolean
          last_name: string | null
          phone: string | null
          phone_verified: boolean
          profile_completed: boolean
          referral_code: string | null
          referred_by: string | null
          second_last_name: string | null
          second_name: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          vip_last_seen_level: number
        }
        Insert: {
          avatar_key?: string | null
          birth_date?: string | null
          created_at?: string
          document_issue_date?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_deposit_at?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          is_blocked?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          profile_completed?: boolean
          referral_code?: string | null
          referred_by?: string | null
          second_last_name?: string | null
          second_name?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vip_last_seen_level?: number
        }
        Update: {
          avatar_key?: string | null
          birth_date?: string | null
          created_at?: string
          document_issue_date?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_deposit_at?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          is_blocked?: boolean
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          profile_completed?: boolean
          referral_code?: string | null
          referred_by?: string | null
          second_last_name?: string | null
          second_name?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          vip_last_seen_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "admin_users_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_config: {
        Row: {
          green_weight: number
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          green_weight?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          green_weight?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sports_bets: {
        Row: {
          created_at: string
          id: string
          match_id: string
          odds: number
          payout: number | null
          potential_payout: number
          selection: Database["public"]["Enums"]["sports_bet_selection"]
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["sports_bet_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          odds: number
          payout?: number | null
          potential_payout: number
          selection: Database["public"]["Enums"]["sports_bet_selection"]
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["sports_bet_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          odds?: number
          payout?: number | null
          potential_payout?: number
          selection?: Database["public"]["Enums"]["sports_bet_selection"]
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["sports_bet_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "sports_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_competitions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sports_matches: {
        Row: {
          away_flag_code: string
          away_name: string
          away_score: number | null
          bets_closed_at: string | null
          cancelled_at: string | null
          competition_id: string
          created_at: string
          home_flag_code: string
          home_name: string
          home_score: number | null
          id: string
          is_featured: boolean
          is_published: boolean
          odds_away: number
          odds_draw: number
          odds_home: number
          settled_at: string | null
          slug: string
          start_at: string
          status: Database["public"]["Enums"]["sports_match_status"]
          updated_at: string
        }
        Insert: {
          away_flag_code: string
          away_name: string
          away_score?: number | null
          bets_closed_at?: string | null
          cancelled_at?: string | null
          competition_id: string
          created_at?: string
          home_flag_code: string
          home_name: string
          home_score?: number | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          odds_away: number
          odds_draw: number
          odds_home: number
          settled_at?: string | null
          slug: string
          start_at: string
          status?: Database["public"]["Enums"]["sports_match_status"]
          updated_at?: string
        }
        Update: {
          away_flag_code?: string
          away_name?: string
          away_score?: number | null
          bets_closed_at?: string | null
          cancelled_at?: string | null
          competition_id?: string
          created_at?: string
          home_flag_code?: string
          home_name?: string
          home_score?: number | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          odds_away?: number
          odds_draw?: number
          odds_home?: number
          settled_at?: string | null
          slug?: string
          start_at?: string
          status?: Database["public"]["Enums"]["sports_match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "sports_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      user_avatar_unlocks: {
        Row: {
          image_url: string | null
          label: string | null
          mission_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          image_url?: string | null
          label?: string | null
          mission_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          image_url?: string | null
          label?: string | null
          mission_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_unlocks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          balance: number
          bonus_balance: number
          free_spins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus_balance?: number
          free_spins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus_balance?: number
          free_spins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          period_start: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          period_start: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          period_start?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
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
      user_vip: {
        Row: {
          current_level: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_vip_rewards: {
        Row: {
          claimed_at: string | null
          id: string
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount: number
          reward_avatar_key: string | null
          reward_image_url: string | null
          reward_kind: string
          reward_label: string | null
          sub_division: Database["public"]["Enums"]["vip_sub"]
          unlocked_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          reward_avatar_key?: string | null
          reward_image_url?: string | null
          reward_kind: string
          reward_label?: string | null
          sub_division: Database["public"]["Enums"]["vip_sub"]
          unlocked_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          rank?: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          reward_avatar_key?: string | null
          reward_image_url?: string | null
          reward_kind?: string
          reward_label?: string | null
          sub_division?: Database["public"]["Enums"]["vip_sub"]
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vip_config: {
        Row: {
          cap_level: number
          id: boolean
          is_active: boolean
          min_bet_for_xp: number
          updated_at: string
          updated_by: string | null
          xp_log_factor: number
          xp_log_scale: number
          xp_per_bet_base: number
        }
        Insert: {
          cap_level?: number
          id?: boolean
          is_active?: boolean
          min_bet_for_xp?: number
          updated_at?: string
          updated_by?: string | null
          xp_log_factor?: number
          xp_log_scale?: number
          xp_per_bet_base?: number
        }
        Update: {
          cap_level?: number
          id?: boolean
          is_active?: boolean
          min_bet_for_xp?: number
          updated_at?: string
          updated_by?: string | null
          xp_log_factor?: number
          xp_log_scale?: number
          xp_per_bet_base?: number
        }
        Relationships: []
      }
      vip_levels: {
        Row: {
          level: number
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount: number
          sub_division: Database["public"]["Enums"]["vip_sub"]
          xp_required: number
        }
        Insert: {
          level: number
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          sub_division: Database["public"]["Enums"]["vip_sub"]
          xp_required: number
        }
        Update: {
          level?: number
          rank?: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          sub_division?: Database["public"]["Enums"]["vip_sub"]
          xp_required?: number
        }
        Relationships: []
      }
      vip_rank_rewards: {
        Row: {
          is_active: boolean
          min_level: number
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount: number
          reward_avatar_key: string | null
          reward_image_url: string | null
          reward_kind: string
          reward_label: string | null
          sub_division: Database["public"]["Enums"]["vip_sub"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_active?: boolean
          min_level: number
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          reward_avatar_key?: string | null
          reward_image_url?: string | null
          reward_kind?: string
          reward_label?: string | null
          sub_division: Database["public"]["Enums"]["vip_sub"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_active?: boolean
          min_level?: number
          rank?: Database["public"]["Enums"]["vip_rank"]
          reward_amount?: number
          reward_avatar_key?: string | null
          reward_image_url?: string | null
          reward_kind?: string
          reward_label?: string | null
          sub_division?: Database["public"]["Enums"]["vip_sub"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      withdrawal_accounts: {
        Row: {
          bank_label: string | null
          created_at: string
          id: string
          identifier: string
          is_default: boolean
          method: Database["public"]["Enums"]["deposit_method"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_label?: string | null
          created_at?: string
          id?: string
          identifier: string
          is_default?: boolean
          method: Database["public"]["Enums"]["deposit_method"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_label?: string | null
          created_at?: string
          id?: string
          identifier?: string
          is_default?: boolean
          method?: Database["public"]["Enums"]["deposit_method"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_identifier: string
          account_label: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          debit_tx_id: string | null
          email: string | null
          fee: number
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance: number | null
          prev_balance: number | null
          refund_tx_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          account_identifier: string
          account_label?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          debit_tx_id?: string | null
          email?: string | null
          fee?: number
          id?: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance?: number | null
          prev_balance?: number | null
          refund_tx_id?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          account_identifier?: string
          account_label?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          debit_tx_id?: string | null
          email?: string | null
          fee?: number
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"]
          net_amount?: number
          new_balance?: number | null
          prev_balance?: number | null
          refund_tx_id?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_users_overview: {
        Row: {
          avatar_key: string | null
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
      _award_mission_progress: {
        Args: {
          p_amount: number
          p_event: string
          p_game: string
          p_user_id: string
        }
        Returns: undefined
      }
      _check_vip_rewards: {
        Args: { p_level: number; p_user_id: string }
        Returns: undefined
      }
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
      _gen_referral_code: { Args: never; Returns: string }
      _mission_period_start: { Args: { p_type: string }; Returns: string }
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
          p_reason: string
          p_target: string
          p_target_user_id: string
        }
        Returns: {
          new_balance: number
          new_bonus: number
        }[]
      }
      admin_adjust_xp: {
        Args: { p_delta: number; p_reason?: string; p_target_user_id: string }
        Returns: {
          out_current_level: number
          out_total_xp: number
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
      admin_approve_withdrawal: {
        Args: { p_id: string }
        Returns: {
          account_identifier: string
          account_label: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          debit_tx_id: string | null
          email: string | null
          fee: number
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance: number | null
          prev_balance: number | null
          refund_tx_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
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
      admin_reject_withdrawal: {
        Args: { p_id: string; p_reason: string }
        Returns: {
          account_identifier: string
          account_label: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          debit_tx_id: string | null
          email: string | null
          fee: number
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance: number | null
          prev_balance: number | null
          refund_tx_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reset_vip_progress: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_set_block: {
        Args: { p_blocked: boolean; p_target_user_id: string }
        Returns: boolean
      }
      admin_start_boost: {
        Args: { p_rtp?: number; p_target_user_id: string }
        Returns: {
          cleanup_summary: Json | null
          created_at: string
          ended_at: string | null
          ended_by: string | null
          excluded_games: string[]
          id: string
          rtp_value: number
          started_at: string
          started_by: string
          target_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "boost_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_stop_boost: { Args: { p_dry_run?: boolean }; Returns: Json }
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
      admin_upsert_vip_reward: {
        Args: {
          p_amount: number
          p_avatar_key: string
          p_image_url: string
          p_is_active: boolean
          p_kind: string
          p_label: string
          p_rank: Database["public"]["Enums"]["vip_rank"]
          p_sub: Database["public"]["Enums"]["vip_sub"]
        }
        Returns: {
          is_active: boolean
          min_level: number
          rank: Database["public"]["Enums"]["vip_rank"]
          reward_amount: number
          reward_avatar_key: string | null
          reward_image_url: string | null
          reward_kind: string
          reward_label: string | null
          sub_division: Database["public"]["Enums"]["vip_sub"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vip_rank_rewards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_xp: {
        Args: { p_bet_amount: number; p_user_id: string }
        Returns: undefined
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
      boost_autoclose_expired: { Args: never; Returns: Json }
      cancel_deposit_request: {
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
      cancel_withdrawal_request: {
        Args: { p_id: string }
        Returns: {
          account_identifier: string
          account_label: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          debit_tx_id: string | null
          email: string | null
          fee: number
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance: number | null
          prev_balance: number | null
          refund_tx_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_vip_reward: { Args: { p_reward_id: string }; Returns: Json }
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
      create_withdrawal_request: {
        Args: {
          p_account_identifier: string
          p_account_label?: string
          p_amount: number
          p_method: Database["public"]["Enums"]["deposit_method"]
        }
        Returns: {
          account_identifier: string
          account_label: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          debit_tx_id: string | null
          email: string | null
          fee: number
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          net_amount: number
          new_balance: number | null
          prev_balance: number | null
          refund_tx_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_big_single_payouts: {
        Args: {
          p_min_net?: number
          p_min_win?: number
          p_window_minutes?: number
        }
        Returns: number
      }
      detect_games_in_red:
        | {
            Args: {
              p_cooldown_minutes?: number
              p_min_handle?: number
              p_min_loss?: number
              p_min_payout_ratio?: number
              p_min_txs?: number
              p_window_minutes?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_cooldown_minutes?: number
              p_min_loss?: number
              p_min_txs?: number
              p_window_minutes?: number
            }
            Returns: number
          }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_pending_deposits: { Args: never; Returns: number }
      get_my_today_position: {
        Args: never
        Returns: {
          net_amount: number
          rank: number
        }[]
      }
      get_recent_public_wins: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          avatar_key: string
          created_at: string
          game: string
          multiplier: number
          user_id: string
          username: string
        }[]
      }
      get_referral_stats: {
        Args: never
        Returns: {
          deposited: number
          invited: number
        }[]
      }
      get_today_top_arena: {
        Args: { p_limit?: number }
        Returns: {
          avatar_key: string
          net_amount: number
          user_id: string
          username: string
        }[]
      }
      get_today_top_winners: {
        Args: { p_limit?: number }
        Returns: {
          avatar_key: string
          net_amount: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_jackpot: { Args: { p_delta?: number }; Returns: number }
      is_boost_target: {
        Args: { p_game?: string; p_user_id: string }
        Returns: boolean
      }
      mark_admin_notification_read: {
        Args: { p_id: string }
        Returns: undefined
      }
      mark_all_admin_notifications_read: { Args: never; Returns: number }
      mark_vip_level_seen: { Args: never; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      play_arena_v1: {
        Args: {
          p_bet_amount: number
          p_character: string
          p_client_action_id: string
          p_odds_perm?: number[]
          p_user_id: string
        }
        Returns: Json
      }
      play_arena_v2: {
        Args: {
          p_bet_amount: number
          p_character: string
          p_client_action_id: string
          p_odds_perm?: number[]
        }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_referral: { Args: { p_code: string }; Returns: Json }
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
      spin_roulette_v1: {
        Args: {
          p_bet_amount: number
          p_choice: string
          p_client_action_id: string
          p_user_id: string
        }
        Returns: Json
      }
      spin_roulette_v2: {
        Args: {
          p_bet_amount: number
          p_choice: string
          p_client_action_id: string
        }
        Returns: Json
      }
      spin_slot_v1: {
        Args: {
          p_bet_amount: number
          p_client_action_id: string
          p_user_id: string
        }
        Returns: Json
      }
      sports_auto_transition: { Args: never; Returns: number }
      sports_cancel_match: { Args: { _match_id: string }; Returns: undefined }
      sports_place_bet: {
        Args: {
          _match_id: string
          _selection: Database["public"]["Enums"]["sports_bet_selection"]
          _stake: number
        }
        Returns: string
      }
      sports_settle_match: {
        Args: { _away_score: number; _home_score: number; _match_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_notification_type:
        | "new_user"
        | "recharge_request"
        | "game_red_alert"
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
      sports_bet_selection: "home" | "draw" | "away"
      sports_bet_status: "pending" | "won" | "lost" | "refunded"
      sports_match_status: "scheduled" | "live" | "finished" | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "bet"
        | "win"
        | "bonus"
        | "adjustment"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
      vip_rank:
        | "bronce"
        | "plata"
        | "oro"
        | "platino"
        | "diamante"
        | "maestro"
        | "leyenda"
      vip_sub: "V" | "IV" | "III" | "II" | "I"
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
      admin_notification_type: [
        "new_user",
        "recharge_request",
        "game_red_alert",
      ],
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
      sports_bet_selection: ["home", "draw", "away"],
      sports_bet_status: ["pending", "won", "lost", "refunded"],
      sports_match_status: ["scheduled", "live", "finished", "cancelled"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "bet",
        "win",
        "bonus",
        "adjustment",
      ],
      verification_status: ["unverified", "pending", "verified", "rejected"],
      vip_rank: [
        "bronce",
        "plata",
        "oro",
        "platino",
        "diamante",
        "maestro",
        "leyenda",
      ],
      vip_sub: ["V", "IV", "III", "II", "I"],
    },
  },
} as const
