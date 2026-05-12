import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { CheckIn, Session, Sport } from '../types';
import { Squad } from '../types/squad.types';
import { SPORTS_CONFIG } from '../constants/sports';
import { SPORT_TEMPLATES } from '../constants/sportTemplates';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle, getSportGradient } from '../design/tokens';
import { useCourtFavorites } from '../hooks/useCourtFavorites';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<ProfileNavigationProp>();
  const theme = useTheme();
  const { favoriteList, refreshFavorites } = useCourtFavorites();
  
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    totalSessions: 0,
    checkInsByMonth: 0,
    favoriteSpot: null as string | null,
  });
  const [recentActivity, setRecentActivity] = useState<(CheckIn | Session)[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSports, setSelectedSports] = useState<Sport[]>([]);
  const [userSquads, setUserSquads] = useState<Squad[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'sports' | 'awards' | 'goals'>('stats');

  // Gamification - calculated from real data
  const [level, setLevel] = useState<number>(1);
  const [currentXp, setCurrentXp] = useState<number>(0);
  const [nextLevelXp, setNextLevelXp] = useState<number>(100);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [rank, setRank] = useState<number>(0);

  useEffect(() => {
    if (user) {
      setSelectedSports((user.preferred_sports as Sport[]) || []);
      fetchUserStats();
      fetchRecentActivity();
      fetchUserSquads();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      // Fetch total check-ins
      const { count: checkInsCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch sessions user has created or joined
      const { count: sessionsCount } = await supabase
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch this month's check-ins
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      setStats({
        totalCheckIns: checkInsCount || 0,
        totalSessions: sessionsCount || 0,
        checkInsByMonth: monthlyCount || 0,
        favoriteSpot: null,
      });

      // Calculate XP and Level
      // XP: 10 per check-in, 25 per session
      const totalXp = ((checkInsCount || 0) * 10) + ((sessionsCount || 0) * 25);
      
      // Level calculation: Each level requires 100 more XP than the previous
      // Level 1: 0-99, Level 2: 100-299, Level 3: 300-599, etc.
      let calculatedLevel = 1;
      let xpForNextLevel = 100;
      let xpAccumulated = 0;
      
      while (totalXp >= xpAccumulated + xpForNextLevel) {
        xpAccumulated += xpForNextLevel;
        calculatedLevel++;
        xpForNextLevel = calculatedLevel * 100;
      }
      
      const xpInCurrentLevel = totalXp - xpAccumulated;
      
      setLevel(calculatedLevel);
      setCurrentXp(xpInCurrentLevel);
      setNextLevelXp(xpForNextLevel);

      // Calculate streak (consecutive days with check-ins)
      await calculateStreak();

      // Calculate user ranking
      await calculateRanking(totalXp);

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const calculateRanking = async (userXp: number) => {
    if (!user) return;

    try {
      // Get all users' check-in and session counts to calculate their XP
      // Then determine this user's rank
      
      // First, get all users' stats
      const { data: allCheckIns } = await supabase
        .from('check_ins')
        .select('user_id');

      const { data: allSessions } = await supabase
        .from('session_participants')
        .select('user_id');

      // Calculate XP per user
      const userXpMap = new Map<string, number>();
      
      // Add check-in XP (10 per check-in)
      allCheckIns?.forEach(ci => {
        const current = userXpMap.get(ci.user_id) || 0;
        userXpMap.set(ci.user_id, current + 10);
      });

      // Add session XP (25 per session)
      allSessions?.forEach(sp => {
        const current = userXpMap.get(sp.user_id) || 0;
        userXpMap.set(sp.user_id, current + 25);
      });

      // Sort by XP descending
      const sortedUsers = Array.from(userXpMap.entries())
        .sort((a, b) => b[1] - a[1]);

      // Find current user's rank
      const userRank = sortedUsers.findIndex(([userId]) => userId === user.id) + 1;
      
      setRank(userRank || (sortedUsers.length + 1)); // If not found, they're last
    } catch (error) {
      console.error('Error calculating ranking:', error);
      setRank(0);
    }
  };

  const calculateStreak = async () => {
    if (!user) return;

    try {
      // Get recent check-ins sorted by date
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!checkIns || checkIns.length === 0) {
        setStreakDays(0);
        return;
      }

      // Get unique dates
      const checkInDates = new Set<string>();
      checkIns.forEach(ci => {
        const date = new Date(ci.created_at).toDateString();
        checkInDates.add(date);
      });

      // Count consecutive days from today
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateString = checkDate.toDateString();
        
        if (checkInDates.has(dateString)) {
          streak++;
        } else if (i > 0) {
          // Allow today to not have check-in yet
          break;
        }
      }

      setStreakDays(streak);
    } catch (error) {
      console.error('Error calculating streak:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity(checkIns || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const fetchUserSquads = async () => {
    if (!user) return;

    try {
      const { data: squadMembers } = await supabase
        .from('squad_members')
        .select(`
          squad:squads(*)
        `)
        .eq('user_id', user.id);

      const squads = squadMembers?.map((sm: any) => sm.squad).filter(Boolean) || [];
      setUserSquads(squads);
    } catch (error) {
      console.error('Error fetching squads:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUserStats(),
      fetchRecentActivity(),
      fetchUserSquads(),
      refreshFavorites(),
    ]);
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() }
      ]
    );
  };

  const handleEditSports = () => {
    Haptics.selectionAsync();
    navigation.navigate('SportOnboarding');
  };

  const handleEditProfile = () => {
    Haptics.selectionAsync();
    navigation.navigate('EditProfile');
  };

  const handleFriends = () => {
    Haptics.selectionAsync();
    navigation.navigate('Friends');
  };

  const xpProgress = (currentXp / nextLevelXp) * 100;

  // Awards based on real achievements
  const awards = [
    { id: 1, icon: '🏆', name: 'First Check-in', earned: stats.totalCheckIns >= 1 },
    { id: 2, icon: '🔥', name: '7-Day Streak', earned: streakDays >= 7 },
    { id: 3, icon: '🎯', name: '10 Sessions', earned: stats.totalSessions >= 10 },
    { id: 4, icon: '⭐', name: 'MVP Vote', earned: false }, // Future feature
    { id: 5, icon: '👑', name: 'Squad Leader', earned: userSquads.some(s => s.owner_id === user?.id) },
    { id: 6, icon: '🌟', name: 'Early Adopter', earned: true }, // True for beta users
  ];

  // Goals based on real data
  const goals = [
    { 
      id: 1, 
      title: 'Weekly Games', 
      current: Math.min(stats.totalSessions, 5), 
      target: 5, 
      color: '#FF6B35' 
    },
    { 
      id: 2, 
      title: 'Monthly Check-ins', 
      current: Math.min(stats.checkInsByMonth, 20), 
      target: 20, 
      color: '#3B82F6' 
    },
    { 
      id: 3, 
      title: 'Try New Sports', 
      current: selectedSports.length, 
      target: 6, 
      color: '#22C55E' 
    },
  ];

  const renderStatsTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient colors={['#FF6B3510', '#FF6B3505'] as [string, string]} style={styles.statGradient}>
            <Text style={styles.statEmoji}>🏀</Text>
            <Text style={styles.statValue}>{stats.totalCheckIns}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </LinearGradient>
              </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient colors={['#3B82F610', '#3B82F605'] as [string, string]} style={styles.statGradient}>
            <Text style={styles.statEmoji}>📅</Text>
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </LinearGradient>
            </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient colors={['#F59E0B10', '#F59E0B05'] as [string, string]} style={styles.statGradient}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streakDays}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </LinearGradient>
                </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient colors={['#22C55E10', '#22C55E05'] as [string, string]} style={styles.statGradient}>
            <Text style={styles.statEmoji}>🏅</Text>
            <Text style={styles.statValue}>#{rank}</Text>
            <Text style={styles.statLabel}>Ranking</Text>
          </LinearGradient>
                </View>
              </View>

      {/* Saved courts */}
      <View style={[styles.sectionHeader, { marginTop: DesignTokens.space.lg }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Saved courts</Text>
      </View>
      {favoriteList.length === 0 ? (
        <Text
          style={[
            createTextStyle('sm', 'regular'),
            { color: theme.colors.textMuted, marginBottom: DesignTokens.space.lg },
          ]}
        >
          Save places from the map or court details with the heart icon.
        </Text>
      ) : (
        <View style={{ marginBottom: DesignTokens.space.lg, gap: DesignTokens.space.sm }}>
          {favoriteList.map((row) => (
            <TouchableOpacity
              key={row.google_place_id}
              style={[
                styles.savedCourtRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('CourtDetail', { courtId: row.google_place_id });
              }}
            >
              <Ionicons name="heart" size={18} color={theme.colors.danger} style={{ marginRight: DesignTokens.space.sm }} />
              <Text
                style={[createTextStyle('base', 'medium'), { color: theme.colors.textPrimary, flex: 1 }]}
                numberOfLines={2}
              >
                {row.facility_name || 'Saved place'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Squads Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Squads</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateSquad')}>
          <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>+ New</Text>
        </TouchableOpacity>
            </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.squadsRow}>
        {userSquads.length > 0 ? (
          userSquads.map((squad) => (
            <TouchableOpacity
              key={squad.id}
              style={styles.squadCard}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('SquadDetail', { squadId: squad.id });
              }}
            >
              <View style={styles.squadAvatar}>
                <Text style={styles.squadEmoji}>{SPORT_TEMPLATES[squad.sport_code]?.icon || '🏀'}</Text>
          </View>
              <Text style={styles.squadName} numberOfLines={1}>{squad.name}</Text>
              <Text style={styles.squadMembers}>{squad.member_count || 0} members</Text>
          </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptySquadsCard}>
            <Text style={styles.emptySquadsText}>Join or create a squad to rally together!</Text>
        </View>
        )}
      </ScrollView>
        </View>
  );

  const renderSportsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sportsGrid}>
        {Object.entries(SPORTS_CONFIG).map(([sport, config]) => {
          const isSelected = selectedSports.includes(sport as Sport);
          const sportGradient = getSportGradient(sport);

          return (
            <View
              key={sport}
              style={[
                styles.sportCard,
                { backgroundColor: theme.colors.surface },
                isSelected && { borderColor: config.color },
              ]}
            >
              <LinearGradient
                colors={isSelected ? sportGradient : ['#F3F4F6', '#E5E7EB']}
                style={styles.sportCardGradient}
              >
                <Text style={[styles.sportCardEmoji, !isSelected && { opacity: 0.5 }]}>
                  {config.icon}
                </Text>
              </LinearGradient>
              <Text style={[styles.sportCardName, !isSelected && { opacity: 0.5 }]}>
                {config.name}
              </Text>
              {isSelected && (
                <View style={[styles.selectedBadge, { backgroundColor: config.color }]}>
                  <Ionicons name="checkmark" size={12} color="white" />
          </View>
              )}
          </View>
          );
        })}
          </View>
      <TouchableOpacity
        style={[styles.editSportsButton, { borderColor: theme.colors.primary }]}
        onPress={handleEditSports}
      >
        <Text style={[styles.editSportsText, { color: theme.colors.primary }]}>
          Edit Preferences
              </Text>
          </TouchableOpacity>
      </View>
  );

  const renderAwardsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.awardsGrid}>
        {awards.map((award) => (
          <View
            key={award.id}
            style={[
              styles.awardCard,
              { backgroundColor: theme.colors.surface },
              !award.earned && styles.awardCardLocked,
            ]}
          >
            <Text style={[styles.awardEmoji, !award.earned && { opacity: 0.3 }]}>
              {award.icon}
            </Text>
            <Text style={[styles.awardName, !award.earned && { opacity: 0.5 }]}>
              {award.name}
            </Text>
            {!award.earned && (
              <Ionicons name="lock-closed" size={12} color="#9CA3AF" style={styles.lockIcon} />
            )}
              </View>
        ))}
              </View>
              </View>
  );

  const renderGoalsTab = () => (
    <View style={styles.tabContent}>
      {goals.map((goal) => {
        const progress = (goal.current / goal.target) * 100;

        return (
          <View
            key={goal.id}
            style={[styles.goalCard, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              <Text style={styles.goalProgress}>
                {goal.current}/{goal.target}
              </Text>
                  </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color },
                ]}
              />
                </View>
            <Text style={styles.goalSubtext}>
              {goal.target - goal.current} more to complete
            </Text>
              </View>
        );
      })}
                </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return renderStatsTab();
      case 'sports':
        return renderSportsTab();
      case 'awards':
        return renderAwardsTab();
      case 'goals':
        return renderGoalsTab();
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero Header */}
        <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.hero}>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleFriends}>
              <Ionicons name="people-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
            
          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={['#ffffff40', '#ffffff20']}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarText}>
                    {user.full_name?.slice(0, 2).toUpperCase() || 'U'}
                  </Text>
                </LinearGradient>
              )}
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{level}</Text>
                </View>
              </View>
            <Text style={styles.userName}>{user.full_name || 'User'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>

            {/* XP Progress */}
            <View style={styles.xpContainer}>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
              </View>
              <Text style={styles.xpText}>
                {currentXp} / {nextLevelXp} XP to Level {level + 1}
              </Text>
              </View>
            </View>
        </LinearGradient>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {(['stats', 'sports', 'awards', 'goals'] as const).map((tab) => {
            const icons = {
              stats: 'stats-chart-outline',
              sports: 'football-outline',
              awards: 'trophy-outline',
              goals: 'flag-outline',
            };
            const labels = {
              stats: 'Stats',
              sports: 'Sports',
              awards: 'Awards',
              goals: 'Goals',
            };

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab);
                }}
              >
                <Ionicons
                  name={icons[tab] as any}
                  size={18}
                  color={activeTab === tab ? theme.colors.primary : '#9CA3AF'}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {labels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
                </View>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Settings */}
        <View style={styles.settingsSection}>
          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.settingsText}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => {
              Linking.openURL('mailto:feedback@ralli.app?subject=Ralli%20Beta%20Feedback');
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.settingsText}>Send Feedback</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => Linking.openURL('https://ralli.app/privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.settingsText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => Linking.openURL('https://ralli.app/terms')}
          >
            <Ionicons name="document-text-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={styles.settingsText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account and all your data. To confirm, email us at support@ralli.app from your account email.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Email Support',
                    onPress: () => Linking.openURL(`mailto:support@ralli.app?subject=Delete%20my%20Ralli%20account&body=Please%20delete%20the%20account%20for%20${encodeURIComponent(user.email || '')}`),
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
            <Text style={[styles.settingsText, { color: '#EF4444' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', color: theme.colors.textMuted, fontSize: 12, marginTop: 12, marginBottom: 24 }}>
          Ralli v{Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </ScrollView>
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
    paddingTop: 60,
    paddingBottom: DesignTokens.space['3xl'],
    paddingHorizontal: DesignTokens.space.xl,
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: DesignTokens.space.sm,
    marginBottom: DesignTokens.space.xl,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: DesignTokens.space.lg,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    ...createTextStyle('3xl', 'bold'),
    color: 'white',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  levelText: {
    ...createTextStyle('sm', 'bold'),
    color: 'white',
  },
  userName: {
    ...createTextStyle('2xl', 'bold'),
    color: 'white',
    marginBottom: DesignTokens.space.xs,
  },
  userEmail: {
    ...createTextStyle('base', 'medium'),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: DesignTokens.space.xl,
  },
  xpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  xpBarBg: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: DesignTokens.space.sm,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  xpText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },

  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignTokens.space.sm,
    gap: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.md,
  },
  activeTab: {
    backgroundColor: '#F3F4F6',
  },
  tabText: {
    ...createTextStyle('sm', 'semibold'),
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#3B82F6',
  },

  // Tab Content
  tabContent: {
    padding: DesignTokens.space.lg,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.space.md,
    marginBottom: DesignTokens.space.xl,
  },
  statCard: {
    width: '47%',
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
    ...DesignTokens.shadow.sm,
  },
  statGradient: {
    padding: DesignTokens.space.lg,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: DesignTokens.space.sm,
  },
  statValue: {
    ...createTextStyle('2xl', 'bold'),
    color: '#111827',
  },
  statLabel: {
    ...createTextStyle('sm', 'medium'),
    color: '#6B7280',
    marginTop: DesignTokens.space.xs,
  },

  // Squads Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.space.md,
  },
  sectionTitle: {
    ...createTextStyle('lg', 'bold'),
    color: '#111827',
  },
  sectionAction: {
    ...createTextStyle('base', 'semibold'),
  },
  squadsRow: {
    marginHorizontal: -DesignTokens.space.lg,
    paddingHorizontal: DesignTokens.space.lg,
  },
  squadCard: {
    width: 100,
    alignItems: 'center',
    marginRight: DesignTokens.space.md,
    backgroundColor: 'white',
    padding: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    ...DesignTokens.shadow.sm,
  },
  squadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.space.sm,
  },
  squadEmoji: {
    fontSize: 24,
  },
  squadName: {
    ...createTextStyle('sm', 'semibold'),
    color: '#111827',
    textAlign: 'center',
    marginBottom: DesignTokens.space.xs,
  },
  squadMembers: {
    ...createTextStyle('xs', 'medium'),
    color: '#6B7280',
  },
  emptySquadsCard: {
    backgroundColor: '#F3F4F6',
    padding: DesignTokens.space.xl,
    borderRadius: DesignTokens.radius.lg,
    width: 280,
  },
  emptySquadsText: {
    ...createTextStyle('sm', 'medium'),
    color: '#6B7280',
    textAlign: 'center',
  },
  savedCourtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.space.md,
    paddingHorizontal: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
  },

  // Sports Grid
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.space.md,
    marginBottom: DesignTokens.space.xl,
  },
  sportCard: {
    width: '30%',
    alignItems: 'center',
    padding: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    ...DesignTokens.shadow.sm,
  },
  sportCardGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.space.sm,
  },
  sportCardEmoji: {
    fontSize: 24,
  },
  sportCardName: {
    ...createTextStyle('sm', 'semibold'),
    color: '#111827',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSportsButton: {
    borderWidth: 2,
    borderRadius: DesignTokens.radius.lg,
    paddingVertical: DesignTokens.space.md,
    alignItems: 'center',
  },
  editSportsText: {
    ...createTextStyle('base', 'semibold'),
  },

  // Awards Grid
  awardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.space.md,
  },
  awardCard: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DesignTokens.radius.lg,
    position: 'relative',
    ...DesignTokens.shadow.sm,
  },
  awardCardLocked: {
    backgroundColor: '#F3F4F6',
  },
  awardEmoji: {
    fontSize: 32,
    marginBottom: DesignTokens.space.sm,
  },
  awardName: {
    ...createTextStyle('xs', 'semibold'),
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: DesignTokens.space.xs,
  },
  lockIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Goals
  goalCard: {
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    marginBottom: DesignTokens.space.md,
    ...DesignTokens.shadow.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.space.sm,
  },
  goalTitle: {
    ...createTextStyle('base', 'semibold'),
    color: '#111827',
  },
  goalProgress: {
    ...createTextStyle('base', 'bold'),
    color: '#6B7280',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: DesignTokens.space.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalSubtext: {
    ...createTextStyle('sm', 'medium'),
    color: '#9CA3AF',
  },

  // Settings Section
  settingsSection: {
    paddingHorizontal: DesignTokens.space.lg,
    paddingBottom: DesignTokens.space['3xl'],
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: DesignTokens.space.lg,
    paddingHorizontal: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    gap: DesignTokens.space.md,
    ...DesignTokens.shadow.sm,
  },
  settingsText: {
    ...createTextStyle('base', 'semibold'),
    color: '#111827',
    flex: 1,
  },
});
