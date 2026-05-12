import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { MessagingApi } from '../../services/squadApi';
import { supabase } from '../../services/supabase';
import { SquadMessage, DirectMessage } from '../../types/squad.types';
import { SPORT_TEMPLATES } from '../../constants/sportTemplates';
import { RouteProp } from '@react-navigation/native';
import { useTheme, type ThemeContextValue } from '../../theme/theme';
import { EmptyState } from '../../components/ui';

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type ChatScreenRouteProp = RouteProp<RootStackParamList, 'ChatScreen'>;

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  created_at: string;
  message_type: 'text' | 'image' | 'system';
  is_own_message: boolean;
}

export default function ChatScreen() {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  // Safely destructure params with fallback
  const type = route.params?.type;
  const id = route.params?.id;
  const name = route.params?.name || 'Chat';
  const sport = route.params?.sport;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const styles = useMemo(() => createChatStyles(theme), [theme]);
  const sportConfig = sport ? SPORT_TEMPLATES[sport as keyof typeof SPORT_TEMPLATES] : null;
  
  // Cache for user information (to avoid repeated DB lookups)
  const userCacheRef = useRef<Map<string, { name: string; avatar?: string }>>(new Map());

  // Helper function to get user info (from cache or DB)
  const getUserInfo = async (userId: string): Promise<{ name: string; avatar?: string }> => {
    // Check cache first
    if (userCacheRef.current.has(userId)) {
      return userCacheRef.current.get(userId)!;
    }

    // Fetch from database
    try {
      const { data } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();

      const userInfo = {
        name: data?.full_name || 'Unknown User',
        avatar: data?.avatar_url || undefined,
      };

      // Store in cache
      userCacheRef.current.set(userId, userInfo);
      return userInfo;
    } catch (error) {
      return { name: 'Unknown User' };
    }
  };

  const appendMessage = useCallback((message: Message) => {
    setMessages(prev => {
      if (prev.some(existing => existing.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  // Load messages on mount and set up real-time subscription
  useFocusEffect(
    useCallback(() => {
      if (!id) {
        navigation.goBack();
        return;
      }
      loadMessages();

      let subscription: any;
      let cancelled = false;

      if (type === 'squad') {
        subscription = MessagingApi.subscribeToSquadMessages(id, async (newMsg) => {
          if (newMsg.sender_id !== user?.id) {
            const senderInfo = await getUserInfo(newMsg.sender_id);
            
            appendMessage({
              id: newMsg.id,
              content: newMsg.content,
              sender_id: newMsg.sender_id,
              sender_name: senderInfo.name,
              sender_avatar: senderInfo.avatar,
              created_at: newMsg.created_at,
              message_type: newMsg.message_type || 'text',
              is_own_message: false,
            });
          }
        });
      } else if (type === 'direct' && user) {
        (async () => {
          const { data: threadId, error } = await MessagingApi.getOrCreateDirectThreadId(id);
          if (cancelled) return;

          if (error || !threadId) {
            setMessagesError(error || 'Could not open chat');
            return;
          }

          subscription = MessagingApi.subscribeToDirectMessages(threadId, async (newMsg: any) => {
            if (newMsg.sender_id !== user.id) {
              const senderInfo = await getUserInfo(newMsg.sender_id);
              appendMessage({
                id: newMsg.id,
                content: newMsg.content,
                sender_id: newMsg.sender_id,
                sender_name: senderInfo.name,
                sender_avatar: senderInfo.avatar,
                created_at: newMsg.created_at,
                message_type: newMsg.message_type || 'text',
                is_own_message: false,
              });
            }
          });
        })();
      }

      return () => {
        cancelled = true;
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }, [appendMessage, id, type, user?.id])
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      let result;
      if (type === 'squad') {
        result = await MessagingApi.getSquadMessages(id!);
      } else {
        result = await MessagingApi.getDirectMessages(id!);
      }

      if (result.data) {
        // Populate user cache from loaded messages
        result.data.forEach((msg: Message) => {
          if (msg.sender_id && msg.sender_name) {
            userCacheRef.current.set(msg.sender_id, {
              name: msg.sender_name,
              avatar: msg.sender_avatar,
            });
          }
        });
        
        setMessages(result.data);
        setMessagesError(null);
      } else if (result.error) {
        setMessagesError(result.error);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessagesError('Could not load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !id) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSending(true);
      
      let result;
      if (type === 'squad') {
        result = await MessagingApi.sendSquadMessage(id, newMessage.trim());
      } else {
        result = await MessagingApi.sendDirectMessage(id, newMessage.trim());
      }

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      if (result.data) {
        appendMessage(result.data);
        setNewMessage('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.is_own_message;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && (
          <View style={styles.senderInfo}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderAvatarText}>
                {item.sender_name?.charAt(0) || '?'}
              </Text>
            </View>
            <Text style={styles.senderName}>{item.sender_name}</Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={type === 'squad' ? 'people' : 'chatbubbles'} 
        size={64} 
        color={theme.colors.textMuted} 
      />
      <Text style={styles.emptyTitle}>
        {type === 'squad' ? 'Squad Chat' : 'Direct Messages'}
      </Text>
      <Text style={styles.emptyText}>
        {type === 'squad' 
          ? 'Start chatting with your squad members!'
          : 'Start your conversation!'
        }
      </Text>
    </View>
  );

  const renderListEmpty = () => {
    if (loading) {
      return (
        <View style={styles.listLoading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }
    if (messagesError) {
      return (
        <View style={styles.emptyState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load messages"
            subtitle={messagesError}
            actionText="Try Again"
            onAction={() => loadMessages()}
            variant="error"
          />
        </View>
      );
    }
    return renderEmptyState();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          {sportConfig && (
            <Text style={styles.sportIcon}>{sportConfig.icon}</Text>
          )}
          <View>
            <Text style={styles.headerTitle}>{name}</Text>
            <Text style={styles.headerSubtitle}>
              {type === 'squad' ? 'Squad Chat' : 'Direct Message'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => {
            if (type === 'squad') {
              navigation.navigate('SquadDetail', { squadId: id });
            }
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={9}
          ListEmptyComponent={renderListEmpty}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={`Message ${type === 'squad' ? 'squad' : name}...`}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons 
              name={sending ? "hourglass" : "send"} 
              size={20} 
              color={(!newMessage.trim() || sending) ? theme.colors.textMuted : theme.colors.primary} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createChatStyles(theme: ThemeContextValue) {
  const { colors: c } = theme;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sportIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textPrimary,
    },
    headerSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 2,
    },
    headerAction: {
      padding: 8,
    },
    chatContainer: {
      flex: 1,
    },
    messagesList: {
      flex: 1,
    },
    messagesContent: {
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    listLoading: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageContainer: {
      marginBottom: 16,
    },
    ownMessageContainer: {
      alignItems: 'flex-end',
    },
    otherMessageContainer: {
      alignItems: 'flex-start',
    },
    senderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    senderAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    senderAvatarText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    senderName: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textSecondary,
    },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
    },
    ownMessageBubble: {
      backgroundColor: c.primary,
    },
    otherMessageBubble: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    messageText: {
      fontSize: 16,
      lineHeight: 20,
    },
    ownMessageText: {
      color: 'white',
    },
    otherMessageText: {
      color: c.textPrimary,
    },
    messageTime: {
      fontSize: 11,
      marginTop: 4,
    },
    ownMessageTime: {
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'right',
    },
    otherMessageTime: {
      color: c.textMuted,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      maxHeight: 100,
      marginRight: 12,
      color: c.textPrimary,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: c.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
