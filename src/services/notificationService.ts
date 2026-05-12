import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreferences {
  session_reminders: boolean;
  friend_requests: boolean;
  squad_invites: boolean;
  chat_messages: boolean;
  check_in_nearby: boolean;
  marketing: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  session_reminders: true,
  friend_requests: true,
  squad_invites: true,
  chat_messages: true,
  check_in_nearby: true,
  marketing: false,
};

function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    Constants.manifest2?.extra?.eas?.projectId
  );
}

class NotificationService {
  private pushToken: string | null = null;

  /**
   * Register for push notifications and get the token
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Check if physical device (push notifications don't work on simulators)
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check/request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get the token. Expo push tokens require an EAS project ID in recent SDKs.
    try {
      const projectId = getExpoProjectId();
      if (!projectId) {
        if (__DEV__) {
          console.info('[Notifications] EAS projectId not set; skipping Expo push token registration.');
        }
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      
      this.pushToken = tokenData.data;
      return this.pushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Save push token to Supabase
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            token: token,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        console.error('Error saving push token:', error);
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  /**
   * Remove push token on logout
   */
  async removePushToken(userId: string): Promise<void> {
    if (!this.pushToken) return;

    try {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', this.pushToken);
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return DEFAULT_PREFERENCES;
      }

      return {
        session_reminders: data.session_reminders ?? true,
        friend_requests: data.friend_requests ?? true,
        squad_invites: data.squad_invites ?? true,
        chat_messages: data.chat_messages ?? true,
        check_in_nearby: data.check_in_nearby ?? true,
        marketing: data.marketing ?? false,
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: userId,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error updating preferences:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    triggerSeconds?: number
  ): Promise<string | null> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: triggerSeconds
          ? { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds, repeats: false }
          : null, // null means immediate
      });
      return id;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Add notification listeners
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return Notifications.getLastNotificationResponseAsync();
  }

  /**
   * Schedule session reminders (T-24h and T-2h before session)
   */
  async scheduleSessionReminders(session: {
    id: string;
    title: string;
    scheduled_for: string;
    sport: string;
    location_name?: string | null;
  }): Promise<string[]> {
    // Respect user's notification preferences
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        const prefs = await this.getPreferences(userId);
        if (!prefs.session_reminders) {
          return [];
        }
      }
    } catch (e) {
      // Fall through and schedule anyway if prefs check fails
    }

    const scheduledIds: string[] = [];
    const sessionTime = new Date(session.scheduled_for).getTime();
    const now = Date.now();

    const reminders = [
      { label: '24h', offsetMs: 24 * 60 * 60 * 1000, body: `Tomorrow: ${session.title}. Are you still going?` },
      { label: '2h', offsetMs: 2 * 60 * 60 * 1000, body: `Starting soon: ${session.title}${session.location_name ? ' at ' + session.location_name : ''}` },
    ];

    for (const reminder of reminders) {
      const triggerTime = sessionTime - reminder.offsetMs;
      const secondsFromNow = Math.floor((triggerTime - now) / 1000);

      if (secondsFromNow > 60) {
        const id = await this.scheduleLocalNotification(
          `🏀 ${session.title}`,
          reminder.body,
          { sessionId: session.id, type: 'session_reminder' },
          secondsFromNow,
        );
        if (id) scheduledIds.push(id);
      }
    }
    return scheduledIds;
  }

  /**
   * Insert a single in-app notification row.
   */
  async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    body?: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const { error } = await supabase.from('app_notifications').insert({
        user_id: userId,
        type,
        title,
        body: body || null,
        data: data || {},
      });
      if (error) console.error('createInAppNotification error:', error);
    } catch (e) {
      console.error('createInAppNotification exception:', e);
    }
  }

  /**
   * Notify every RSVP'd participant of a session (except the sender).
   */
  async notifySessionParticipants(
    sessionId: string,
    senderUserId: string,
    type: string,
    title: string,
    body?: string,
  ): Promise<void> {
    try {
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)
        .in('status', ['in', 'maybe']);

      if (!participants || participants.length === 0) return;

      const rows = participants
        .filter((p) => p.user_id !== senderUserId)
        .map((p) => ({
          user_id: p.user_id,
          type,
          title,
          body: body || null,
          data: { session_id: sessionId },
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from('app_notifications').insert(rows);
        if (error) console.error('notifySessionParticipants error:', error);
      }
    } catch (e) {
      console.error('notifySessionParticipants exception:', e);
    }
  }

  /**
   * Cancel session reminders by session ID prefix
   */
  async cancelSessionReminders(sessionId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.sessionId === sessionId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
