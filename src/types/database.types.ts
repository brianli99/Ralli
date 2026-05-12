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
          sport_preference_order: string[]
          onboarding_completed: boolean
          level: number
          xp: number
          streak_days: number
          last_checkin_date: string | null
          skill_levels: Record<string, string> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_sports?: string[]
          sport_preference_order?: string[]
          onboarding_completed?: boolean
          level?: number
          xp?: number
          streak_days?: number
          last_checkin_date?: string | null
          skill_levels?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_sports?: string[]
          sport_preference_order?: string[]
          onboarding_completed?: boolean
          level?: number
          xp?: number
          streak_days?: number
          last_checkin_date?: string | null
          skill_levels?: Record<string, string> | null
          created_at?: string
          updated_at?: string
        }
      }
      check_ins: {
        Row: {
          id: string
          user_id: string
          google_place_id: string
          latitude: number
          longitude: number
          sport: string
          created_at: string
          checked_out_at?: string | null
          last_heartbeat_at?: string | null
          place_latitude?: number | null
          place_longitude?: number | null
        }
        Insert: {
          id?: string
          user_id: string
          google_place_id: string
          latitude: number
          longitude: number
          sport: string
          created_at?: string
          checked_out_at?: string | null
          last_heartbeat_at?: string | null
          place_latitude?: number | null
          place_longitude?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          google_place_id?: string
          latitude?: number
          longitude?: number
          sport?: string
          created_at?: string
          checked_out_at?: string | null
          last_heartbeat_at?: string | null
          place_latitude?: number | null
          place_longitude?: number | null
        }
      }
      sessions: {
        Row: {
          id: string
          creator_id: string
          google_place_id: string
          sport: string
          title: string
          description: string | null
          scheduled_for: string
          max_players: number
          current_players: number
          skill_level: string | null
          location_name: string | null
          latitude: number | null
          longitude: number | null
          host_name: string | null
          status: 'upcoming' | 'active' | 'completed' | 'cancelled'
          recurrence_rule: string | null
          parent_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          google_place_id: string
          sport: string
          title: string
          description?: string | null
          scheduled_for: string
          max_players: number
          current_players?: number
          skill_level?: string | null
          location_name?: string | null
          latitude?: number | null
          longitude?: number | null
          host_name?: string | null
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled'
          recurrence_rule?: string | null
          parent_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          google_place_id?: string
          sport?: string
          title?: string
          description?: string | null
          scheduled_for?: string
          max_players?: number
          current_players?: number
          skill_level?: string | null
          location_name?: string | null
          latitude?: number | null
          longitude?: number | null
          host_name?: string | null
          status?: 'upcoming' | 'active' | 'completed' | 'cancelled'
          recurrence_rule?: string | null
          parent_session_id?: string | null
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
      squads: {
        Row: {
          id: string
          name: string
          sport_code: string
          description: string | null
          avatar_url: string | null
          banner_url: string | null
          theme_color: string
          is_private: boolean
          max_members: number | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sport_code: string
          description?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          theme_color?: string
          is_private?: boolean
          max_members?: number | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sport_code?: string
          description?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          theme_color?: string
          is_private?: boolean
          max_members?: number | null
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      squad_members: {
        Row: {
          id?: string
          squad_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          position: string | null
          jersey_number: number | null
          joined_at: string
          last_read_at: string
        }
        Insert: {
          id?: string
          squad_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          position?: string | null
          jersey_number?: number | null
          joined_at?: string
          last_read_at?: string
        }
        Update: {
          id?: string
          squad_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          position?: string | null
          jersey_number?: number | null
          joined_at?: string
          last_read_at?: string
        }
      }
      squad_messages: {
        Row: {
          id: string
          squad_id: string
          sender_id: string | null
          message_type: 'text' | 'image' | 'match_invite' | 'system'
          content: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          squad_id: string
          sender_id?: string | null
          message_type?: 'text' | 'image' | 'match_invite' | 'system'
          content: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          squad_id?: string
          sender_id?: string | null
          message_type?: 'text' | 'image' | 'match_invite' | 'system'
          content?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      friendships: {
        Row: {
          user_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          friend_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          friend_id?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
      }
      direct_threads: {
        Row: {
          id: string
          user_a: string
          user_b: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_a: string
          user_b: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_a?: string
          user_b?: string
          created_at?: string
          updated_at?: string
        }
      }
      direct_messages: {
        Row: {
          id: string
          thread_id: string
          sender_id: string | null
          message_type: 'text' | 'image' | 'match_invite' | 'system'
          content: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          sender_id?: string | null
          message_type?: 'text' | 'image' | 'match_invite' | 'system'
          content: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          sender_id?: string | null
          message_type?: 'text' | 'image' | 'match_invite' | 'system'
          content?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      facility_capacity: {
        Row: {
          id: string
          google_place_id: string
          sport: string
          current_players: number
          max_capacity: number
          last_updated: string
          reported_by: string | null
        }
        Insert: {
          id?: string
          google_place_id: string
          sport: string
          current_players?: number
          max_capacity?: number
          last_updated?: string
          reported_by?: string | null
        }
        Update: {
          id?: string
          google_place_id?: string
          sport?: string
          current_players?: number
          max_capacity?: number
          last_updated?: string
          reported_by?: string | null
        }
      }
      feed_activities: {
        Row: {
          id: string
          user_id: string
          activity_type: 'game_completed' | 'squad_joined' | 'match_won' | 'achievement_unlocked' | 'check_in'
          activity_data: Json
          related_squad_id: string | null
          related_match_id: string | null
          related_facility_id: string | null
          is_public: boolean
          likes_count: number
          comments_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: 'game_completed' | 'squad_joined' | 'match_won' | 'achievement_unlocked' | 'check_in'
          activity_data?: Json
          related_squad_id?: string | null
          related_match_id?: string | null
          related_facility_id?: string | null
          is_public?: boolean
          likes_count?: number
          comments_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: 'game_completed' | 'squad_joined' | 'match_won' | 'achievement_unlocked' | 'check_in'
          activity_data?: Json
          related_squad_id?: string | null
          related_match_id?: string | null
          related_facility_id?: string | null
          is_public?: boolean
          likes_count?: number
          comments_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      activity_likes: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          user_id?: string
          created_at?: string
        }
      }
      activity_comments: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          title: string
          sport_code: string
          match_type: 'friendly' | 'tournament' | 'league' | 'practice'
          facility_id: string | null
          facility_name: string | null
          custom_location: string | null
          latitude: number | null
          longitude: number | null
          scheduled_at: string
          duration_minutes: number
          sport_settings: Json
          description: string | null
          max_participants: number | null
          is_private: boolean
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          result: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          sport_code: string
          match_type?: 'friendly' | 'tournament' | 'league' | 'practice'
          facility_id?: string | null
          facility_name?: string | null
          custom_location?: string | null
          latitude?: number | null
          longitude?: number | null
          scheduled_at: string
          duration_minutes?: number
          sport_settings?: Json
          description?: string | null
          max_participants?: number | null
          is_private?: boolean
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          result?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          sport_code?: string
          match_type?: 'friendly' | 'tournament' | 'league' | 'practice'
          facility_id?: string | null
          facility_name?: string | null
          custom_location?: string | null
          latitude?: number | null
          longitude?: number | null
          scheduled_at?: string
          duration_minutes?: number
          sport_settings?: Json
          description?: string | null
          max_participants?: number | null
          is_private?: boolean
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          result?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_qr_codes: {
        Row: {
          user_id: string
          qr_code: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          qr_code: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          qr_code?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      session_waitlist: {
        Row: {
          id: string
          session_id: string
          user_id: string
          position: number
          joined_at: string
          promoted_at: string | null
          status: 'waiting' | 'promoted' | 'declined' | 'expired'
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          position: number
          joined_at?: string
          promoted_at?: string | null
          status?: 'waiting' | 'promoted' | 'declined' | 'expired'
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          position?: number
          joined_at?: string
          promoted_at?: string | null
          status?: 'waiting' | 'promoted' | 'declined' | 'expired'
        }
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          google_place_id: string
          facility_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          google_place_id: string
          facility_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          google_place_id?: string
          facility_name?: string | null
          created_at?: string
        }
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          session_reminders: boolean
          friend_requests: boolean
          squad_invites: boolean
          chat_messages: boolean
          check_in_nearby: boolean
          marketing: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_reminders?: boolean
          friend_requests?: boolean
          squad_invites?: boolean
          chat_messages?: boolean
          check_in_nearby?: boolean
          marketing?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_reminders?: boolean
          friend_requests?: boolean
          squad_invites?: boolean
          chat_messages?: boolean
          check_in_nearby?: boolean
          marketing?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      app_notifications: {
        Row: {
          id: string
          user_id: string
          type: 'session_cancelled' | 'session_reminder' | 'session_updated' | 'waitlist_promoted' | 'friend_request' | 'friend_accepted' | 'squad_invite' | 'squad_joined' | 'new_message' | 'generic'
          title: string
          body: string | null
          data: Json
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'session_cancelled' | 'session_reminder' | 'session_updated' | 'waitlist_promoted' | 'friend_request' | 'friend_accepted' | 'squad_invite' | 'squad_joined' | 'new_message' | 'generic'
          title: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'session_cancelled' | 'session_reminder' | 'session_updated' | 'waitlist_promoted' | 'friend_request' | 'friend_accepted' | 'squad_invite' | 'squad_joined' | 'new_message' | 'generic'
          title?: string
          body?: string | null
          data?: Json
          read?: boolean
          created_at?: string
        }
      }
      court_messages: {
        Row: {
          id: string
          google_place_id: string
          user_id: string
          content: string
          message_type: 'text' | 'image' | 'session_link' | 'crew_announcement' | 'challenge'
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          google_place_id: string
          user_id: string
          content: string
          message_type?: 'text' | 'image' | 'session_link' | 'crew_announcement' | 'challenge'
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          google_place_id?: string
          user_id?: string
          content?: string
          message_type?: 'text' | 'image' | 'session_link' | 'crew_announcement' | 'challenge'
          metadata?: Json
          created_at?: string
        }
      }
      crews: {
        Row: {
          id: string
          name: string
          google_place_id: string
          sport: string
          description: string | null
          avatar_url: string | null
          captain_id: string
          wins: number
          losses: number
          draws: number
          is_open: boolean
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          google_place_id: string
          sport: string
          description?: string | null
          avatar_url?: string | null
          captain_id: string
          wins?: number
          losses?: number
          draws?: number
          is_open?: boolean
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          google_place_id?: string
          sport?: string
          description?: string | null
          avatar_url?: string | null
          captain_id?: string
          wins?: number
          losses?: number
          draws?: number
          is_open?: boolean
          max_members?: number
          created_at?: string
          updated_at?: string
        }
      }
      crew_members: {
        Row: {
          crew_id: string
          user_id: string
          role: 'captain' | 'co-captain' | 'member'
          joined_at: string
        }
        Insert: {
          crew_id: string
          user_id: string
          role?: 'captain' | 'co-captain' | 'member'
          joined_at?: string
        }
        Update: {
          crew_id?: string
          user_id?: string
          role?: 'captain' | 'co-captain' | 'member'
          joined_at?: string
        }
      }
      crew_challenges: {
        Row: {
          id: string
          challenger_crew_id: string
          challenged_crew_id: string
          google_place_id: string
          sport: string
          proposed_time: string
          message: string | null
          status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          session_id: string | null
          winner_crew_id: string | null
          challenger_score: number | null
          challenged_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          challenger_crew_id: string
          challenged_crew_id: string
          google_place_id: string
          sport: string
          proposed_time: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          session_id?: string | null
          winner_crew_id?: string | null
          challenger_score?: number | null
          challenged_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          challenger_crew_id?: string
          challenged_crew_id?: string
          google_place_id?: string
          sport?: string
          proposed_time?: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          session_id?: string | null
          winner_crew_id?: string | null
          challenger_score?: number | null
          challenged_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_in_at_court: {
        Args: {
          p_google_place_id: string
          p_sport: string
          p_user_lat: number
          p_user_lng: number
          p_place_lat: number
          p_place_lng: number
        }
        Returns: Database['public']['Tables']['check_ins']['Row']
      }
      check_out_court: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      promote_waitlist: {
        Args: {
          p_session_id: string
        }
        Returns: string | null
      }
      rsvp_to_session: {
        Args: {
          p_session_id: string
          p_status: 'in' | 'out' | 'maybe'
        }
        Returns: number
      }
      increment_crew_wins: {
        Args: {
          crew_id_param: string
        }
        Returns: undefined
      }
      increment_crew_losses: {
        Args: {
          crew_id_param: string
        }
        Returns: undefined
      }
      can_manage_squad_members: {
        Args: {
          check_squad_id: string
          check_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
