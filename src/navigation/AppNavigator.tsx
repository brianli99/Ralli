import React from 'react';
import {
  NavigationContainer,
  LinkingOptions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import AuthScreen from '../screens/AuthScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import SportOnboardingScreen from '../screens/SportOnboardingScreen';
import MapScreen from '../screens/MapScreen';
import SessionsScreen from '../screens/SessionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EnhancedCourtDetailScreen from '../screens/EnhancedCourtDetailScreen';
import CreateSessionScreen from '../screens/CreateSessionScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';
import SquadTabScreen from '../screens/squad/SquadTabScreen';
import CreateSquadScreen from '../screens/squad/CreateSquadScreen';
import ChatScreen from '../screens/squad/ChatScreen';
import SquadDetailScreen from '../screens/squad/SquadDetailScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import CourtChatScreen from '../screens/community/CourtChatScreen';
import CourtCrewsScreen from '../screens/community/CourtCrewsScreen';
import CreateCrewScreen from '../screens/community/CreateCrewScreen';
import CrewDetailScreen from '../screens/community/CrewDetailScreen';

import { RootStackParamList, MainTabParamList } from './types';
import { useTheme } from '../theme/theme';
import { notificationService } from '../services/notificationService';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
let pendingNotificationData: Record<string, any> | undefined;

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ralli://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      UserProfile: 'friend/:userId',
      SquadDetail: 'squad/:squadId',
      SessionDetail: 'session/:sessionId',
      CrewDetail: 'crew/:crewId',
    },
  },
};

function navigateFromNotificationData(data: Record<string, any> | undefined) {
  if (!data) return;
  if (!navigationRef.isReady()) {
    pendingNotificationData = data;
    return;
  }

  const sessionId = data.sessionId || data.session_id;
  const squadId = data.squadId || data.squad_id;
  const crewId = data.crewId || data.crew_id;

  if (typeof sessionId === 'string') {
    navigationRef.navigate('SessionDetail', { sessionId });
  } else if (typeof squadId === 'string') {
    navigationRef.navigate('SquadDetail', { squadId });
  } else if (typeof crewId === 'string') {
    navigationRef.navigate('CrewDetail', { crewId });
  }
}

function MainTabNavigator() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Sessions') {
            iconName = focused ? 'game-controller' : 'game-controller-outline';
          } else if (route.name === 'Squad') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Sessions" component={SessionsScreen} />
      <Tab.Screen name="Squad" component={SquadTabScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    const sub = notificationService.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(response.notification.request.content.data);
    });

    notificationService.getLastNotificationResponse().then((response) => {
      if (response) {
        navigateFromNotificationData(response.notification.request.content.data);
      }
    });

    return () => sub.remove();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  // Determine if user needs onboarding
  const needsOnboarding = user && !user.onboarding_completed;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        if (pendingNotificationData) {
          navigateFromNotificationData(pendingNotificationData);
          pendingNotificationData = undefined;
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          needsOnboarding ? (
            // Show onboarding flow for new users
            <>
              <Stack.Screen name="SportOnboarding" component={SportOnboardingScreen} />
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              <Stack.Screen name="CourtDetail" component={EnhancedCourtDetailScreen} />
              <Stack.Screen name="CreateSession" component={CreateSessionScreen} />
              <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
              <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
              <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
              <Stack.Screen name="Friends" component={FriendsScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="QRScanner" component={QRScannerScreen} />
              <Stack.Screen name="CourtChat" component={CourtChatScreen} />
              <Stack.Screen name="CourtCrews" component={CourtCrewsScreen} />
              <Stack.Screen name="CreateCrew" component={CreateCrewScreen} />
              <Stack.Screen name="CrewDetail" component={CrewDetailScreen} />
            </>
          ) : (
            // Show main app for users who completed onboarding
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="SportOnboarding" component={SportOnboardingScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              <Stack.Screen name="CourtDetail" component={EnhancedCourtDetailScreen} />
              <Stack.Screen name="CreateSession" component={CreateSessionScreen} />
              <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
              <Stack.Screen name="CreateSquad" component={CreateSquadScreen} />
              <Stack.Screen name="SquadDetail" component={SquadDetailScreen} />
              <Stack.Screen name="Friends" component={FriendsScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="QRScanner" component={QRScannerScreen} />
              <Stack.Screen name="CourtChat" component={CourtChatScreen} />
              <Stack.Screen name="CourtCrews" component={CourtCrewsScreen} />
              <Stack.Screen name="CreateCrew" component={CreateCrewScreen} />
              <Stack.Screen name="CrewDetail" component={CrewDetailScreen} />
            </>
          )
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
