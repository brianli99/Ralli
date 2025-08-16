export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  CourtDetail: { courtId: string };
  CreateSession: { courtId: string; sport?: string };
  SessionDetail: { sessionId: string };
};

export type MainTabParamList = {
  Map: undefined;
  Sessions: undefined;
  Profile: undefined;
};
