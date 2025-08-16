export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          preferred_sports: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_sports?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_sports?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      courts: {
        Row: {
          id: string
          name: string
          description: string | null
          latitude: number
          longitude: number
          sports: string[]
          address: string
          amenities: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          latitude: number
          longitude: number
          sports: string[]
          address: string
          amenities?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          latitude?: number
          longitude?: number
          sports?: string[]
          address?: string
          amenities?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      check_ins: {
        Row: {
          id: string
          user_id: string
          court_id: string
          latitude: number
          longitude: number
          sport: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          court_id: string
          latitude: number
          longitude: number
          sport: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          court_id?: string
          latitude?: number
          longitude?: number
          sport?: string
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          creator_id: string
          court_id: string
          sport: string
          title: string
          description: string | null
          scheduled_for: string
          max_players: number
          current_players: number
          status: 'upcoming' | 'active' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          court_id: string
          sport: string
          title: string
          description?: string | null
          scheduled_for: string
          max_players: number
          current_players?: number
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          court_id?: string
          sport?: string
          title?: string
          description?: string | null
          scheduled_for?: string
          max_players?: number
          current_players?: number
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      session_participants: {
        Row: {
          id: string
          session_id: string
          user_id: string
          status: 'in' | 'out' | 'maybe'
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          status: 'in' | 'out' | 'maybe'
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          status?: 'in' | 'out' | 'maybe'
          joined_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
