import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle, Gradients } from '../design/tokens';
import { notificationService, NotificationPreferences } from '../services/notificationService';
import { isOnline } from '../utils/errorHandling';

type NotificationSettingsNavigationProp = StackNavigationProp<RootStackParamList>;

interface NotificationItem {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const NOTIFICATION_ITEMS: NotificationItem[] = [
  {
    key: 'session_reminders',
    title: 'Session Reminders',
    description: 'Get notified about upcoming sessions you joined',
    icon: 'calendar-outline',
  },
  {
    key: 'friend_requests',
    title: 'Friend Requests',
    description: 'When someone wants to connect with you',
    icon: 'person-add-outline',
  },
  {
    key: 'squad_invites',
    title: 'Squad Invitations',
    description: 'When you\'re invited to join a squad',
    icon: 'people-outline',
  },
  {
    key: 'chat_messages',
    title: 'Chat Messages',
    description: 'New messages in squad and direct chats',
    icon: 'chatbubble-outline',
  },
  {
    key: 'check_in_nearby',
    title: 'Nearby Activity',
    description: 'When friends check in at nearby facilities',
    icon: 'location-outline',
  },
  {
    key: 'marketing',
    title: 'News & Updates',
    description: 'Ralli news, features, and special offers',
    icon: 'megaphone-outline',
  },
];

export default function NotificationSettingsScreen() {
  const navigation = useNavigation<NotificationSettingsNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    session_reminders: true,
    friend_requests: true,
    squad_invites: true,
    chat_messages: true,
    check_in_nearby: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    loadPreferences();
    checkPermission();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const prefs = await notificationService.getPreferences(user.id);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermission = async () => {
    const token = await notificationService.registerForPushNotifications();
    setHasPermission(!!token);
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!user) return;

    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to update notification settings.');
      return;
    }

    Haptics.selectionAsync();
    const newValue = !preferences[key];
    
    // Optimistic update
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    
    setSaving(true);
    const success = await notificationService.updatePreferences(user.id, { [key]: newValue });
    setSaving(false);

    if (!success) {
      // Revert on failure
      setPreferences(prev => ({ ...prev, [key]: !newValue }));
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    }
  };

  const handleEnableNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to enable push notifications.');
      return;
    }

    const token = await notificationService.registerForPushNotifications();
    
    if (token && user) {
      await notificationService.savePushToken(user.id, token);
      setHasPermission(true);
      Alert.alert('Success', 'Push notifications enabled!');
    } else {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive updates.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient colors={[...Gradients.ralliPrimary]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Permission Banner */}
          {hasPermission === false && (
            <TouchableOpacity 
              style={[styles.permissionBanner, { backgroundColor: theme.colors.primary }]}
              onPress={handleEnableNotifications}
            >
              <Ionicons name="notifications-off" size={24} color="white" />
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionTitle}>Notifications Disabled</Text>
                <Text style={styles.permissionSubtitle}>Tap to enable push notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          )}

          {/* Notification Preferences */}
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            {NOTIFICATION_ITEMS.map((item, index) => (
              <View 
                key={item.key}
                style={[
                  styles.preferenceItem,
                  index < NOTIFICATION_ITEMS.length - 1 && { 
                    borderBottomWidth: 1, 
                    borderBottomColor: theme.colors.border 
                  }
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.preferenceContent}>
                  <Text style={[styles.preferenceTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.preferenceDescription, { color: theme.colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
                <Switch
                  value={preferences[item.key]}
                  onValueChange={() => handleToggle(item.key)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="white"
                  disabled={hasPermission === false}
                />
              </View>
            ))}
          </View>

          {/* Info Text */}
          <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
            You can change these settings at any time. Some notifications may still be sent for 
            important account and security updates.
          </Text>

          {saving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.savingText, { color: theme.colors.textSecondary }]}>
                Saving...
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: DesignTokens.space.lg,
    paddingHorizontal: DesignTokens.space.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: DesignTokens.space.lg,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    marginBottom: DesignTokens.space.lg,
    gap: DesignTokens.space.md,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
  permissionSubtitle: {
    ...createTextStyle('sm', 'regular'),
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    borderRadius: DesignTokens.radius.lg,
    overflow: 'hidden',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
    gap: DesignTokens.space.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceTitle: {
    ...createTextStyle('base', 'semibold'),
    marginBottom: 2,
  },
  preferenceDescription: {
    ...createTextStyle('sm', 'regular'),
  },
  infoText: {
    ...createTextStyle('sm', 'regular'),
    marginTop: DesignTokens.space.lg,
    textAlign: 'center',
    paddingHorizontal: DesignTokens.space.lg,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DesignTokens.space.lg,
    gap: DesignTokens.space.sm,
  },
  savingText: {
    ...createTextStyle('sm', 'medium'),
  },
});
