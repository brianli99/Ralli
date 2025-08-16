import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { CheckIn, Session, Sport } from '../types';
import { SPORTS_CONFIG, SPORT_FILTERS } from '../constants/sports';

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    totalSessions: 0,
    checkInsByMonth: 0,
    favoriteSpot: null as string | null,
  });
  const [recentActivity, setRecentActivity] = useState<(CheckIn | Session)[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSports, setSelectedSports] = useState<Sport[]>([]);

  useEffect(() => {
    if (user) {
      setSelectedSports(user.preferred_sports as Sport[]);
      fetchUserStats();
      fetchRecentActivity();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      // Get total check-ins
      const { count: checkInCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get total sessions (created + participated)
      const { count: createdSessions } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', user.id);

      const { count: participatedSessions } = await supabase
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'in');

      // Get check-ins this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { count: monthlyCheckIns } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', thisMonth.toISOString());

      // Get favorite court (most checked-in court)
      const { data: courtStats } = await supabase
        .from('check_ins')
        .select('court_id, courts(name)')
        .eq('user_id', user.id);

      let favoriteSpot = null;
      if (courtStats && courtStats.length > 0) {
        const courtCounts: { [key: string]: { name: string; count: number } } = {};
        courtStats.forEach((checkIn: any) => {
          const courtId = checkIn.court_id;
          const courtName = checkIn.courts.name;
          if (courtCounts[courtId]) {
            courtCounts[courtId].count++;
          } else {
            courtCounts[courtId] = { name: courtName, count: 1 };
          }
        });

        const mostVisited = Object.values(courtCounts).reduce((max, court) =>
          court.count > max.count ? court : max
        );
        favoriteSpot = mostVisited.name;
      }

      setStats({
        totalCheckIns: checkInCount || 0,
        totalSessions: (createdSessions || 0) + (participatedSessions || 0),
        checkInsByMonth: monthlyCheckIns || 0,
        favoriteSpot,
      });

    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      // Get recent check-ins
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*, courts(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*, courts(name)')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Combine and sort by date
      const combined = [
        ...(checkIns || []).map(item => ({ ...item, type: 'check_in' })),
        ...(sessions || []).map(item => ({ ...item, type: 'session' }))
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 10);

      setRecentActivity(combined);

    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserStats(), fetchRecentActivity()]);
    setRefreshing(false);
  };

  const handleSportToggle = async (sport: Sport) => {
    const newSelectedSports = selectedSports.includes(sport)
      ? selectedSports.filter(s => s !== sport)
      : [...selectedSports, sport];
    
    setSelectedSports(newSelectedSports);
    
    try {
      await updateProfile({ preferred_sports: newSelectedSports });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update preferences');
      setSelectedSports(selectedSports); // Revert on error
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut }
      ]
    );
  };

  const formatActivityDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {user.full_name || 'Ralli User'}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalCheckIns}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalSessions}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.checkInsByMonth}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
          </View>
          {stats.favoriteSpot && (
            <View style={styles.favoriteSpot}>
              <Ionicons name="location" size={20} color="#1a73e8" />
              <Text style={styles.favoriteSpotText}>
                Favorite spot: {stats.favoriteSpot}
              </Text>
            </View>
          )}
        </View>

        {/* Sports Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Sports</Text>
          <Text style={styles.sectionSubtitle}>
            Select your favorite sports to get personalized recommendations
          </Text>
          <View style={styles.sportsGrid}>
            {SPORT_FILTERS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportButton,
                  selectedSports.includes(sport) && styles.sportButtonActive,
                  { borderColor: SPORTS_CONFIG[sport].color }
                ]}
                onPress={() => handleSportToggle(sport)}
              >
                <Text style={styles.sportEmoji}>{SPORTS_CONFIG[sport].icon}</Text>
                <Text
                  style={[
                    styles.sportText,
                    selectedSports.includes(sport) && styles.sportTextActive
                  ]}
                >
                  {SPORTS_CONFIG[sport].name}
                </Text>
                {selectedSports.includes(sport) && (
                  <Ionicons name="checkmark" size={16} color={SPORTS_CONFIG[sport].color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No recent activity. Start checking into courts and creating sessions!
              </Text>
            </View>
          ) : (
            recentActivity.map((activity: any, index) => (
              <View key={`${activity.type}-${activity.id}`} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  {activity.type === 'check_in' ? (
                    <Ionicons name="location" size={20} color="#4CAF50" />
                  ) : (
                    <Ionicons name="calendar" size={20} color="#1a73e8" />
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    {activity.type === 'check_in' 
                      ? `Checked in for ${SPORTS_CONFIG[activity.sport as Sport]?.name || activity.sport}`
                      : `Created session: ${activity.title}`
                    }
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    {activity.courts?.name} • {formatActivityDate(activity.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
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
    backgroundColor: 'white',
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  signOutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  favoriteSpot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
  },
  favoriteSpotText: {
    fontSize: 14,
    color: '#1a73e8',
    marginLeft: 8,
    fontWeight: '500',
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  sportButtonActive: {
    backgroundColor: '#f0f7ff',
  },
  sportEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  sportText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 8,
  },
  sportTextActive: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
  },
});
