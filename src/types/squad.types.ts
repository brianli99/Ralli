// ============================================================================
// RALLI SQUAD SYSTEM - TYPESCRIPT TYPES
// ============================================================================

export type SportCode = 'basketball' | 'tennis' | 'pickleball' | 'volleyball' | 'soccer' | 'badminton';
export type SquadRole = 'owner' | 'admin' | 'member';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MatchType = 'friendly' | 'tournament' | 'league' | 'practice';
export type RSVPStatus = 'pending' | 'accepted' | 'declined' | 'maybe';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type MessageType = 'text' | 'image' | 'match_invite' | 'system';

// ============================================================================
// SQUAD TYPES
// ============================================================================

export interface Squad {
  id: string;
  name: string;
  sport_code: SportCode;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  theme_color: string;
  is_private: boolean;
  max_members?: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  member_count?: number;
  user_role?: SquadRole;
  unread_count?: number;
}

export interface SquadMember {
  id: string;
  squad_id: string;
  user_id: string;
  role: SquadRole;
  position?: string; // Sport-specific position
  jersey_number?: number;
  joined_at: string;
  last_read_at: string;
  
  // User data (when joined)
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
}

export interface SquadWithMembers extends Squad {
  members: SquadMember[];
  owner: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

// ============================================================================
// USER PROFILE TYPE (for friends/social features)
// ============================================================================

export interface UserProfile {
  id: string;
  full_name?: string;
  username?: string;
  avatar_url?: string | null;
  email?: string;
  preferred_sports?: string[];
}

// ============================================================================
// FRIENDSHIP TYPES
// ============================================================================

export interface Friendship {
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  
  // Friend data (when joined)
  friend?: UserProfile;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at?: string;
  
  // Sender data (when joined)
  sender: UserProfile;
  
  // Alias used in some views
  from_user?: UserProfile;
  
  // Receiver data (when joined)
  receiver?: UserProfile;
}

export interface FriendWithStatus extends UserProfile {
  status: 'friend' | 'pending_sent' | 'pending_received' | 'blocked';
  friendship_id?: string;
}

// ============================================================================
// MATCH TYPES
// ============================================================================

export interface Match {
  id: string;
  title: string;
  sport_code: SportCode;
  match_type: MatchType;
  
  // Location
  facility_id?: string; // Google Places ID
  facility_name?: string;
  custom_location?: string;
  latitude?: number;
  longitude?: number;
  
  // Timing
  scheduled_at: string;
  duration_minutes: number;
  
  // Sport-specific settings
  sport_settings: Record<string, any>;
  
  // Details
  description?: string;
  max_participants?: number;
  is_private: boolean;
  
  // Status
  status: MatchStatus;
  result?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  participant_count?: number;
  user_rsvp?: RSVPStatus;
  is_participant?: boolean;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  squad_id?: string;
  user_id?: string;
  team_side: number;
  is_host: boolean;
  rsvp_status: RSVPStatus;
  joined_at: string;
  
  // Joined data
  squad?: Squad;
  user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface MatchInvitation {
  id: string;
  match_id: string;
  from_user_id: string;
  to_squad_id?: string;
  to_user_id?: string;
  message?: string;
  status: InvitationStatus;
  created_at: string;
  expires_at?: string;
  
  // Joined data
  match?: Match;
  from_user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
  to_squad?: Squad;
  to_user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface MatchWithDetails extends Match {
  participants: MatchParticipant[];
  creator?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

// ============================================================================
// MESSAGING TYPES
// ============================================================================

export interface SquadMessage {
  id: string;
  squad_id: string;
  sender_id?: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Sender data (when joined)
  sender?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface DirectThread {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
  
  // Other user data
  other_user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
  
  // Latest message and unread count
  latest_message?: DirectMessage;
  unread_count?: number;
}

export interface DirectMessage {
  id: string;
  thread_id: string;
  sender_id?: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Sender data (when joined)
  sender?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface DirectThreadRead {
  thread_id: string;
  user_id: string;
  last_read_at: string;
}

// ============================================================================
// USER QR CODE TYPES
// ============================================================================

export interface UserQRCode {
  user_id: string;
  qr_code: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateSquadRequest {
  name: string;
  sport_code: SportCode;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  theme_color?: string;
  is_private?: boolean;
  max_members?: number;
}

export interface UpdateSquadRequest {
  name?: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  theme_color?: string;
  is_private?: boolean;
  max_members?: number;
}

export interface AddSquadMemberRequest {
  user_id: string;
  role?: SquadRole;
  position?: string;
  jersey_number?: number;
}

export interface CreateMatchRequest {
  title: string;
  sport_code: SportCode;
  match_type?: MatchType;
  facility_id?: string;
  facility_name?: string;
  custom_location?: string;
  latitude?: number;
  longitude?: number;
  scheduled_at: string;
  duration_minutes?: number;
  sport_settings?: Record<string, any>;
  description?: string;
  max_participants?: number;
  is_private?: boolean;
  participants: {
    squad_id?: string;
    user_id?: string;
    team_side?: number;
    is_host?: boolean;
  }[];
}

export interface SendMessageRequest {
  content: string;
  message_type?: MessageType;
  metadata?: Record<string, any>;
}

// ============================================================================
// SPORT-SPECIFIC TEMPLATES
// ============================================================================

export interface SportTemplate {
  sport_code: SportCode;
  name: string;
  icon: string;
  color: string;
  positions: string[];
  default_match_settings: Record<string, any>;
  match_format_options: MatchFormatOption[];
}

export interface MatchFormatOption {
  id: string;
  name: string;
  description: string;
  settings: Record<string, any>;
  max_participants: number;
  team_sides: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  has_more: boolean;
  next_cursor?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SquadMemberWithUser = SquadMember & {
  user: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
};

export type MessageThread = {
  type: 'squad' | 'direct';
  id: string;
  name: string;
  avatar_url?: string;
  unread_count: number;
  latest_message?: {
    content: string;
    sender_name?: string;
    created_at: string;
  };
  sport_code?: SportCode; // For squad threads
  other_user_id?: string; // For direct threads
};
