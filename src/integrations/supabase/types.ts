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
      admin_user_passwords: {
        Row: {
          password: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          password: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          password?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      leagues: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          season: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          season?: string | null
          updated_at?: string
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
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          number: number
          photo_url: string | null
          position: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          number: number
          photo_url?: string | null
          position?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          number?: number
          photo_url?: string | null
          position?: string | null
          team_id?: string
          updated_at?: string
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
      teams: {
        Row: {
          category: string | null
          color: string
          created_at: string
          created_by: string | null
          gender: string | null
          id: string
          league_id: string | null
          logo_url: string | null
          name: string
          short_name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          name: string
          short_name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          name?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
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
      can_create_matches: { Args: { _user_id: string }; Returns: boolean }
      can_manage_teams: { Args: { _user_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role: "admin" | "user" | "entrenador" | "planillero"
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
      app_role: ["admin", "user", "entrenador", "planillero"],
    },
  },
} as const
