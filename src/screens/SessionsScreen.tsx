import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Session, SessionParticipant, Court } from '../types';
import { SPORTS_CONFIG } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';

type SessionsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface SessionWithDetails extends Session {
  court: Court;
  participants: SessionParticipant[];
  user_participation?: SessionParticipant;
}

export default function SessionsScreen() {
  const navigation = useNavigation<SessionsScreenNavigationProp>();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'my-sessions'>('upcoming');

  useFocusEffect(
    React.useCallback(() => {
      fetchSessions();
    }, [activeTab])
  );

  const fetchSessions = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          court:courts(*),
          participants:session_participants(*)
        `)
        .eq('status', 'upcoming')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Add user participation info
      const sessionsWithParticipation = (data || []).map(session => ({
        ...session,
        user_participation: session.participants.find(p => p.user_id === user.id)
      }));

      // Filter based on active tab
      let filteredSessions = sessionsWithParticipation;
      if (activeTab === 'my-sessions') {
        filteredSessions = sessionsWithParticipation.filter(session =>
          session.creator_id === user.id || session.user_participation
        );
      }

      setSessions(filteredSessions);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load sessions');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('SessionDetail', { sessionId });
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
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getParticipationStatus = (session: SessionWithDetails) => {
    if (session.creator_id === user?.id) return 'host';
    if (!session.user_participation) return 'not-joined';
    return session.user_participation.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'host': return '#FF6B35';
      case 'in': return '#4CAF50';
      case 'maybe': return '#FF9800';
      case 'out': return '#f44336';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'host': return 'Hosting';
      case 'in': return 'Going';
      case 'maybe': return 'Maybe';
      case 'out': return 'Not Going';
      default: return 'Join';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            All Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-sessions' && styles.activeTab]}
          onPress={() => setActiveTab('my-sessions')}
        >
          <Text style={[styles.tabText, activeTab === 'my-sessions' && styles.activeTabText]}>
            My Sessions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'upcoming' ? 'No upcoming sessions' : 'No sessions yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'upcoming' 
                ? 'Check the map to find courts and create sessions!'
                : 'Join or create sessions to see them here.'
              }
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => handleSessionPress(session.id)}
            >
              <View style={styles.sessionHeader}>
                <View style={styles.sessionTitleRow}>
                  <Text style={styles.sessionEmoji}>
                    {SPORTS_CONFIG[session.sport as keyof typeof SPORTS_CONFIG]?.icon || '🏀'}
                  </Text>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    <Text style={styles.courtName}>{session.court.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(getParticipationStatus(session)) }]}>
                    <Text style={styles.statusText}>{getStatusText(getParticipationStatus(session))}</Text>
                  </View>
                </View>
                
                <View style={styles.sessionDetails}>
                  <View style={styles.sessionDetailItem}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.sessionDetailText}>
                      {formatDate(session.scheduled_for)}
                    </Text>
                  </View>
                  
                  <View style={styles.sessionDetailItem}>
                    <Ionicons name="people-outline" size={16} color="#666" />
                    <Text style={styles.sessionDetailText}>
                      {session.current_players}/{session.max_players} players
                    </Text>
                  </View>
                </View>

                {session.description && (
                  <Text style={styles.sessionDescription} numberOfLines={2}>
                    {session.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
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
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1a73e8',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    gap: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sessionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  courtName: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionDetailText: {
    fontSize: 14,
    color: '#666',
  },
  sessionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});
