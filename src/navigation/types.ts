import type { Sport } from '../types';

export type RootStackParamList = {
  Auth: undefined;
  ResetPassword: undefined;
  SportOnboarding: undefined;
  MainTabs: undefined;
  CourtDetail: { courtId: string; initialSport?: string };
  CreateSession: { courtId: string; sport?: string; facilitySports?: Sport[] };
  SessionDetail: { sessionId: string };
  EditProfile: undefined;
  NotificationSettings: undefined;
  Notifications: undefined;
  UserProfile: { userId: string };
  QRScanner: { type?: 'friend' | 'squad' };
  
  // Squad-related screens
  SquadDetail: { squadId: string };
  CreateSquad: undefined;
  Friends: undefined;
  ChatScreen: { 
    type: 'squad' | 'direct';
    id: string;
    name: string;
    sport?: string;
  };

  // Community screens
  CourtChat: { googlePlaceId: string; facilityName: string };
  CourtCrews: { googlePlaceId: string; facilityName: string };
  CreateCrew: { googlePlaceId: string; facilityName: string };
  CrewDetail: { crewId: string };
};

export type MainTabParamList = {
  Map: undefined;
  Sessions: undefined; // Renamed from Games
  Squad: undefined; // New Squad tab
  Profile: undefined;
};

