import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { PlacesApiService } from '../services/placesApi';
import { SocialProofService, HostStats } from '../services/socialProofService';
import { Session, SessionParticipant, User } from '../types';
import { SPORTS_CONFIG } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle } from '../design/tokens';
import SessionCountdown from '../components/SessionCountdown';
import { notificationService } from '../services/notificationService';

type SessionDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SessionDetail'>;
type SessionDetailScreenRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;

interface SessionWithDetails extends Session {
  creator: User;
  participants: (SessionParticipant & { user: User })[];
}

interface LocationInfo {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export default function SessionDetailScreen() {
  const navigation = useNavigation<SessionDetailScreenNavigationProp>();
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const sessionId = route.params?.sessionId;

  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostStats, setHostStats] = useState<HostStats | null>(null);
  const [mutualFriends, setMutualFriends] = useState<{ count: number; names: string[] }>({ count: 0, names: [] });
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);

  const isMountedRef = React.useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          creator:users!sessions_creator_id_fkey(*),
          participants:session_participants(
            *,
            user:users(*)
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Session not found');
      
      setSession(data);

      // Fetch location details from Google Places
      if (data.google_place_id) {
        try {
          const placeDetails = await PlacesApiService.getPlaceDetails(data.google_place_id);
          if (placeDetails) {
            setLocation({
              name: placeDetails.displayName?.text || data.location_name || 'Facility',
              address: placeDetails.formattedAddress || '',
              latitude: placeDetails.location?.latitude,
              longitude: placeDetails.location?.longitude,
            });
          } else if (data.location_name) {
            setLocation({ name: data.location_name, address: '' });
          }
        } catch (e) {
          if (data.location_name) {
            setLocation({ name: data.location_name, address: '' });
          }
        }
      } else if (data.location_name) {
        setLocation({ name: data.location_name, address: '' });
      }

      // Fetch waitlist
      const { data: waitlistData } = await supabase
        .from('session_waitlist')
        .select('*, user:users!session_waitlist_user_id_fkey(id, full_name, avatar_url)')
        .eq('session_id', sessionId)
        .eq('status', 'waiting')
        .order('position', { ascending: true });

      setWaitlist(waitlistData || []);
      setIsOnWaitlist(waitlistData?.some(w => w.user_id === user?.id) || false);

      // Fetch social proof data (guarded against unmount)
      if (data.creator_id) {
        SocialProofService.getHostStats(data.creator_id)
          .then((s) => { if (isMountedRef.current) setHostStats(s); })
          .catch(() => {});
      }
      if (user?.id) {
        SocialProofService.getMutualFriendsInSession(user.id, sessionId)
          .then((m) => { if (isMountedRef.current) setMutualFriends(m); })
          .catch(() => {});
      }

    } catch (error: any) {
      setError(error.message);
      Alert.alert('Error', error.message, [
        { text: 'Retry', onPress: fetchSessionDetails },
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status: 'in' | 'out' | 'maybe') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!session || !user) return;

    if (status === 'in' && session.max_players > 0 && session.current_players >= session.max_players) {
      const userAlreadyIn = session.participants.find(p => p.user_id === user.id && p.status === 'in');
      if (!userAlreadyIn) {
        Alert.alert('Session Full', 'This session is already at capacity.', [
          { text: 'OK' },
          { text: 'RSVP Maybe', onPress: () => handleRSVP('maybe') }
        ]);
        return;
      }
    }

    try {
      setUpdating(true);

      const existingParticipation = session.participants.find(p => p.user_id === user.id);
      const { error: rpcErr } = await supabase.rpc('rsvp_to_session', {
        p_session_id: sessionId,
        p_status: status,
      });

      if (rpcErr) {
        const rpcUnavailable =
          rpcErr.code === 'PGRST202' ||
          rpcErr.code === '42883' ||
          /function .*rsvp_to_session|does not exist|not found/i.test(rpcErr.message || '');

        if (!rpcUnavailable) throw rpcErr;

        const { error: upsertErr } = await supabase
          .from('session_participants')
          .upsert(
            [{ session_id: sessionId, user_id: user.id, status }],
            { onConflict: 'session_id,user_id' }
          );
        if (upsertErr) throw upsertErr;

        const { count, error: countFetchErr } = await supabase
          .from('session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sessionId)
          .eq('status', 'in');
        if (countFetchErr) throw countFetchErr;

        const { error: countErr } = await supabase
          .from('sessions')
          .update({ current_players: count || 0 })
          .eq('id', sessionId);
        if (countErr) console.error('Failed to update player count:', countErr);
      }

      if (status === 'in' && session) {
        notificationService.scheduleSessionReminders({
          id: session.id,
          title: session.title,
          scheduled_for: session.scheduled_for,
          sport: session.sport,
          location_name: session.location_name,
        });
      } else if (status === 'out' && session) {
        notificationService.cancelSessionReminders(session.id);

        // Auto-promote waitlist if the user was previously 'in' and had a spot
        const wasIn = existingParticipation?.status === 'in';
        if (wasIn) {
          supabase
            .rpc('promote_waitlist', { p_session_id: sessionId })
            .then(({ error }: any) => {
              if (error) console.error('promote_waitlist RPC failed:', error);
            });
        }
      }

      await fetchSessionDetails();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update RSVP');
    } finally {
      setUpdating(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user || !session) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const nextPosition = waitlist.length + 1;
      const { error } = await supabase
        .from('session_waitlist')
        .insert({
          session_id: session.id,
          user_id: user.id,
          position: nextPosition,
        });
      if (error) throw error;
      Alert.alert('Waitlisted!', `You're #${nextPosition} on the waitlist. We'll notify you if a spot opens.`);
      fetchSessionDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to join waitlist');
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!user || !session) return;
    try {
      await supabase
        .from('session_waitlist')
        .delete()
        .eq('session_id', session.id)
        .eq('user_id', user.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchSessionDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to leave waitlist');
    }
  };

  const handleNavigate = () => {
    if (!location?.latitude || !location?.longitude) return;
    Haptics.selectionAsync();
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(location.name)}@${location.latitude},${location.longitude}`,
      android: `geo:${location.latitude},${location.longitude}?q=${encodeURIComponent(location.name)}`,
    }) as string;
    Linking.openURL(url);
  };

  const handleShare = () => {
    if (!session) return;
    Haptics.selectionAsync();
    Share.share({
      message: `Join my ${session.sport} session: "${session.title}" on ${formatDate(session.scheduled_for)}${location ? ` at ${location.name}` : ''}. Download Ralli to join!`,
      title: session.title,
    });
  };

  const handleCancelSession = () => {
    if (!session || !isCreator) return;
    
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this session? All participants will be notified.',
      [
        { text: 'Keep Session', style: 'cancel' },
        { 
          text: 'Cancel Session', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              
              const { error } = await supabase
                .from('sessions')
                .update({ status: 'cancelled' })
                .eq('id', sessionId);
              
              if (error) throw new Error(error.message);

              // Notify all RSVP'd participants
              if (user && session) {
                await notificationService.notifySessionParticipants(
                  session.id,
                  user.id,
                  'session_cancelled',
                  'Session cancelled',
                  `${session.title} has been cancelled by the host.`,
                );
              }
              notificationService.cancelSessionReminders(sessionId!);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Session Cancelled',
                'Your session has been cancelled and all participants have been notified.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to cancel session. Please try again.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  const getParticipantsByStatus = (status: 'in' | 'out' | 'maybe') => 
    session?.participants.filter(p => p.status === status) || [];

  const userParticipation = session?.participants.find(p => p.user_id === user?.id);
  const isCreator = session?.creator_id === user?.id;
  const sportConfig = session ? SPORTS_CONFIG[session.sport as keyof typeof SPORTS_CONFIG] : null;
  const isPastSession = session ? new Date(session.scheduled_for) < new Date() : false;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}>
        <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.loadingCircle}>
          <Ionicons name="basketball-outline" size={40} color="white" />
        </LinearGradient>
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading session...</Text>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.bg }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={[styles.errorTitle, { color: theme.colors.textPrimary }]}>Unable to Load</Text>
        <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchSessionDetails}>
          <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.retryGradient}>
            <Text style={styles.retryText}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Header with gradient */}
      <LinearGradient 
        colors={theme.gradient.colors as [string, string]} 
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            {isCreator && !isPastSession && session.status !== 'cancelled' && (
              <TouchableOpacity 
                style={[styles.headerButton, styles.cancelButton]} 
                onPress={handleCancelSession}
                disabled={updating}
              >
                <Ionicons name="close-circle-outline" size={22} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Session Hero */}
        <View style={styles.heroContent}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportEmoji}>{sportConfig?.icon || '🏀'}</Text>
          </View>
          <Text style={styles.heroTitle}>{session.title}</Text>
          <Text style={styles.heroSport}>{sportConfig?.name || session.sport}</Text>
          
          {/* Host info */}
          <View style={styles.hostInfo}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>
                {getInitials(session.creator?.full_name, session.creator?.email)}
              </Text>
            </View>
            <View style={styles.hostDetails}>
              <Text style={styles.hostName}>
                Hosted by {session.creator?.full_name || 'Unknown'}
              </Text>
              {hostStats && (
                <View style={[styles.hostBadge, { backgroundColor: hostStats.badge.color + '20' }]}>
                  <Text style={[styles.hostBadgeText, { color: hostStats.badge.color }]}>
                    {hostStats.badge.label}
                  </Text>
                </View>
              )}
            </View>
            {isCreator && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          
          {/* Mutual friends indicator */}
          {mutualFriends.count > 0 && (
            <View style={styles.mutualFriendsRow}>
              <Ionicons name="people" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mutualFriendsText}>
                {mutualFriends.count === 1 
                  ? `${mutualFriends.names[0]} is going`
                  : `${mutualFriends.names[0]} and ${mutualFriends.count - 1} other friend${mutualFriends.count > 2 ? 's' : ''} going`}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Countdown / Time Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {session.status === 'cancelled' ? (
            <View style={styles.cancelledSessionBadge}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
              <Text style={[styles.cancelledSessionText, { color: '#EF4444' }]}>Session Cancelled</Text>
            </View>
          ) : !isPastSession ? (
            <SessionCountdown scheduledFor={session.scheduled_for} color={sportConfig?.color} />
          ) : (
            <View style={styles.pastSessionBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={[styles.pastSessionText, { color: theme.colors.textPrimary }]}>Session Completed</Text>
            </View>
          )}
          <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
            {formatDate(session.scheduled_for)}
          </Text>
        </View>

        {/* Location Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={20} color={sportConfig?.color || theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Location</Text>
          </View>
          
          {location ? (
            <View style={styles.locationContent}>
              <Text style={[styles.locationName, { color: theme.colors.textPrimary }]}>{location.name}</Text>
              <Text style={[styles.locationAddress, { color: theme.colors.textSecondary }]}>{location.address}</Text>
              
              {location.latitude && location.longitude && (
                <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
                  <LinearGradient
                    colors={theme.gradient.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.navigateGradient}
                  >
                    <Ionicons name="navigate" size={18} color="white" />
                    <Text style={styles.navigateText}>Get Directions</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={[styles.locationPlaceholder, { color: theme.colors.textMuted }]}>
              Location details unavailable
            </Text>
          )}
        </View>

        {/* Description */}
        {session.description && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={20} color={sportConfig?.color || theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>About</Text>
            </View>
            <Text style={[styles.descriptionText, { color: theme.colors.textSecondary }]}>
              {session.description}
            </Text>
          </View>
        )}

        {/* Players Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="people" size={20} color={sportConfig?.color || theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
              Players ({session.current_players}/{session.max_players})
            </Text>
            {session.max_players > 0 && session.current_players >= session.max_players && (
              <View style={styles.fullBadge}>
                <Text style={styles.fullBadgeText}>FULL</Text>
              </View>
            )}
          </View>

          {/* Player progress bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: theme.colors.border }]}>
              <LinearGradient
                colors={theme.gradient.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${session.max_players > 0 ? Math.min(100, (session.current_players / session.max_players) * 100) : 0}%` }]}
              />
            </View>
          </View>

          {/* Going */}
          <View style={styles.participantSection}>
            <View style={styles.participantHeader}>
              <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
              <Text style={[styles.participantLabel, { color: theme.colors.textPrimary }]}>
                Going ({getParticipantsByStatus('in').length})
              </Text>
            </View>
            <View style={styles.avatarRow}>
              {getParticipantsByStatus('in').map((p, i) => (
                <View key={p.id} style={[styles.participantAvatar, i > 0 && { marginLeft: -8 }]}>
                  <LinearGradient colors={['#22C55E', '#16A34A'] as [string, string]} style={styles.avatarGradient}>
                    <Text style={styles.avatarText}>{getInitials(p.user?.full_name, p.user?.email)}</Text>
                  </LinearGradient>
                </View>
              ))}
              {getParticipantsByStatus('in').length === 0 && (
                <Text style={[styles.noParticipants, { color: theme.colors.textMuted }]}>No one yet</Text>
              )}
            </View>
          </View>

          {/* Maybe */}
          {getParticipantsByStatus('maybe').length > 0 && (
            <View style={styles.participantSection}>
              <View style={styles.participantHeader}>
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.participantLabel, { color: theme.colors.textPrimary }]}>
                  Maybe ({getParticipantsByStatus('maybe').length})
                </Text>
              </View>
              <View style={styles.avatarRow}>
                {getParticipantsByStatus('maybe').map((p, i) => (
                  <View key={p.id} style={[styles.participantAvatar, i > 0 && { marginLeft: -8 }]}>
                    <LinearGradient colors={['#F59E0B', '#D97706'] as [string, string]} style={styles.avatarGradient}>
                      <Text style={styles.avatarText}>{getInitials(p.user?.full_name, p.user?.email)}</Text>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Waitlist */}
        {waitlist.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={20} color={sportConfig?.color || theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                Waitlist ({waitlist.length})
              </Text>
            </View>
            {waitlist.map((entry, index) => (
              <View key={entry.id} style={styles.waitlistItem}>
                <Text style={[styles.waitlistPosition, { color: theme.colors.textMuted }]}>#{index + 1}</Text>
                <Text style={[styles.waitlistName, { color: theme.colors.textPrimary }]}>{entry.user?.full_name || 'Player'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Spacer for RSVP buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* RSVP Footer */}
      {!isCreator && !isPastSession && session.status !== 'cancelled' && (
        <View style={[styles.rsvpFooter, { paddingBottom: insets.bottom + 16, backgroundColor: theme.colors.surface }]}>
          {session.max_players > 0 && session.current_players >= session.max_players && userParticipation?.status !== 'in' ? (
            <>
              <Text style={[styles.rsvpQuestion, { color: theme.colors.textPrimary }]}>Session is full</Text>
              {isOnWaitlist ? (
                <TouchableOpacity
                  style={styles.rsvpButton}
                  onPress={handleLeaveWaitlist}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706'] as [string, string]}
                    style={styles.rsvpButtonGradient}
                  >
                    <Ionicons name="time" size={22} color="white" />
                    <Text style={[styles.rsvpButtonText, { color: 'white' }]}>
                      Leave Waitlist (#{waitlist.findIndex(w => w.user_id === user?.id) + 1})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.rsvpButton}
                  onPress={handleJoinWaitlist}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5'] as [string, string]}
                    style={styles.rsvpButtonGradient}
                  >
                    <Ionicons name="add-circle" size={22} color="white" />
                    <Text style={[styles.rsvpButtonText, { color: 'white' }]}>
                      Join Waitlist
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.rsvpQuestion, { color: theme.colors.textPrimary }]}>Are you going?</Text>
              <View style={styles.rsvpButtons}>
                <TouchableOpacity
                  style={[styles.rsvpButton, userParticipation?.status === 'in' && styles.rsvpButtonSelected]}
                  onPress={() => handleRSVP('in')}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={userParticipation?.status === 'in' ? ['#22C55E', '#16A34A'] as [string, string] : ['#E5E7EB', '#D1D5DB'] as [string, string]}
                    style={styles.rsvpButtonGradient}
                  >
                    <Ionicons name="checkmark-circle" size={22} color={userParticipation?.status === 'in' ? 'white' : '#6B7280'} />
                    <Text style={[styles.rsvpButtonText, { color: userParticipation?.status === 'in' ? 'white' : '#6B7280' }]}>
                      I'm In
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rsvpButton, userParticipation?.status === 'maybe' && styles.rsvpButtonSelected]}
                  onPress={() => handleRSVP('maybe')}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={userParticipation?.status === 'maybe' ? ['#F59E0B', '#D97706'] as [string, string] : ['#E5E7EB', '#D1D5DB'] as [string, string]}
                    style={styles.rsvpButtonGradient}
                  >
                    <Ionicons name="help-circle" size={22} color={userParticipation?.status === 'maybe' ? 'white' : '#6B7280'} />
                    <Text style={[styles.rsvpButtonText, { color: userParticipation?.status === 'maybe' ? 'white' : '#6B7280' }]}>
                      Maybe
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rsvpButton, userParticipation?.status === 'out' && styles.rsvpButtonSelected]}
                  onPress={() => handleRSVP('out')}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={userParticipation?.status === 'out' ? ['#EF4444', '#DC2626'] as [string, string] : ['#E5E7EB', '#D1D5DB'] as [string, string]}
                    style={styles.rsvpButtonGradient}
                  >
                    <Ionicons name="close-circle" size={22} color={userParticipation?.status === 'out' ? 'white' : '#6B7280'} />
                    <Text style={[styles.rsvpButtonText, { color: userParticipation?.status === 'out' ? 'white' : '#6B7280' }]}>
                      Can't
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...createTextStyle('base', 'medium'),
    marginTop: DesignTokens.space.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.space.xl,
  },
  errorTitle: {
    ...createTextStyle('xl', 'bold'),
    marginTop: DesignTokens.space.lg,
  },
  errorText: {
    ...createTextStyle('base', 'regular'),
    textAlign: 'center',
    marginTop: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.xl,
  },
  retryButton: {
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
  },
  retryGradient: {
    paddingHorizontal: DesignTokens.space['2xl'],
    paddingVertical: DesignTokens.space.md,
  },
  retryText: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
  header: {
    paddingBottom: DesignTokens.space.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.lg,
    paddingTop: DesignTokens.space.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.xl,
    paddingTop: DesignTokens.space.lg,
  },
  sportBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.space.md,
  },
  sportEmoji: {
    fontSize: 32,
  },
  heroTitle: {
    ...createTextStyle('2xl', 'bold'),
    color: 'white',
    textAlign: 'center',
  },
  heroSport: {
    ...createTextStyle('base', 'medium'),
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: DesignTokens.space.lg,
    gap: DesignTokens.space.sm,
  },
  hostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    ...createTextStyle('xs', 'bold'),
    color: 'white',
  },
  hostName: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },
  youBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youBadgeText: {
    ...createTextStyle('xs', 'semibold'),
    color: 'white',
  },
  hostDetails: {
    flex: 1,
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  hostBadgeText: {
    ...createTextStyle('xs', 'semibold'),
  },
  mutualFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
    marginTop: DesignTokens.space.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.lg,
  },
  mutualFriendsText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
    padding: DesignTokens.space.lg,
  },
  card: {
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.md,
  },
  cardTitle: {
    ...createTextStyle('base', 'semibold'),
    flex: 1,
  },
  pastSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.sm,
  },
  pastSessionText: {
    ...createTextStyle('lg', 'semibold'),
  },
  cancelledSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.sm,
    backgroundColor: '#FEE2E2',
    paddingVertical: DesignTokens.space.md,
    paddingHorizontal: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.md,
  },
  cancelledSessionText: {
    ...createTextStyle('lg', 'semibold'),
  },
  dateText: {
    ...createTextStyle('sm', 'medium'),
    textAlign: 'center',
  },
  locationContent: {},
  locationName: {
    ...createTextStyle('lg', 'semibold'),
    marginBottom: 4,
  },
  locationAddress: {
    ...createTextStyle('sm', 'regular'),
    marginBottom: DesignTokens.space.md,
  },
  locationPlaceholder: {
    ...createTextStyle('sm', 'regular'),
  },
  navigateButton: {
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
  },
  navigateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignTokens.space.md,
    gap: DesignTokens.space.sm,
  },
  navigateText: {
    ...createTextStyle('sm', 'semibold'),
    color: 'white',
  },
  descriptionText: {
    ...createTextStyle('base', 'regular'),
    lineHeight: 22,
  },
  progressContainer: {
    marginBottom: DesignTokens.space.lg,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  fullBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fullBadgeText: {
    ...createTextStyle('xs', 'bold'),
    color: 'white',
  },
  participantSection: {
    marginTop: DesignTokens.space.md,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  participantLabel: {
    ...createTextStyle('sm', 'semibold'),
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: DesignTokens.space.lg,
  },
  participantAvatar: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 18,
  },
  avatarGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...createTextStyle('xs', 'bold'),
    color: 'white',
  },
  noParticipants: {
    ...createTextStyle('sm', 'regular'),
  },
  rsvpFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: DesignTokens.space.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  rsvpQuestion: {
    ...createTextStyle('base', 'semibold'),
    textAlign: 'center',
    marginBottom: DesignTokens.space.md,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
  },
  rsvpButton: {
    flex: 1,
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
  },
  rsvpButtonSelected: {
    ...DesignTokens.shadow.md,
  },
  rsvpButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignTokens.space.md,
    gap: DesignTokens.space.xs,
  },
  rsvpButtonText: {
    ...createTextStyle('sm', 'semibold'),
  },
  waitlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  waitlistPosition: {
    ...createTextStyle('sm', 'bold'),
    width: 32,
    textAlign: 'center',
  },
  waitlistName: {
    ...createTextStyle('base', 'medium'),
    flex: 1,
  },
});








