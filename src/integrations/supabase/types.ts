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
      app_state: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clubs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
          province: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string | null
          province?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
          province?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      intelligence_reports: {
        Row: {
          analysis: Json | null
          created_at: string
          id: string
          insights: Json
          model: string | null
          scope: string
          scope_ref: string | null
          summary_md: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          id?: string
          insights?: Json
          model?: string | null
          scope: string
          scope_ref?: string | null
          summary_md?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          id?: string
          insights?: Json
          model?: string | null
          scope?: string
          scope_ref?: string | null
          summary_md?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          gender: string | null
          id: string
          name: string
          season: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          name: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          name?: string
          season?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      live_recordings: {
        Row: {
          chunk_count: number
          chunk_manifest: Json
          created_at: string
          duration_ms: number
          ended_at: string | null
          id: string
          match_id: string
          owner_id: string
          session_id: string
          started_at: string
          status: string
          storage_prefix: string
          updated_at: string
        }
        Insert: {
          chunk_count?: number
          chunk_manifest?: Json
          created_at?: string
          duration_ms?: number
          ended_at?: string | null
          id?: string
          match_id: string
          owner_id: string
          session_id?: string
          started_at?: string
          status?: string
          storage_prefix: string
          updated_at?: string
        }
        Update: {
          chunk_count?: number
          chunk_manifest?: Json
          created_at?: string
          duration_ms?: number
          ended_at?: string | null
          id?: string
          match_id?: string
          owner_id?: string
          session_id?: string
          started_at?: string
          status?: string
          storage_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_deletion_audit: {
        Row: {
          created_at: string
          id: string
          match_id: string
          reason: string | null
          result: string
          role: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          reason?: string | null
          result: string
          role: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          reason?: string | null
          result?: string
          role?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      match_deletions: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          match_id: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          match_id: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          match_id?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          match_id: string
          payload: Json
          set_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          match_id: string
          payload?: Json
          set_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          match_id?: string
          payload?: Json
          set_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          confirmed: boolean
          lineup: string[]
          match_id: string
          set_number: number
          side: string
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          lineup?: string[]
          match_id: string
          set_number: number
          side: string
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          lineup?: string[]
          match_id?: string
          set_number?: number
          side?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sets: {
        Row: {
          finished: boolean
          match_id: string
          number: number
          score_a: number
          score_b: number
          started_at: string | null
          updated_at: string
        }
        Insert: {
          finished?: boolean
          match_id: string
          number: number
          score_a?: number
          score_b?: number
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          finished?: boolean
          match_id?: string
          number?: number
          score_a?: number
          score_b?: number
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_videos: {
        Row: {
          created_at: string
          created_by: string | null
          duration_sec: number | null
          external_url: string | null
          favorite: boolean
          fps: number | null
          id: string
          last_position_sec: number | null
          match_id: string
          source: string
          storage_path: string | null
          sync_offset_ms: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          external_url?: string | null
          favorite?: boolean
          fps?: number | null
          id?: string
          last_position_sec?: number | null
          match_id: string
          source: string
          storage_path?: string | null
          sync_offset_ms?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          external_url?: string | null
          favorite?: boolean
          fps?: number | null
          id?: string
          last_position_sec?: number | null
          match_id?: string
          source?: string
          storage_path?: string | null
          sync_offset_ms?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_videos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          captain_a_id: string | null
          captain_b_id: string | null
          created_at: string
          created_by: string | null
          id: string
          initial_serving_side: string
          league_id: string
          libero_a1_id: string | null
          libero_a2_id: string | null
          libero_b1_id: string | null
          libero_b2_id: string | null
          points_per_set: number
          scheduled_at: string
          sets_to_win: number
          sides_flipped: boolean
          status: string
          team_a_id: string
          team_b_id: string
          updated_at: string
        }
        Insert: {
          captain_a_id?: string | null
          captain_b_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_serving_side?: string
          league_id: string
          libero_a1_id?: string | null
          libero_a2_id?: string | null
          libero_b1_id?: string | null
          libero_b2_id?: string | null
          points_per_set?: number
          scheduled_at?: string
          sets_to_win?: number
          sides_flipped?: boolean
          status?: string
          team_a_id: string
          team_b_id: string
          updated_at?: string
        }
        Update: {
          captain_a_id?: string | null
          captain_b_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_serving_side?: string
          league_id?: string
          libero_a1_id?: string | null
          libero_a2_id?: string | null
          libero_b1_id?: string | null
          libero_b2_id?: string | null
          points_per_set?: number
          scheduled_at?: string
          sets_to_win?: number
          sides_flipped?: boolean
          status?: string
          team_a_id?: string
          team_b_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_captain_a_id_fkey"
            columns: ["captain_a_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_captain_b_id_fkey"
            columns: ["captain_b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_libero_a1_id_fkey"
            columns: ["libero_a1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_libero_a2_id_fkey"
            columns: ["libero_a2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_libero_b1_id_fkey"
            columns: ["libero_b1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_libero_b2_id_fkey"
            columns: ["libero_b2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          alias: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          dominant_hand: string | null
          first_name: string
          height_cm: number | null
          last_name: string
          photo_url: string | null
          show_club: boolean
          show_stats: boolean
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          alias?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          dominant_hand?: string | null
          first_name: string
          height_cm?: number | null
          last_name: string
          photo_url?: string | null
          show_club?: boolean
          show_stats?: boolean
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          alias?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          dominant_hand?: string | null
          first_name?: string
          height_cm?: number | null
          last_name?: string
          photo_url?: string | null
          show_club?: boolean
          show_stats?: boolean
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      player_registration_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          short_code: string
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          short_code?: string
          team_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          short_code?: string
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_registration_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          created_at: string
          id: string
          name: string
          number: number
          photo_url: string | null
          position: string | null
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          id?: string
          name: string
          number: number
          photo_url?: string | null
          position?: string | null
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          id?: string
          name?: string
          number?: number
          photo_url?: string | null
          position?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      public_matches: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_public: boolean
          match_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          is_public?: boolean
          match_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_public?: boolean
          match_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_coaches: {
        Row: {
          assigned_by: string | null
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          club_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          intended_role: string
          multi_use: boolean
          status: string
          team_id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          intended_role?: string
          multi_use?: boolean
          status?: string
          team_id: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          intended_role?: string
          multi_use?: boolean
          status?: string
          team_id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          club_id: string | null
          id: string
          joined_at: string
          number: number | null
          player_id: string | null
          position: string | null
          role: string
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          club_id?: string | null
          id?: string
          joined_at?: string
          number?: number | null
          player_id?: string | null
          position?: string | null
          role?: string
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          club_id?: string | null
          id?: string
          joined_at?: string
          number?: number | null
          player_id?: string | null
          position?: string | null
          role?: string
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
          category: string | null
          club: string | null
          club_id: string | null
          color: string
          created_at: string
          created_by: string | null
          gender: string | null
          id: string
          league_id: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          secondary_color: string | null
          short_name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          club?: string | null
          club_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          secondary_color?: string | null
          short_name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          club?: string | null
          club_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          secondary_color?: string | null
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_league_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          league_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          league_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_league_access_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create_matches: boolean
          can_manage_teams: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create_matches?: boolean
          can_manage_teams?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create_matches?: boolean
          can_manage_teams?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: { Args: { _token: string }; Returns: string }
      admin_club_directory: {
        Args: { _limit: number; _offset: number; _search: string }
        Returns: {
          categories: number
          city: string
          coaches: number
          id: string
          logo_url: string
          name: string
          pending: number
          planilleros: number
          players: number
          primary_color: string
          province: string
          total_count: number
        }[]
      }
      admin_club_staff: {
        Args: { _club: string }
        Returns: {
          team_id: string
          user_id: string
        }[]
      }
      admin_club_users: {
        Args: {
          _club: string
          _kind: string
          _limit: number
          _offset: number
          _search: string
        }
        Returns: {
          categories: string[]
          email: string
          full_name: string
          kind: string
          photo_url: string
          status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_user_search: {
        Args: {
          _club: string
          _limit: number
          _offset: number
          _role: string
          _search: string
          _status: string
        }
        Returns: {
          created_at: string
          email: string
          full_name: string
          memberships: Json
          photo_url: string
          roles: string[]
          total_count: number
          user_id: string
        }[]
      }
      can_create_matches: { Args: { _user_id: string }; Returns: boolean }
      can_create_player: { Args: { _user_id: string }; Returns: boolean }
      can_create_team: { Args: { _user_id: string }; Returns: boolean }
      can_manage_assigned_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_teams: { Args: { _user_id: string }; Returns: boolean }
      get_my_app_role: { Args: never; Returns: string }
      get_my_memberships: {
        Args: never
        Returns: {
          club_name: string
          member_id: string
          number: number
          position: string
          status: string
          team_category: string
          team_gender: string
          team_id: string
          team_logo_url: string
          team_name: string
        }[]
      }
      get_player_registration_team:
        | {
            Args: { _code: string }
            Returns: {
              club_name: string
              team_color: string
              team_id: string
              team_logo_url: string
              team_name: string
              team_short_name: string
            }[]
          }
        | {
            Args: { _token: string }
            Returns: {
              club_name: string
              team_color: string
              team_id: string
              team_logo_url: string
              team_name: string
              team_short_name: string
            }[]
          }
      get_team_invitation: {
        Args: { _token: string }
        Returns: {
          already_member: boolean
          has_player: boolean
          team_category: string
          team_color: string
          team_gender: string
          team_logo_url: string
          team_name: string
          valid: boolean
        }[]
      }
      get_team_invitation_v2: {
        Args: { _token: string }
        Returns: {
          club_name: string
          first_name: string
          has_profile: boolean
          invite_state: string
          last_name: string
          member_status: string
          photo_url: string
          team_category: string
          team_gender: string
          team_id: string
          team_logo_url: string
          team_name: string
        }[]
      }
      get_user_club: { Args: { _user_id: string }; Returns: string }
      has_league_access: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_team_as_player: {
        Args: {
          _birth_date: string
          _name: string
          _number: number
          _position: string
          _token: string
        }
        Returns: string
      }
      remove_team_membership: {
        Args: { _member_id: string }
        Returns: undefined
      }
      request_team_membership: {
        Args: {
          _first: string
          _last: string
          _number: number
          _photo: string
          _position: string
          _token: string
        }
        Returns: string
      }
      review_team_membership: {
        Args: { _approve: boolean; _member_id: string }
        Returns: string
      }
      review_team_membership_link: {
        Args: { _member_id: string; _player_id: string }
        Returns: string
      }
      submit_player_registration:
        | {
            Args: {
              _birth_date: string
              _code: string
              _name: string
              _number: number
              _position: string
            }
            Returns: string
          }
        | {
            Args: {
              _birth_date: string
              _name: string
              _number: number
              _position: string
              _token: string
            }
            Returns: string
          }
      unlink_player_account: {
        Args: { _player_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "entrenador"
        | "planillero"
        | "analyst"
        | "player"
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
      app_role: [
        "admin",
        "user",
        "entrenador",
        "planillero",
        "analyst",
        "player",
      ],
    },
  },
} as const
