import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { CommunityApi, CourtMessage } from '../../services/communityApi';
import { Gradients } from '../../design/tokens';

type CourtChatScreenNavProp = StackNavigationProp<RootStackParamList>;
type CourtChatScreenRouteProp = RouteProp<RootStackParamList, 'CourtChat'>;

export default function CourtChatScreen() {
  const navigation = useNavigation<CourtChatScreenNavProp>();
  const route = useRoute<CourtChatScreenRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const { googlePlaceId, facilityName } = route.params;

  const [messages, setMessages] = useState<CourtMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadMessages();

      const subscription = CommunityApi.subscribeToCourtMessages(
        googlePlaceId,
        (msg) => {
          if (msg.user_id !== user?.id) {
            setMessages((prev) => [msg, ...prev]);
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }, [googlePlaceId, user?.id])
  );

  const loadMessages = async () => {
    setLoading(true);
    const data = await CommunityApi.getCourtMessages(googlePlaceId);
    setMessages(data);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await CommunityApi.getCourtMessages(googlePlaceId);
      setMessages(data);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic insert
    const optimistic: CourtMessage = {
      id: `temp-${Date.now()}`,
      google_place_id: googlePlaceId,
      user_id: user.id,
      content,
      message_type: 'text',
      metadata: {},
      created_at: new Date().toISOString(),
      user_name: user.full_name || 'You',
      user_avatar: user.avatar_url || undefined,
    };
    setMessages((prev) => [optimistic, ...prev]);

    const result = await CommunityApi.sendCourtMessage(googlePlaceId, user.id, content);
    if (result) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id
            ? { ...result, user_name: optimistic.user_name, user_avatar: optimistic.user_avatar }
            : m
        )
      );
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(content);
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item }: { item: CourtMessage }) => {
    const isOwn = item.user_id === user?.id;

    return (
      <View style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
        {!isOwn && (
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={styles.avatarText}>
              {(item.user_name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.messageContent}>
          {!isOwn && (
            <Text style={[styles.senderName, { color: theme.colors.primary }]}>
              {item.user_name}
            </Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwn
                ? { backgroundColor: theme.colors.primary }
                : { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
          Start the conversation
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
          Be the first to say something at {facilityName}. Coordinate games, find players, or just say hi.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {facilityName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>
            Court Chat
          </Text>
        </View>
        <TouchableOpacity
          style={styles.crewsButton}
          onPress={() =>
            navigation.navigate('CourtCrews', { googlePlaceId, facilityName })
          }
        >
          <Ionicons name="shield-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={renderEmpty}
            inverted={messages.length > 0}
            contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messagesList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.bg,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="Message this court..."
            placeholderTextColor={theme.colors.textMuted}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
            style={styles.sendButtonWrapper}
          >
            <LinearGradient
              colors={newMessage.trim() ? [...Gradients.ralliPrimary] : [theme.colors.border, theme.colors.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendButton}
            >
              <Ionicons name="send" size={18} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  crewsButton: {
    padding: 8,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  ownMessageRow: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B57FF',
  },
  messageContent: {
    maxWidth: '75%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
  },
  ownMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  ownMessageTime: {
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButtonWrapper: {
    marginBottom: 2,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
