import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Session, SessionParticipant, Court, User } from '../types';
import { SPORTS_CONFIG } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';

type SessionDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SessionDetail'>;
type SessionDetailScreenRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;

interface SessionWithDetails extends Session {
  court: Court;
  creator: User;
  participants: (SessionParticipant & { user: User })[];
}

export default function SessionDetailScreen() {
  const navigation = useNavigation<SessionDetailScreenNavigationProp>();
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { user } = useAuth();
  const { sessionId } = route.params;

  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          court:courts(*),
          creator:users!sessions_creator_id_fkey(*),
          participants:session_participants(
            *,
            user:users(*)
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);

    } catch (error: any) {
      Alert.alert('Error', 'Failed to load session details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status: 'in' | 'out' | 'maybe') => {
    if (!session || !user) return;

    try {
      setUpdating(true);

      const existingParticipation = session.participants.find(p => p.user_id === user.id);

      if (existingParticipation) {
        // Update existing participation
        await supabase
          .from('session_participants')
          .update({ status })
          .eq('id', existingParticipation.id);
      } else {
        // Create new participation
        await supabase
          .from('session_participants')
          .insert([{
            session_id: sessionId,
            user_id: user.id,
            status
          }]);
      }

      // Update session player count
      const inCount = session.participants.filter(p => 
        p.user_id === user.id ? status === 'in' : p.status === 'in'
      ).length + (status === 'in' && !existingParticipation ? 1 : 0);

      await supabase
        .from('sessions')
        .update({ current_players: inCount })
        .eq('id', sessionId);

      await fetchSessionDetails();

    } catch (error: any) {
      Alert.alert('Error', 'Failed to update RSVP: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getUserParticipation = () => {
    if (!session || !user) return null;
    return session.participants.find(p => p.user_id === user.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getParticipantsByStatus = (status: 'in' | 'out' | 'maybe') => {
    return session?.participants.filter(p => p.status === status) || [];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const userParticipation = getUserParticipation();
  const isCreator = session.creator_id === user?.id;
  const sportConfig = SPORTS_CONFIG[session.sport as keyof typeof SPORTS_CONFIG];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionTitleRow}>
            <Text style={styles.sessionEmoji}>{sportConfig?.icon || '🏀'}</Text>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionSport}>{sportConfig?.name || session.sport}</Text>
            </View>
            {isCreator && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>Host</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.sessionDate}>{formatDate(session.scheduled_for)}</Text>
          
          <TouchableOpacity style={styles.courtCard}>
            <Ionicons name="location-outline" size={20} color="#1a73e8" />
            <View style={styles.courtInfo}>
              <Text style={styles.courtName}>{session.court.name}</Text>
              <Text style={styles.courtAddress}>{session.court.address}</Text>
            </View>
          </TouchableOpacity>

          {session.description && (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{session.description}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Players ({session.current_players}/{session.max_players})
          </Text>

          {/* Going */}
          <View style={styles.participantGroup}>
            <View style={styles.participantGroupHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.participantGroupTitle}>
                Going ({getParticipantsByStatus('in').length})
              </Text>
            </View>
            {getParticipantsByStatus('in').map((participant) => (
              <View key={participant.id} style={styles.participantItem}>
                <Text style={styles.participantName}>
                  {participant.user.full_name || participant.user.email}
                  {participant.user_id === session.creator_id && ' (Host)'}
                </Text>
              </View>
            ))}
          </View>

          {/* Maybe */}
          {getParticipantsByStatus('maybe').length > 0 && (
            <View style={styles.participantGroup}>
              <View style={styles.participantGroupHeader}>
                <Ionicons name="help-circle" size={20} color="#FF9800" />
                <Text style={styles.participantGroupTitle}>
                  Maybe ({getParticipantsByStatus('maybe').length})
                </Text>
              </View>
              {getParticipantsByStatus('maybe').map((participant) => (
                <View key={participant.id} style={styles.participantItem}>
                  <Text style={styles.participantName}>
                    {participant.user.full_name || participant.user.email}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Not Going */}
          {getParticipantsByStatus('out').length > 0 && (
            <View style={styles.participantGroup}>
              <View style={styles.participantGroupHeader}>
                <Ionicons name="close-circle" size={20} color="#f44336" />
                <Text style={styles.participantGroupTitle}>
                  Not Going ({getParticipantsByStatus('out').length})
                </Text>
              </View>
              {getParticipantsByStatus('out').map((participant) => (
                <View key={participant.id} style={styles.participantItem}>
                  <Text style={styles.participantName}>
                    {participant.user.full_name || participant.user.email}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {!isCreator && (
          <View style={styles.rsvpSection}>
            <Text style={styles.rsvpTitle}>Are you going?</Text>
            <View style={styles.rsvpButtons}>
              <TouchableOpacity
                style={[
                  styles.rsvpButton,
                  styles.rsvpButtonIn,
                  userParticipation?.status === 'in' && styles.rsvpButtonActive,
                  updating && styles.buttonDisabled
                ]}
                onPress={() => handleRSVP('in')}
                disabled={updating}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.rsvpButtonText}>I'm In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rsvpButton,
                  styles.rsvpButtonMaybe,
                  userParticipation?.status === 'maybe' && styles.rsvpButtonActive,
                  updating && styles.buttonDisabled
                ]}
                onPress={() => handleRSVP('maybe')}
                disabled={updating}
              >
                <Ionicons name="help" size={20} color="white" />
                <Text style={styles.rsvpButtonText}>Maybe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rsvpButton,
                  styles.rsvpButtonOut,
                  userParticipation?.status === 'out' && styles.rsvpButtonActive,
                  updating && styles.buttonDisabled
                ]}
                onPress={() => handleRSVP('out')}
                disabled={updating}
              >
                <Ionicons name="close" size={20} color="white" />
                <Text style={styles.rsvpButtonText}>Can't Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  sessionHeader: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sessionSport: {
    fontSize: 16,
    color: '#666',
  },
  hostBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  hostBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  sessionDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 16,
  },
  courtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 16,
  },
  courtInfo: {
    marginLeft: 12,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  courtAddress: {
    fontSize: 14,
    color: '#666',
  },
  descriptionCard: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  participantGroup: {
    marginBottom: 16,
  },
  participantGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  participantItem: {
    paddingLeft: 28,
    paddingVertical: 4,
  },
  participantName: {
    fontSize: 16,
    color: '#333',
  },
  rsvpSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  rsvpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 4,
  },
  rsvpButtonIn: {
    backgroundColor: '#4CAF50',
  },
  rsvpButtonMaybe: {
    backgroundColor: '#FF9800',
  },
  rsvpButtonOut: {
    backgroundColor: '#f44336',
  },
  rsvpButtonActive: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  rsvpButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
