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
      bookings: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string
          currency: string
          game_id: string
          id: string
          player_id: string
          spots: number
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string
          currency: string
          game_id: string
          id?: string
          player_id: string
          spots?: number
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          game_id?: string
          id?: string
          player_id?: string
          spots?: number
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          cancel_reason: string | null
          cancellation_cutoff_hours: number
          cancelled_at: string | null
          city: string
          confirmation_deadline: string
          country: string
          created_at: string
          currency: string
          date: string
          end_time: string
          ends_at: string
          id: string
          maximum_players: number
          minimum_players: number
          organizer_fee_percentage: number
          price_per_player: number
          refund_percentage: number
          refund_percentage_after_cutoff: number
          refund_percentage_on_game_cancelled: number
          sport: string
          start_time: string
          starts_at: string
          status: Database["public"]["Enums"]["game_status"]
          time_zone: string
          title: string
          updated_at: string
          venue: string
          venue_address: string
          venue_maps_url: string
          what_to_bring: string[]
        }
        Insert: {
          cancel_reason?: string | null
          cancellation_cutoff_hours?: number
          cancelled_at?: string | null
          city: string
          confirmation_deadline: string
          country: string
          created_at?: string
          currency: string
          date: string
          end_time: string
          ends_at: string
          id: string
          maximum_players: number
          minimum_players: number
          organizer_fee_percentage?: number
          price_per_player: number
          refund_percentage?: number
          refund_percentage_after_cutoff?: number
          refund_percentage_on_game_cancelled?: number
          sport: string
          start_time: string
          starts_at: string
          status?: Database["public"]["Enums"]["game_status"]
          time_zone?: string
          title: string
          updated_at?: string
          venue: string
          venue_address?: string
          venue_maps_url?: string
          what_to_bring?: string[]
        }
        Update: {
          cancel_reason?: string | null
          cancellation_cutoff_hours?: number
          cancelled_at?: string | null
          city?: string
          confirmation_deadline?: string
          country?: string
          created_at?: string
          currency?: string
          date?: string
          end_time?: string
          ends_at?: string
          id?: string
          maximum_players?: number
          minimum_players?: number
          organizer_fee_percentage?: number
          price_per_player?: number
          refund_percentage?: number
          refund_percentage_after_cutoff?: number
          refund_percentage_on_game_cancelled?: number
          sport?: string
          start_time?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["game_status"]
          time_zone?: string
          title?: string
          updated_at?: string
          venue?: string
          venue_address?: string
          venue_maps_url?: string
          what_to_bring?: string[]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          external_reference: string | null
          id: string
          provider: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency: string
          external_reference?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          payment_id: string
          reason: string
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "cancelled" | "refunded"
      game_status:
        | "pending"
        | "confirmed"
        | "sold_out"
        | "cancelled"
        | "completed"
      payment_status:
        | "pending"
        | "successful"
        | "failed"
        | "refund_pending"
        | "refunded"
      refund_status: "pending" | "completed" | "failed"
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
      booking_status: ["pending", "confirmed", "cancelled", "refunded"],
      game_status: [
        "pending",
        "confirmed",
        "sold_out",
        "cancelled",
        "completed",
      ],
      payment_status: [
        "pending",
        "successful",
        "failed",
        "refund_pending",
        "refunded",
      ],
      refund_status: ["pending", "completed", "failed"],
    },
  },
} as const
