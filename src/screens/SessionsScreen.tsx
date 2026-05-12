import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { SessionConfidenceService, SessionConfidence } from '../services/sessionConfidenceService';
import { PlacesApiService } from '../services/placesApi';
import { Session, SessionParticipant } from '../types';
import { SPORTS_CONFIG } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle, getSportGradient } from '../design/tokens';
import { EmptyState, ListSkeleton } from '../components/ui';

type SessionsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface SessionWithDetails extends Session {
  participants: SessionParticipant[];
  user_participation?: SessionParticipant;
}

type Sport = keyof typeof SPORTS_CONFIG;

export default function SessionsScreen() {
  const navigation = useNavigation<SessionsScreenNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  /** google_place_id -> display name for rows missing DB `location_name` (older sessions). */
  const [resolvedPlaceNames, setResolvedPlaceNames] = useState<Record<string, string>>({});
  const [confidenceScores, setConfidenceScores] = useState<Map<string, SessionConfidence>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'nearby' | 'past'>('upcoming');
  
  // Search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<Sport | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Location for nearby filtering
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const isMountedRef = React.useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!PlacesApiService.isConfigured()) return;
    const needResolve = sessions.filter(
      s => s.google_place_id && !s.location_name?.trim() && !resolvedPlaceNames[s.google_place_id]
    );
    const placeIds = [...new Set(needResolve.map(s => s.google_place_id as string))].slice(0, 8);
    if (placeIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (let i = 0; i < placeIds.length; i += 3) {
        const batch = placeIds.slice(i, i + 3);
        await Promise.all(batch.map(async (placeId) => {
          const details = await PlacesApiService.getPlaceDetails(placeId);
          const name = details?.displayName?.text?.trim();
          updates[placeId] = name || 'Court';
        }));
      }
      if (!cancelled && isMountedRef.current && Object.keys(updates).length > 0) {
        setResolvedPlaceNames(prev => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessions, resolvedPlaceNames]);

  // Get user location on mount
  useEffect(() => {
    getUserLocation();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchSessions();
    }, [activeTab, user])
  );

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Could not get location');
    }
  };

  // Calculate distance between two coordinates in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  const fetchSessions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (!refreshing) setLoading(true);

      let data: any[] | null = null;
      let error: any = null;

      if (activeTab === 'past') {
        // Past tab: ONLY show sessions the user hosted or joined
        // Get IDs of sessions where the user is a participant
        const { data: myParticipations, error: partErr } = await supabase
          .from('session_participants')
          .select('session_id')
          .eq('user_id', user.id);

        if (partErr) throw new Error(partErr.message);

        const participantSessionIds = (myParticipations || []).map((p: any) => p.session_id);
        const nowIso = new Date().toISOString();

        // Build the OR filter: (created by me) OR (I was a participant)
        const orFilter = participantSessionIds.length > 0
          ? `creator_id.eq.${user.id},id.in.(${participantSessionIds.join(',')})`
          : `creator_id.eq.${user.id}`;

        const result = await supabase
          .from('sessions')
          .select(`
            *,
            participants:session_participants(*)
          `)
          .or(orFilter)
          .or(`status.eq.completed,status.eq.cancelled,scheduled_for.lt.${nowIso}`)
          .order('scheduled_for', { ascending: false });

        data = result.data;
        error = result.error;
      } else {
        // Upcoming / Nearby: discovery - show all upcoming public sessions
        const result = await supabase
          .from('sessions')
          .select(`
            *,
            participants:session_participants(*)
          `)
          .eq('status', 'upcoming')
          .gte('scheduled_for', new Date().toISOString())
          .order('scheduled_for', { ascending: true });

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Sessions fetch error:', error);
        throw new Error(error.message || 'Failed to load sessions');
      }

      const sessionsWithParticipation = (data || []).map(session => ({
        ...session,
        user_participation: session.participants.find((p: SessionParticipant) => p.user_id === user.id)
      }));

      setSessions(sessionsWithParticipation);

      if (activeTab !== 'past') {
        SessionConfidenceService.getConfidenceBatch(sessionsWithParticipation)
          .then((scores) => { if (isMountedRef.current) setConfidenceScores(scores); })
          .catch(err => console.error('Confidence score error:', err));
      }
    } catch (error: any) {
      console.error('Sessions error:', error);
      setError(error.message || 'Failed to load sessions');
      
      if (!refreshing) {
        Alert.alert(
          'Error',
          error.message || 'Failed to load sessions',
          [
            { text: 'Retry', onPress: fetchSessions },
            { text: 'OK' }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const handleSessionPress = (sessionId: string) => {
    Haptics.selectionAsync();
    navigation.navigate('SessionDetail', { sessionId });
  };

  const handleCreateSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Create a Session',
      'To create a session, first select a facility on the map, then tap "Schedule" to set up your game.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Map', 
          onPress: () => navigation.dispatch(
            CommonActions.navigate({ name: 'MainTabs', params: { screen: 'Map' } })
          )
        }
      ]
    );
  };

  const formatDate = (dateString: string, isPast: boolean = false) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getStatusConfig = (status: string, sessionStatus?: string) => {
    // For past sessions, show session status instead of participation status
    if (sessionStatus === 'completed') {
      return { bg: '#10B981', text: 'white', label: 'Completed' };
    }
    if (sessionStatus === 'cancelled') {
      return { bg: '#6B7280', text: 'white', label: 'Cancelled' };
    }
    
    switch (status) {
      case 'host':
        return { bg: '#FF6B35', text: 'white', label: 'Hosting' };
      case 'in':
        return { bg: '#22C55E', text: 'white', label: 'Going' };
      case 'maybe':
        return { bg: '#F59E0B', text: '#111827', label: 'Maybe' };
      case 'out':
        return { bg: '#EF4444', text: 'white', label: 'Not Going' };
      default:
        return { bg: '#E5E7EB', text: '#374151', label: 'Join' };
    }
  };

  // Filter sessions based on search query, selected sport, and location
  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter((session: any) => {
      // Filter by sport
      if (selectedSport !== 'all' && session.sport !== selectedSport) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = session.title?.toLowerCase().includes(query);
        const resolvedLoc =
          session.google_place_id && resolvedPlaceNames[session.google_place_id]
            ? resolvedPlaceNames[session.google_place_id].toLowerCase()
            : '';
        const matchesLocation =
          session.location_name?.toLowerCase().includes(query) ||
          resolvedLoc.includes(query);
        const matchesHost = session.host_name?.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesLocation && !matchesHost) {
          return false;
        }
      }
      
      return true;
    });

    // Add distance to each session if we have user location
    if (userLocation) {
      filtered = filtered.map((session: any) => {
        if (session.latitude && session.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            session.latitude,
            session.longitude
          );
          return { ...session, distance };
        }
        return { ...session, distance: null };
      });
    }

    // Sort based on active tab
    if (activeTab === 'nearby' && userLocation) {
      // Sort by distance (closest first), sessions without location go to end
      filtered.sort((a: any, b: any) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
      
      // Filter to only show sessions within 50km for "nearby"
      filtered = filtered.filter((session: any) => 
        session.distance === null || session.distance <= 50
      );
    } else if (activeTab === 'past') {
      // Sort by scheduled time (most recent first for past sessions)
      filtered.sort((a: any, b: any) => 
        new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
      );
    } else {
      // Sort by scheduled time (soonest first)
      filtered.sort((a: any, b: any) => 
        new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
      );
    }

    return filtered;
  }, [sessions, searchQuery, selectedSport, userLocation, activeTab, resolvedPlaceNames]);

  // Use filtered sessions for display
  const displaySessions = filteredSessions;

  const sessionLocationLabel = (session: SessionWithDetails) => {
    const fromDb = session.location_name?.trim();
    if (fromDb) return fromDb;
    const placeId = session.google_place_id;
    if (placeId && resolvedPlaceNames[placeId]) return resolvedPlaceNames[placeId];
    if (placeId && PlacesApiService.isConfigured()) return 'Loading venue…';
    return placeId ? 'Court' : 'Venue TBD';
  };

  const renderSessionCard = (session: any, index: number) => {
    const sportConfig = SPORTS_CONFIG[session.sport as keyof typeof SPORTS_CONFIG];
    const isPastSession = activeTab === 'past' || new Date(session.scheduled_for) < new Date();
    const statusConfig = isPastSession 
      ? getStatusConfig(session.user_participation?.status || 'not-joined', session.status)
      : getStatusConfig(session.user_participation?.status || 'not-joined');
    const isCreator = session.creator_id === user?.id;
    const sportGradient = getSportGradient(session.sport);
    const confidenceScore = !isPastSession ? confidenceScores.get(session.id) : undefined;

    return (
      <TouchableOpacity
        key={session.id}
        style={[styles.sessionCard, isPastSession && styles.pastSessionCard]}
        onPress={() => handleSessionPress(session.id)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionCardInner}>
          {/* Sport Icon */}
          <View style={[styles.sportIconContainer, isPastSession && styles.pastSportIcon]}>
            <LinearGradient
              colors={isPastSession ? ['#9CA3AF', '#6B7280'] as [string, string] : sportGradient}
              style={styles.sportIconGradient}
            >
              <Text style={styles.sportIconText}>
                {sportConfig?.icon || '🏀'}
              </Text>
            </LinearGradient>
          </View>

          {/* Session Info */}
          <View style={styles.sessionInfo}>
            {/* Title Row */}
            <View style={styles.titleRow}>
              <Text style={[styles.sessionTitle, isPastSession && styles.pastSessionTitle]} numberOfLines={1}>
                {session.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusText, { color: statusConfig.text }]}>
                  {isPastSession 
                    ? statusConfig.label 
                    : (isCreator ? 'Hosting' : statusConfig.label)}
                </Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={isPastSession ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.infoText, isPastSession && styles.pastInfoText]} numberOfLines={1}>
                {sessionLocationLabel(session)}
              </Text>
              {activeTab === 'nearby' && session.distance !== undefined && session.distance !== null && (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{formatDistance(session.distance)}</Text>
                </View>
              )}
            </View>

            {/* Time */}
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={14} color={isPastSession ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.infoText, isPastSession && styles.pastInfoText]}>
                {formatDate(session.scheduled_for, isPastSession)}
              </Text>
            </View>

            {/* Players */}
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={14} color={isPastSession ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.infoText, isPastSession && styles.pastInfoText]}>
                {session.current_players}/{session.max_players} players
              </Text>
              {!isPastSession && session.current_players >= session.max_players && (
                <View style={styles.fullBadge}>
                  <Text style={styles.fullBadgeText}>FULL</Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View style={styles.sessionFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.skillBadge, isPastSession && styles.pastSkillBadge]}>
                  <Text style={[styles.skillText, isPastSession && styles.pastSkillText]}>
                    {session.skill_level || 'All Levels'}
                  </Text>
                </View>
                {confidenceScore && (
                  <View style={styles.confidenceBadge}>
                    <View style={[styles.confidenceDot, { backgroundColor: confidenceScore.color }]} />
                    <Text style={[styles.confidenceText, { color: confidenceScore.color }]}>
                      {confidenceScore.label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.hostInfo}>
                <View style={[styles.hostAvatar, isPastSession && styles.pastHostAvatar]}>
                  <Text style={styles.hostInitials}>
                    {(session.host_name || 'User').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.hostText, isPastSession && styles.pastHostText]}>
                  {session.host_name || 'Host'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Gradient Header */}
      <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroTitle}>Sessions</Text>
          <TouchableOpacity 
            style={styles.heroActionButton}
            onPress={handleCreateSession}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroSubtitle}>Find and join games near you</Text>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sessions..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowFilters(!showFilters);
          }}
        >
          <Ionicons 
            name="options-outline" 
            size={20} 
            color={showFilters ? 'white' : theme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Sport Filters */}
      {showFilters && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.sportFiltersContainer}
          contentContainerStyle={styles.sportFiltersContent}
        >
          <TouchableOpacity
            style={[
              styles.sportFilterChip,
              selectedSport === 'all' && styles.sportFilterChipActive
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedSport('all');
            }}
          >
            <Text style={[
              styles.sportFilterText,
              selectedSport === 'all' && styles.sportFilterTextActive
            ]}>All Sports</Text>
          </TouchableOpacity>
          {Object.entries(SPORTS_CONFIG).map(([sport, config]) => (
            <TouchableOpacity
              key={sport}
              style={[
                styles.sportFilterChip,
                selectedSport === sport && { backgroundColor: config.color }
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedSport(sport as Sport);
              }}
            >
              <Text style={styles.sportFilterIcon}>{config.icon}</Text>
              <Text style={[
                styles.sportFilterText,
                selectedSport === sport && styles.sportFilterTextActive
              ]}>{config.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('upcoming');
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'upcoming' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'nearby' && styles.activeTab]}
          onPress={() => {
            Haptics.selectionAsync();
            if (!userLocation && !locationError) {
              getUserLocation();
            }
            setActiveTab('nearby');
          }}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={activeTab === 'nearby' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'nearby' && styles.activeTabText]}>
            Nearby
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('past');
          }}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'past' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <ListSkeleton count={4} type="session" />
      ) : error && !refreshing ? (
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Unable to Load Sessions"
            subtitle={error}
            actionText="Try Again"
            onAction={fetchSessions}
            variant="error"
          />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {activeTab === 'nearby' && !userLocation && (
            <View style={styles.locationWarning}>
              <Ionicons name="location-outline" size={24} color={theme.colors.warning} />
              <Text style={styles.locationWarningText}>
                {locationError || 'Getting your location...'}
              </Text>
              {locationError && (
                <TouchableOpacity 
                  style={styles.retryLocationButton}
                  onPress={getUserLocation}
                >
                  <Text style={styles.retryLocationText}>Enable Location</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {displaySessions.length === 0 ? (
            <EmptyState
              emoji={activeTab === 'past' ? "📅" : activeTab === 'nearby' ? "📍" : "🎯"}
              title={activeTab === 'past' ? "No past sessions" : activeTab === 'nearby' ? "No sessions nearby" : "No upcoming sessions yet"}
              subtitle={activeTab === 'past' 
                ? "Sessions you've hosted or joined will appear here after they happen."
                : activeTab === 'nearby' 
                  ? "There aren't any sessions near you yet. Start one and others will join!"
                  : "Be the first to host a pickup game! Head to the map, find a court, and create a session."}
              variant="sessions"
            />
          ) : (
            displaySessions.map((session, index) => renderSessionCard(session, index))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero Header
  hero: {
    paddingTop: 70,
    paddingBottom: DesignTokens.space['2xl'],
    paddingHorizontal: DesignTokens.space.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.space.md,
  },
  heroTitle: {
    ...createTextStyle('4xl', 'extrabold'),
    color: 'white',
  },
  heroActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubtitle: {
    ...createTextStyle('base', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
    backgroundColor: 'white',
    gap: DesignTokens.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: DesignTokens.radius.lg,
    paddingHorizontal: DesignTokens.space.md,
  },
  searchIcon: {
    marginRight: DesignTokens.space.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: DesignTokens.space.sm,
    ...createTextStyle('base', 'regular'),
    color: '#111827',
  },
  clearButton: {
    padding: DesignTokens.space.xs,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: DesignTokens.radius.lg,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  
  // Sport Filters
  sportFiltersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sportFiltersContent: {
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
    gap: DesignTokens.space.sm,
  },
  sportFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: DesignTokens.radius.xl,
    gap: DesignTokens.space.xs,
    marginRight: DesignTokens.space.sm,
  },
  sportFilterChipActive: {
    backgroundColor: '#3B82F6',
  },
  sportFilterIcon: {
    fontSize: 16,
  },
  sportFilterText: {
    ...createTextStyle('sm', 'medium'),
    color: '#374151',
  },
  sportFilterTextActive: {
    color: 'white',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: DesignTokens.space.xl,
    paddingVertical: DesignTokens.space.md,
    gap: DesignTokens.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.xl,
    gap: DesignTokens.space.xs,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    ...createTextStyle('sm', 'semibold'),
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: DesignTokens.space.lg,
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.space.xl,
  },
  loadingText: {
    ...createTextStyle('base', 'medium'),
    color: '#6B7280',
    marginTop: DesignTokens.space.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  // Session Card
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: DesignTokens.radius.lg,
    marginBottom: DesignTokens.space.md,
    ...DesignTokens.shadow.md,
    overflow: 'hidden',
  },
  sessionCardInner: {
    flexDirection: 'row',
    padding: DesignTokens.space.lg,
    gap: DesignTokens.space.md,
  },
  sportIconContainer: {
    width: 56,
    height: 56,
    borderRadius: DesignTokens.radius.md,
    overflow: 'hidden',
  },
  sportIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportIconText: {
    fontSize: 28,
  },
  sessionInfo: {
    flex: 1,
    gap: DesignTokens.space.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DesignTokens.space.xs,
  },
  sessionTitle: {
    ...createTextStyle('base', 'bold'),
    color: '#111827',
    flex: 1,
    marginRight: DesignTokens.space.sm,
  },
  statusBadge: {
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.lg,
  },
  statusText: {
    ...createTextStyle('xs', 'semibold'),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
  },
  infoText: {
    ...createTextStyle('sm', 'regular'),
    color: '#6B7280',
    flex: 1,
  },
  fullBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: 2,
    borderRadius: DesignTokens.radius.sm,
  },
  fullBadgeText: {
    ...createTextStyle('xs', 'bold'),
    color: '#DC2626',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: DesignTokens.space.sm,
    paddingTop: DesignTokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  skillBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skillText: {
    ...createTextStyle('xs', 'semibold'),
    color: '#374151',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  hostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitials: {
    ...createTextStyle('xs', 'semibold'),
    color: 'white',
  },
  hostText: {
    ...createTextStyle('xs', 'medium'),
    color: '#6B7280',
  },
  distanceBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: 2,
    borderRadius: DesignTokens.radius.sm,
    marginLeft: DesignTokens.space.xs,
  },
  distanceText: {
    ...createTextStyle('xs', 'semibold'),
    color: '#3B82F6',
  },
  locationWarning: {
    backgroundColor: '#FFFBEB',
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  locationWarningText: {
    ...createTextStyle('sm', 'medium'),
    color: '#92400E',
    textAlign: 'center',
    marginTop: DesignTokens.space.sm,
  },
  retryLocationButton: {
    marginTop: DesignTokens.space.md,
    backgroundColor: '#F59E0B',
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.md,
  },
  retryLocationText: {
    ...createTextStyle('sm', 'semibold'),
    color: 'white',
  },

  // Past session styles
  pastSessionCard: {
    opacity: 0.85,
  },
  pastSportIcon: {
    opacity: 0.8,
  },
  pastSessionTitle: {
    color: '#6B7280',
  },
  pastInfoText: {
    color: '#9CA3AF',
  },
  pastSkillBadge: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
  },
  pastSkillText: {
    color: '#6B7280',
  },
  pastHostAvatar: {
    backgroundColor: '#D1D5DB',
  },
  pastHostText: {
    color: '#9CA3AF',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
