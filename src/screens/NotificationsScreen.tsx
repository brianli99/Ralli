import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';

type Nav = StackNavigationProp<RootStackParamList>;

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
};

const ICON_FOR_TYPE: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  session_cancelled: { name: 'close-circle', color: '#EF4444' },
  session_reminder: { name: 'alarm', color: '#F59E0B' },
  session_updated: { name: 'information-circle', color: '#3B82F6' },
  waitlist_promoted: { name: 'checkmark-circle', color: '#22C55E' },
  friend_request: { name: 'person-add', color: '#3B82F6' },
  friend_accepted: { name: 'people', color: '#22C55E' },
  squad_invite: { name: 'people-circle', color: '#8B5CF6' },
  squad_joined: { name: 'people', color: '#22C55E' },
  new_message: { name: 'chatbubble', color: '#3B82F6' },
  generic: { name: 'notifications', color: '#6B7280' },
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const theme = useTheme();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleMarkAllRead = async () => {
    if (!user) return;
    Haptics.selectionAsync();
    try {
      await supabase
        .from('app_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error('Mark all read failed:', e);
    }
  };

  const handleItemPress = async (notif: AppNotification) => {
    Haptics.selectionAsync();

    // Mark as read
    if (!notif.read) {
      supabase
        .from('app_notifications')
        .update({ read: true })
        .eq('id', notif.id)
        .then(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }

    // Navigate based on type
    const sessionId = notif.data?.session_id;
    const squadId = notif.data?.squad_id;
    const crewId = notif.data?.crew_id;

    if (sessionId) {
      navigation.navigate('SessionDetail', { sessionId });
    } else if (squadId) {
      navigation.navigate('SquadDetail', { squadId });
    } else if (crewId) {
      navigation.navigate('CrewDetail', { crewId });
    }
  };

  const handleClear = () => {
    if (!user || notifications.length === 0) return;
    Alert.alert(
      'Clear All',
      'Remove all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('app_notifications').delete().eq('user_id', user.id);
              setNotifications([]);
            } catch (e) {
              console.error('Clear notifications failed:', e);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = ICON_FOR_TYPE[item.type] || ICON_FOR_TYPE.generic;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          !item.read && { backgroundColor: theme.colors.primary + '0D' },
        ]}
        activeOpacity={0.7}
        onPress={() => handleItemPress(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.title, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
          </View>
          {item.body && (
            <Text
              style={[styles.body, { color: theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
          )}
          <Text style={[styles.time, { color: theme.colors.textMuted }]}>
            {formatRelative(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notifications</Text>
        <TouchableOpacity onPress={handleClear} style={styles.headerBtn}>
          {notifications.length > 0 ? (
            <Ionicons name="trash-outline" size={22} color={theme.colors.textSecondary} />
          ) : (
            <View style={{ width: 22 }} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>All caught up</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            You don't have any notifications yet.
          </Text>
        </View>
      ) : (
        <>
          {notifications.some((n) => !n.read) && (
            <TouchableOpacity
              style={[styles.markAllRow, { borderBottomColor: theme.colors.border }]}
              onPress={handleMarkAllRead}
            >
              <Ionicons name="checkmark-done" size={16} color={theme.colors.primary} />
              <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all as read</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={notifications}
            keyExtractor={(n) => n.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={theme.colors.primary}
              />
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '600' },
  emptySubtitle: { marginTop: 4, fontSize: 14, textAlign: 'center' },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  markAllText: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  body: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  time: { marginTop: 6, fontSize: 11 },
});
