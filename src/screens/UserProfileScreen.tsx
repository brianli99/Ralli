import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FriendshipApi } from '../services/squadApi';
import { SPORTS_CONFIG } from '../constants/sports';
import { User } from '../types';
import { useTheme } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'UserProfile'>;

type FriendshipState = 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'self';

export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user: currentUser } = useAuth();
  const theme = useTheme();

  const { userId } = route.params;

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendship, setFriendship] = useState<FriendshipState>('none');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);

      if (currentUser?.id === userId) {
        setFriendship('self');
      } else if (currentUser) {
        const { data: fr } = await supabase
          .from('friendships')
          .select('status, user_id, friend_id')
          .or(
            `and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`
          )
          .maybeSingle();
        if (!fr) setFriendship('none');
        else if (fr.status === 'accepted') setFriendship('friends');
        else if (fr.status === 'pending') {
          setFriendship(fr.user_id === currentUser.id ? 'pending_sent' : 'pending_received');
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      Alert.alert('Error', 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!currentUser) return;
    setSending(true);
    Haptics.selectionAsync();
    const { error } = await FriendshipApi.sendFriendRequest(userId);
    setSending(false);
    if (error) {
      Alert.alert('Error', typeof error === 'string' ? error : 'Could not send request');
    } else {
      setFriendship('pending_sent');
      Alert.alert('Request sent', `We'll let ${profile?.full_name || 'them'} know.`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-remove-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (profile.full_name || profile.email || 'U').charAt(0).toUpperCase();
  const preferredSports = profile.preferred_sports || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient
          colors={theme.gradient.colors as [string, string]}
          style={styles.hero}
        >
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.full_name || 'Ralli User'}</Text>
          {profile.email && <Text style={styles.email}>{profile.email}</Text>}

          {friendship === 'self' ? null : friendship === 'friends' ? (
            <View style={[styles.actionChip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.actionChipText}>Friends</Text>
            </View>
          ) : friendship === 'pending_sent' ? (
            <View style={[styles.actionChip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="time-outline" size={16} color="white" />
              <Text style={styles.actionChipText}>Request sent</Text>
            </View>
          ) : friendship === 'pending_received' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Friends')}
              style={[styles.actionChip, { backgroundColor: 'rgba(255,255,255,0.3)' }]}
            >
              <Ionicons name="person-add" size={16} color="white" />
              <Text style={styles.actionChipText}>Respond to request</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleAddFriend}
              disabled={sending}
              style={[styles.actionChip, { backgroundColor: 'white' }]}
            >
              <Ionicons name="person-add" size={16} color={theme.colors.primary} />
              <Text style={[styles.actionChipText, { color: theme.colors.primary }]}>
                {sending ? 'Sending…' : 'Add Friend'}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Preferred Sports</Text>
          {preferredSports.length === 0 ? (
            <Text style={[styles.placeholder, { color: theme.colors.textMuted }]}>
              No sports selected yet
            </Text>
          ) : (
            <View style={styles.sportsRow}>
              {preferredSports.map((sport: string) => {
                const cfg = SPORTS_CONFIG[sport as keyof typeof SPORTS_CONFIG];
                if (!cfg) return null;
                return (
                  <View
                    key={sport}
                    style={[styles.sportPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}
                  >
                    <Text style={styles.sportEmoji}>{cfg.icon}</Text>
                    <Text style={[styles.sportText, { color: cfg.color }]}>{cfg.name}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '600' },
  hero: { alignItems: 'center', paddingVertical: 32 },
  avatarImage: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'white',
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: 'white', fontSize: 36, fontWeight: '700' },
  name: { color: 'white', fontSize: 22, fontWeight: '700', marginTop: 12 },
  email: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginTop: 16,
  },
  actionChipText: { color: 'white', fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  placeholder: { fontSize: 13 },
  sportsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  sportEmoji: { fontSize: 14 },
  sportText: { fontSize: 13, fontWeight: '600' },
});
