import { Database } from './database.types';

export type User = Database['public']['Tables']['users']['Row'];
export type Court = Database['public']['Tables']['courts']['Row'];
export type CheckIn = Database['public']['Tables']['check_ins']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type SessionParticipant = Database['public']['Tables']['session_participants']['Row'];

export type Sport = 'basketball' | 'tennis' | 'pickleball' | 'volleyball' | 'running' | 'soccer';

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
  court_id: string;
  sport: Sport;
  latitude: number;
  longitude: number;
};

export type SessionRequest = {
  court_id: string;
  sport: Sport;
  title: string;
  description?: string;
  scheduled_for: string;
  max_players: number;
};

export * from './database.types';
