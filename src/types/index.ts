import { Database } from './database.types';

export type User = Database['public']['Tables']['users']['Row'];
export type CheckIn = Database['public']['Tables']['check_ins']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type SessionParticipant = Database['public']['Tables']['session_participants']['Row'];

export type Sport = 'basketball' | 'tennis' | 'pickleball' | 'volleyball' | 'soccer' | 'badminton';

export interface Court {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  sports: string[];
  address: string;
  amenities: string[];
  created_at?: string;
  updated_at?: string;
  /** Google primaryType (e.g. park, recreation_center) for merge heuristics */
  primaryType?: string;
  types?: string[];
  /**
   * When this `Court` represents several Google POIs merged into one map pin,
   * all place ids in the group (including `id`, usually the representative first).
   */
  groupPlaceIds?: string[];
}

export type SportConfig = {
  name: string;
  icon: string;
  color: string;
  defaultSessionTitle: string;
  maxPlayers: number;
};

export type Location = {
  latitude: number;
  longitude: number;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type CheckInRequest = {
  google_place_id: string;
  sport: Sport;
  latitude: number;
  longitude: number;
};

export type SessionRequest = {
  google_place_id: string;
  sport: Sport;
  title: string;
  description?: string;
  scheduled_for: string;
  max_players: number;
  location_name?: string;
  latitude?: number;
  longitude?: number;
};

export * from './database.types';
