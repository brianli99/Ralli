import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  TextInput,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { SPORT_TEMPLATES } from '../../constants/sportTemplates';
import { FeedApi, FeedActivity, formatActivityText, formatActivityDetails, ActivityComment } from '../../services/feedApi';
import { SquadApi, FriendshipApi } from '../../services/squadApi';
import { supabase } from '../../services/supabase';
import { Squad, FriendWithStatus, FriendRequest } from '../../types/squad.types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { DesignTokens, createTextStyle } from '../../design/tokens';
import { EmptyState, ListSkeleton } from '../../components/ui';
import QRCodeGenerator from '../../components/QRCodeGenerator';

type SquadTabNavigationProp = StackNavigationProp<RootStackParamList>;

type TabType = 'feed' | 'squads' | 'friends';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEED_REACTIONS = ['👍', '🔥', '🎉', '💪'] as const;

export default function SquadTabScreen() {
  const navigation = useNavigation<SquadTabNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('squads');
  
  // State for real data
  const [feedActivities, setFeedActivities] = useState<FeedActivity[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  
  // Loading states
  const [feedLoading, setFeedLoading] = useState(true);
  const [squadsLoading, setSquadsLoading] = useState(true);
  
  const [refreshing, setRefreshing] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activeActivity, setActiveActivity] = useState<FeedActivity | null>(null);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<TextInput>(null);
  
  // Find squads modal state
  const [findSquadsVisible, setFindSquadsVisible] = useState(false);
  const [discoverableSquads, setDiscoverableSquads] = useState<Squad[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningSquadId, setJoiningSquadId] = useState<string | null>(null);

  // Friends state
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [squadsError, setSquadsError] = useState<string | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  // Animation for tab indicator (3 tabs now)
  const tabIndicatorPosition = useState(new Animated.Value(1))[0]; // Start on squads (index 1)

  // Data fetching functions
  const fetchFeedActivities = useCallback(async () => {
    try {
      setFeedError(null);
      const { data, error } = await FeedApi.getFeedActivities(20);
      if (error) {
        console.error('Error fetching feed:', error);
        setFeedError(typeof error === 'string' ? error : 'Could not load feed');
        return;
      }
      if (data) {
        setFeedActivities(data);
      }
    } catch (error: any) {
      console.error('Error fetching feed:', error);
      setFeedError(error?.message || 'Could not load feed');
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const fetchSquads = useCallback(async () => {
    try {
      setSquadsError(null);
      const { data, error } = await SquadApi.getMySquads();
      if (error) {
        console.error('Error fetching squads:', error);
        setSquadsError(typeof error === 'string' ? error : 'Could not load squads');
        return;
      }
      if (data) {
        setSquads(data);
      }
    } catch (error: any) {
      console.error('Error fetching squads:', error);
      setSquadsError(error?.message || 'Could not load squads');
    } finally {
      setSquadsLoading(false);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      setFriendsError(null);
      const [friendsResponse, requestsResponse] = await Promise.all([
        FriendshipApi.getFriends(),
        FriendshipApi.getFriendRequests(),
      ]);

      if (friendsResponse.error) {
        setFriendsError(typeof friendsResponse.error === 'string' ? friendsResponse.error : 'Could not load friends');
      }
      if (friendsResponse.data) {
        setFriends(friendsResponse.data);
      }
      if (requestsResponse.data) {
        setFriendRequests(requestsResponse.data);
      }
    } catch (error: any) {
      console.error('Error fetching friends:', error);
      setFriendsError(error?.message || 'Could not load friends');
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFeedActivities(),
      fetchSquads(),
      fetchFriends()
    ]);
    setRefreshing(false);
  }, [fetchFeedActivities, fetchFriends, fetchSquads]);

  const handleLike = useCallback(async (activityId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { data: isLiked, error } = await FeedApi.toggleLike(activityId);
      if (error) {
        Alert.alert('Error', 'Failed to update like');
        return;
      }

      setFeedActivities(prev => prev.map(activity => 
        activity.id === activityId 
          ? { 
              ...activity, 
              is_liked: isLiked || false,
              likes_count: Math.max(0, activity.likes_count + (isLiked ? 1 : -1))
            }
          : activity
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to update like');
    }
  }, []);

  const openComments = useCallback(async (activity: FeedActivity) => {
    Haptics.selectionAsync();
    try {
      setActiveActivity(activity);
      setCommentsVisible(true);
      setCommentsLoading(true);
      setCommentsError(null);
      const { data, error } = await FeedApi.getActivityComments(activity.id);
      if (error) {
        setCommentsError(error);
        setComments([]);
        return;
      }
      setComments(data || []);
    } catch (err: any) {
      setCommentsError(err?.message || 'Could not load comments');
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const addComment = async (content: string) => {
    if (!activeActivity || !content.trim()) return;
    const { data, error } = await FeedApi.addComment(activeActivity.id, content.trim());
    if (error) {
      Alert.alert('Error', 'Failed to add comment');
      return;
    }
    if (data) {
      setComments(prev => [...prev, data]);
      setFeedActivities(prev => prev.map(activity =>
        activity.id === activeActivity.id
          ? { ...activity, comments_count: activity.comments_count + 1 }
          : activity
      ));
      setActiveActivity(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
    }
  };

  const switchTab = (tab: TabType) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    const tabIndex = tab === 'feed' ? 0 : tab === 'squads' ? 1 : 2;
    Animated.spring(tabIndicatorPosition, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  };

  const handleSearchFriends = async () => {
    if (!friendSearchQuery.trim()) return;
    
    setSearchingFriends(true);
    try {
      const { data, error } = await FriendshipApi.searchUsers(friendSearchQuery.trim());
      if (data) {
        // Filter out existing friends and current user
        const filtered = data.filter(u => 
          u.id !== user?.id && 
          !friends.some(f => f.id === u.id) &&
          !friendRequests.some(request => request.sender_id === u.id || request.receiver_id === u.id)
        );
        setFriendSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchingFriends(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await FriendshipApi.sendFriendRequest(userId);
      if (error) {
        Alert.alert('Error', typeof error === 'string' ? error : 'Failed to send friend request');
        return;
      }
      Alert.alert('Success', 'Friend request sent!');
      setFriendSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await FriendshipApi.acceptFriendRequest(requestId);
      if (error) {
        Alert.alert('Error', 'Failed to accept request');
        return;
      }
      // Refresh friends list
      await fetchFriends();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await FriendshipApi.declineFriendRequest(requestId);
      if (error) {
        Alert.alert('Error', 'Failed to decline request');
        return;
      }
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      Alert.alert('Error', 'Failed to decline request');
    }
  };

  // Find squads functions
  const openFindSquads = async () => {
    setFindSquadsVisible(true);
    setSearchQuery('');
    setDiscoverError(null);
    await fetchDiscoverableSquads();
  };

  const fetchDiscoverableSquads = async () => {
    try {
      setDiscoverLoading(true);
      setDiscoverError(null);
      const { data, error } = await SquadApi.getDiscoverableSquads(undefined, 20);
      if (error) {
        console.error('Error fetching discoverable squads:', error);
        setDiscoverError(typeof error === 'string' ? error : 'Could not load squads');
        setDiscoverableSquads([]);
        return;
      }
      setDiscoverableSquads(data || []);
    } catch (error: any) {
      console.error('Error fetching discoverable squads:', error);
      setDiscoverError(error?.message || 'Could not load squads');
      setDiscoverableSquads([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const searchSquads = async (query: string) => {
    if (query.length < 2) {
      await fetchDiscoverableSquads();
      return;
    }
    
    try {
      setDiscoverLoading(true);
      setDiscoverError(null);
      const { data, error } = await SquadApi.searchSquads(query);
      if (error) {
        console.error('Error searching squads:', error);
        setDiscoverError(typeof error === 'string' ? error : 'Search failed');
        setDiscoverableSquads([]);
        return;
      }
      setDiscoverableSquads(data || []);
    } catch (error: any) {
      console.error('Error searching squads:', error);
      setDiscoverError(error?.message || 'Search failed');
      setDiscoverableSquads([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleJoinSquad = async (squadId: string, squadName: string) => {
    try {
      setJoiningSquadId(squadId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const { error } = await SquadApi.requestToJoin(squadId);
      
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `You've joined "${squadName}"!`);
      
      // Refresh squads list and close modal
      await fetchSquads();
      setFindSquadsVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to join squad');
    } finally {
      setJoiningSquadId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        handleRefresh();
        fetchUnreadCount();
      }
    }, [handleRefresh, user])
  );

  useEffect(() => {
    if (!user?.id) return;

    const subscription = FeedApi.subscribeToFeedActivities((activity) => {
      setFeedActivities(prev => {
        if (prev.some(existing => existing.id === activity.id)) return prev;
        return [activity, ...prev].slice(0, 20);
      });
      void fetchFeedActivities();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchFeedActivities, user?.id]);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadNotifications(count || 0);
    } catch (e) {
      // Table may not exist in older schemas - ignore
    }
  };

  // Get primary squad (most recently active or first one)
  const primarySquad = squads.length > 0 ? squads[0] : null;
  const otherSquads = squads.slice(1);

  const renderFeedItem = useCallback(({ item }: { item: FeedActivity }) => {
    const sport = item.activity_data.sport;
    const sportConfig = sport ? SPORT_TEMPLATES[sport] : null;
    const userName = item.user?.full_name || 'Unknown User';
    const userInitials = userName.split(' ').map(n => n[0]).join('');
    const activityText = formatActivityText(item);
    const activityDetails = formatActivityDetails(item);
    const location = item.activity_data.location || item.activity_data.facility_name;
    const timeAgo = getTimeAgo(item.created_at);
    
    return (
      <View style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: sportConfig?.color || '#6366f1' }]}>
              {item.user?.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{userInitials}</Text>
              )}
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.activityText}>{activityText}</Text>
            </View>
          </View>
          <Text style={styles.timestamp}>{timeAgo}</Text>
        </View>

        {activityDetails && (
          <View style={[styles.activityCard, { backgroundColor: theme.colors.bg }]}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityDetails}>{activityDetails}</Text>
              {item.activity_type === 'game_completed' && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>COMPLETED</Text>
                </View>
              )}
            </View>
            {location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                  {location}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.feedActions}>
          <View style={styles.reactionsRow}>
            {FEED_REACTIONS.map((emoji) => (
              <TouchableOpacity 
                key={emoji} 
                style={styles.reactionChip}
                onPress={() => Haptics.selectionAsync()}
              >
                <Text style={styles.reactionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <Ionicons 
              name={item.is_liked ? "heart" : "heart-outline"} 
              size={20} 
              color={item.is_liked ? "#EF4444" : theme.colors.textSecondary} 
            />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
              {item.likes_count}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => openComments(item)}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
              {item.comments_count}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleLike, openComments, theme.colors.bg, theme.colors.textSecondary]);

  const renderSquadItem = ({ item }: { item: Squad }) => {
    const sportConfig = SPORT_TEMPLATES[item.sport_code];
    const isOwner = item.user_role === 'owner';
    const lastActivity = getTimeAgo(item.updated_at);
    
    return (
      <TouchableOpacity 
        style={[styles.squadCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          Haptics.selectionAsync();
          navigation.navigate('SquadDetail', { squadId: item.id });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.squadHeader}>
          <View style={styles.squadInfo}>
            <View style={[styles.squadIcon, { backgroundColor: sportConfig?.color + '20' || '#6366f120' }]}>
              <Text style={styles.squadEmoji}>{sportConfig?.icon || '🏀'}</Text>
            </View>
            <View style={styles.squadDetails}>
              <View style={styles.squadNameRow}>
                <Text style={[styles.squadName, { color: theme.colors.textPrimary }]}>
                  {item.name}
                </Text>
                {isOwner && (
                  <View style={styles.ownerBadge}>
                    <Ionicons name="star" size={10} color="#F59E0B" />
                  </View>
                )}
              </View>
              <Text style={[styles.squadMeta, { color: theme.colors.textSecondary }]}>
                {item.member_count || 1} members • {lastActivity}
              </Text>
            </View>
          </View>
          <View style={styles.squadActions}>
            {item.unread_count && item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Primary squad hero card
  const renderPrimarySquadCard = () => {
    if (!primarySquad) return null;
    
    const sportConfig = SPORT_TEMPLATES[primarySquad.sport_code];
    const isOwner = primarySquad.user_role === 'owner';
    
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => {
          Haptics.selectionAsync();
          navigation.navigate('SquadDetail', { squadId: primarySquad.id });
        }}
      >
        <LinearGradient
          colors={theme.gradient.colors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primarySquadCard}
        >
          <View style={styles.primarySquadHeader}>
            <View style={styles.primarySquadBadge}>
              <Text style={styles.primarySquadBadgeText}>⭐ Primary Squad</Text>
            </View>
            {primarySquad.unread_count && primarySquad.unread_count > 0 && (
              <View style={styles.primaryUnreadBadge}>
                <Text style={styles.primaryUnreadText}>{primarySquad.unread_count} new</Text>
              </View>
            )}
          </View>
          
          <View style={styles.primarySquadContent}>
            <View style={styles.primarySquadIcon}>
              <Text style={styles.primarySquadEmoji}>{sportConfig?.icon || '🏀'}</Text>
            </View>
            <View style={styles.primarySquadInfo}>
              <Text style={styles.primarySquadName}>{primarySquad.name}</Text>
              <Text style={styles.primarySquadStats}>
                {primarySquad.member_count || 1} members
                {isOwner && ` • You're the owner`}
              </Text>
            </View>
          </View>
          
          <View style={styles.primarySquadActions}>
            <TouchableOpacity 
              style={styles.primaryActionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('ChatScreen', { type: 'squad', id: primarySquad.id, name: primarySquad.name });
              }}
            >
              <Ionicons name="chatbubbles" size={18} color="white" />
              <Text style={styles.primaryActionText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.primaryActionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('SquadDetail', { squadId: primarySquad.id });
              }}
            >
              <Ionicons name="people" size={18} color="white" />
              <Text style={styles.primaryActionText}>Members</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.primaryActionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('Coming Soon', 'Squad challenges will be available soon!');
              }}
            >
              <Ionicons name="flash" size={18} color="white" />
              <Text style={styles.primaryActionText}>Challenge</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Quick actions for squads
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <TouchableOpacity 
        style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('CreateSquad');
        }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: `${theme.colors.success}26` }]}>
          <Ionicons name="add-circle" size={24} color={theme.colors.success} />
        </View>
        <Text style={[styles.quickActionText, { color: theme.colors.textPrimary }]}>
          Create Squad
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('Friends');
        }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: `${theme.colors.primary}26` }]}>
          <Ionicons name="person-add" size={24} color={theme.colors.primary} />
        </View>
        <Text style={[styles.quickActionText, { color: theme.colors.textPrimary }]}>
          Invite Friends
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          openFindSquads();
        }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: `${theme.colors.secondary}26` }]}>
          <Ionicons name="search" size={24} color={theme.colors.secondary} />
        </View>
        <Text style={[styles.quickActionText, { color: theme.colors.textPrimary }]}>
          Find Squads
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSquadsContent = () => {
    if (squadsLoading && squads.length === 0) {
      return <ListSkeleton count={4} type="squad" />;
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.squadsScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Quick Actions */}
        {renderQuickActions()}
        
        {squads.length > 0 ? (
          <>
            {/* Primary Squad Card */}
            {renderPrimarySquadCard()}
            
            {/* Other Squads */}
            {otherSquads.length > 0 && (
              <View style={styles.otherSquadsSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                  OTHER SQUADS
                </Text>
                {otherSquads.map((squad) => (
                  <View key={squad.id}>
                    {renderSquadItem({ item: squad })}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : squadsError ? (
          <View style={styles.emptyStateContainer}>
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load squads"
              subtitle={squadsError}
              actionText="Try Again"
              onAction={handleRefresh}
              variant="error"
            />
          </View>
        ) : (
          <View style={styles.emptyStateContainer}>
            <EmptyState
              emoji="👥"
              title="No Squads Yet"
              subtitle="Create your first squad to start playing with friends and track your team's progress!"
              actionText="Create Your First Squad"
              onAction={() => navigation.navigate('CreateSquad')}
              variant="squads"
            />
          </View>
        )}
      </ScrollView>
    );
  };

  const renderFeedContent = () => {
    if (feedLoading && feedActivities.length === 0) {
      return <ListSkeleton count={3} type="feed" />;
    }

    return (
      <FlatList
        data={feedActivities}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedList}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={() =>
          feedError ? (
            <View style={styles.emptyStateContainer}>
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load feed"
                subtitle={feedError}
                actionText="Try Again"
                onAction={handleRefresh}
                variant="error"
              />
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <EmptyState
                icon="flash-outline"
                title="No Activity Yet"
                subtitle="Join squads and play games to see activity from your teammates!"
                variant="default"
              />
            </View>
          )
        }
      />
    );
  };

  const renderFriendsContent = () => {
    if (friendsLoading && friends.length === 0) {
      return <ListSkeleton count={4} type="friend" />;
    }

    if (friendsError) {
      return (
        <ScrollView
          style={styles.friendsScrollView}
          contentContainerStyle={styles.friendsScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyStateContainer}>
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load friends"
              subtitle={friendsError}
              actionText="Try Again"
              onAction={fetchFriends}
              variant="error"
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.friendsScrollView}
        contentContainerStyle={styles.friendsScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <View style={styles.friendSection}>
            <Text style={[styles.friendSectionTitle, { color: theme.colors.textPrimary }]}>
              Friend Requests ({friendRequests.length})
            </Text>
            {friendRequests.map(request => (
              <View key={request.id} style={[styles.friendCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>
                    {(request.from_user?.full_name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={[styles.friendName, { color: theme.colors.textPrimary }]}>
                    {request.from_user?.full_name || 'Unknown'}
                  </Text>
                  <Text style={[styles.friendMeta, { color: theme.colors.textSecondary }]}>
                    Wants to be your friend
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.acceptButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleAcceptRequest(request.id)}
                  >
                    <Ionicons name="checkmark" size={18} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineButton, { borderColor: theme.colors.border }]}
                    onPress={() => handleDeclineRequest(request.id)}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Search for Friends */}
        <View style={styles.friendSection}>
          <Text style={[styles.friendSectionTitle, { color: theme.colors.textPrimary }]}>
            Find Friends
          </Text>
          <View style={styles.friendSearchRow}>
            <TextInput
              style={[styles.friendSearchInput, { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
              placeholder="Search by name..."
              placeholderTextColor={theme.colors.textMuted}
              value={friendSearchQuery}
              onChangeText={setFriendSearchQuery}
              onSubmitEditing={handleSearchFriends}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.friendSearchButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSearchFriends}
              disabled={searchingFriends}
            >
              {searchingFriends ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="search" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {friendSearchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              {friendSearchResults.map(user => (
                <View key={user.id} style={[styles.friendCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {(user.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: theme.colors.textPrimary }]}>
                      {user.full_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.friendMeta, { color: theme.colors.textSecondary }]}>
                      {(user.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addFriendButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleSendFriendRequest(user.id)}
                  >
                    <Ionicons name="person-add" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* My Friends List */}
        <View style={styles.friendSection}>
          <Text style={[styles.friendSectionTitle, { color: theme.colors.textPrimary }]}>
            My Friends ({friends.length})
          </Text>
          
          {friends.length === 0 ? (
            <View style={styles.emptyFriendsContainer}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyFriendsText, { color: theme.colors.textSecondary }]}>
                No friends yet
              </Text>
              <Text style={[styles.emptyFriendsSubtext, { color: theme.colors.textMuted }]}>
                Search for friends above or share your QR code!
              </Text>
            </View>
          ) : (
            friends.map(friend => (
              <TouchableOpacity 
                key={friend.id} 
                style={[styles.friendCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  // Could navigate to friend profile or start DM
                }}
              >
                <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.friendAvatarText}>
                    {(friend.full_name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={[styles.friendName, { color: theme.colors.textPrimary }]}>
                    {friend.full_name || 'Unknown'}
                  </Text>
                  <Text style={[styles.friendMeta, { color: theme.colors.textSecondary }]}>
                    {(friend.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Scan QR Code Section */}
        <View style={styles.friendSection}>
          <Text style={[styles.friendSectionTitle, { color: theme.colors.textPrimary }]}>
            Scan to Add
          </Text>
          <TouchableOpacity
            style={[styles.qrCodeCard, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('QRScanner', { type: 'friend' });
            }}
          >
            <Ionicons name="scan" size={24} color="white" />
            <Text style={[styles.qrCodeText, { color: 'white' }]}>
              Scan Friend's QR Code
            </Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* QR Code Section */}
        <View style={styles.friendSection}>
          <Text style={[styles.friendSectionTitle, { color: theme.colors.textPrimary }]}>
            Share Your Profile
          </Text>
          <TouchableOpacity
            style={[styles.qrCodeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowQRCode(!showQRCode)}
          >
            <Ionicons name="qr-code" size={24} color={theme.colors.primary} />
            <Text style={[styles.qrCodeText, { color: theme.colors.textPrimary }]}>
              {showQRCode ? 'Hide QR Code' : 'Show My QR Code'}
            </Text>
            <Ionicons name={showQRCode ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          
          {showQRCode && user && (
            <View style={styles.qrCodeContainer}>
              <QRCodeGenerator type="profile" />
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const tabIndicatorTranslateX = tabIndicatorPosition.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, (SCREEN_WIDTH - 32) / 3, ((SCREEN_WIDTH - 32) / 3) * 2],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Gradient Hero Header */}
      <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTitleContainer}>
            <Text style={styles.heroTitle}>Squads</Text>
            <Text style={styles.heroFlame}>🔥</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity 
              style={styles.heroActionButton}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('Friends');
              }}
            >
              <Ionicons name="person-add" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.heroActionButton}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('Notifications');
              }}
            >
              <Ionicons name="notifications" size={20} color="white" />
              {unreadNotifications > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.heroSubtitle}>
          {squads.length > 0 
            ? `${squads.length} squad${squads.length > 1 ? 's' : ''} • Dominate together!`
            : 'Create or join a squad to start playing!'}
        </Text>
      </LinearGradient>

      <SafeAreaView style={[styles.safeAreaContent, { backgroundColor: theme.colors.bg }]}>
        {/* Simplified 2-Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.colors.surface }]}>
          <Animated.View 
            style={[
              styles.tabIndicator,
              { 
                backgroundColor: theme.colors.primary + '15',
                transform: [{ translateX: tabIndicatorTranslateX }],
              }
            ]} 
          />
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => switchTab('feed')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="flash" 
              size={18} 
              color={activeTab === 'feed' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'feed' ? theme.colors.primary : theme.colors.textSecondary },
            ]}>
              Activity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => switchTab('squads')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="people" 
              size={18} 
              color={activeTab === 'squads' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'squads' ? theme.colors.primary : theme.colors.textSecondary },
            ]}>
              Squads
            </Text>
            {squads.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.tabBadgeText}>{squads.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => switchTab('friends')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="person-add" 
              size={18} 
              color={activeTab === 'friends' ? theme.colors.primary : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'friends' ? theme.colors.primary : theme.colors.textSecondary },
            ]}>
              Friends
            </Text>
            {(friends.length > 0 || friendRequests.length > 0) && (
              <View style={[styles.tabBadge, { backgroundColor: friendRequests.length > 0 ? theme.colors.danger : theme.colors.primary }]}>
                <Text style={styles.tabBadgeText}>{friendRequests.length > 0 ? friendRequests.length : friends.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={[styles.content, { backgroundColor: theme.colors.bg }]}>
          {activeTab === 'feed' ? renderFeedContent() : activeTab === 'squads' ? renderSquadsContent() : renderFriendsContent()}
        </View>

        {/* Comments Sheet */}
        {commentsVisible && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            style={[styles.commentsSheet, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: theme.colors.textPrimary }]}>
                Comments
              </Text>
              <TouchableOpacity onPress={() => setCommentsVisible(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.commentsList}>
              {commentsLoading ? (
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  Loading…
                </Text>
              ) : commentsError ? (
                <View style={styles.commentsErrorWrap}>
                  <Text style={[styles.commentsErrorText, { color: theme.colors.danger }]}>
                    {commentsError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => activeActivity && openComments(activeActivity)}
                    style={styles.commentsRetryButton}
                  >
                    <Text style={[styles.commentsRetryText, { color: theme.colors.primary }]}>
                      Try again
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : comments.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No comments yet
                </Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentItem}>
                    <Text style={[styles.commentAuthor, { color: theme.colors.textPrimary }]}>
                      {c.user?.full_name || 'User'}
                    </Text>
                    <Text style={[styles.commentContent, { color: theme.colors.textSecondary }]}>
                      {c.content}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={[styles.commentInputRow, { borderTopColor: theme.colors.border }]}>
              <TextInput
                ref={commentInputRef}
                style={[styles.commentInput, { 
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary,
                }]}
                placeholder="Add a comment…"
                placeholderTextColor={theme.colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={() => {
                  if (commentText.trim()) {
                    addComment(commentText.trim());
                    setCommentText('');
                  }
                }}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={() => {
                  if (commentText.trim()) {
                    addComment(commentText.trim());
                    setCommentText('');
                  }
                }}
                style={styles.commentSendButton}
              >
                <Ionicons name="send" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Find Squads Modal */}
        {findSquadsVisible && (
          <View style={styles.findSquadsOverlay}>
            <View style={[styles.findSquadsModal, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.findSquadsHeader}>
                <Text style={[styles.findSquadsTitle, { color: theme.colors.textPrimary }]}>
                  Find Squads
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setFindSquadsVisible(false);
                    setDiscoverError(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.findSquadsSearch, { backgroundColor: theme.colors.bg }]}>
                <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                <TextInput
                  style={[styles.findSquadsSearchInput, { color: theme.colors.textPrimary }]}
                  placeholder="Search by name..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    searchSquads(text);
                  }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); fetchDiscoverableSquads(); }}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView 
                style={styles.findSquadsList}
                showsVerticalScrollIndicator={false}
              >
                {discoverLoading ? (
                  <View style={styles.findSquadsLoading}>
                    <Text style={[styles.findSquadsLoadingText, { color: theme.colors.textSecondary }]}>
                      Loading squads...
                    </Text>
                  </View>
                ) : discoverError ? (
                  <View style={styles.findSquadsEmpty}>
                    <EmptyState
                      compact
                      icon="cloud-offline-outline"
                      title="Couldn't load squads"
                      subtitle={discoverError}
                      actionText="Try Again"
                      onAction={() =>
                        searchQuery.length >= 2 ? searchSquads(searchQuery) : fetchDiscoverableSquads()
                      }
                      variant="error"
                    />
                  </View>
                ) : discoverableSquads.length === 0 ? (
                  <View style={styles.findSquadsEmpty}>
                    <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
                    <Text style={[styles.findSquadsEmptyTitle, { color: theme.colors.textPrimary }]}>
                      {searchQuery ? 'No squads found' : 'No public squads yet'}
                    </Text>
                    <Text style={[styles.findSquadsEmptyText, { color: theme.colors.textSecondary }]}>
                      {searchQuery 
                        ? 'Try a different search term' 
                        : 'Be the first to create a public squad!'}
                    </Text>
                  </View>
                ) : (
                  discoverableSquads.map((squad) => {
                    const sportConfig = SPORT_TEMPLATES[squad.sport_code];
                    const isJoining = joiningSquadId === squad.id;
                    
                    return (
                      <View 
                        key={squad.id} 
                        style={[styles.findSquadCard, { backgroundColor: theme.colors.bg }]}
                      >
                        <View style={styles.findSquadInfo}>
                          <View style={[styles.findSquadIcon, { backgroundColor: sportConfig?.color + '20' }]}>
                            <Text style={styles.findSquadEmoji}>{sportConfig?.icon || '🏀'}</Text>
                          </View>
                          <View style={styles.findSquadDetails}>
                            <Text style={[styles.findSquadName, { color: theme.colors.textPrimary }]}>
                              {squad.name}
                            </Text>
                            <Text style={[styles.findSquadMeta, { color: theme.colors.textSecondary }]}>
                              {sportConfig?.name || squad.sport_code} • {squad.member_count || 0}/{squad.max_members || 12} members
                            </Text>
                            {squad.description && (
                              <Text 
                                style={[styles.findSquadDesc, { color: theme.colors.textSecondary }]}
                                numberOfLines={2}
                              >
                                {squad.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.joinSquadButton,
                            { backgroundColor: theme.colors.primary },
                            isJoining && { opacity: 0.7 }
                          ]}
                          onPress={() => handleJoinSquad(squad.id, squad.name)}
                          disabled={isJoining}
                        >
                          {isJoining ? (
                            <Text style={styles.joinSquadButtonText}>Joining...</Text>
                          ) : (
                            <>
                              <Ionicons name="add" size={16} color="white" />
                              <Text style={styles.joinSquadButtonText}>Join</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// Utility function to format time ago
const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero Header
  hero: {
    paddingTop: 70,
    paddingBottom: DesignTokens.space['2xl'],
    paddingHorizontal: DesignTokens.space.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.space.sm,
  },
  heroTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  heroTitle: {
    ...createTextStyle('3xl', 'extrabold'),
    color: 'white',
  },
  heroFlame: {
    fontSize: 24,
  },
  heroActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.md,
  },
  heroActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  heroSubtitle: {
    ...createTextStyle('base', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },

  safeAreaContent: {
    flex: 1,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: DesignTokens.space.lg,
    marginTop: DesignTokens.space.md,
    marginBottom: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.xl,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '33.33%',
    height: '100%',
    borderRadius: DesignTokens.radius.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.space.xs,
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    zIndex: 1,
  },
  tabText: {
    ...createTextStyle('sm', 'semibold'),
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: 'white',
    ...createTextStyle('xs', 'bold'),
  },

  content: {
    flex: 1,
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
    gap: DesignTokens.space.md,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    ...DesignTokens.shadow.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.space.xs,
  },
  quickActionText: {
    ...createTextStyle('xs', 'semibold'),
    textAlign: 'center',
  },

  // Primary Squad Card
  primarySquadCard: {
    marginHorizontal: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.xl,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.lg,
  },
  primarySquadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.space.md,
  },
  primarySquadBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.xs,
    borderRadius: DesignTokens.radius.lg,
  },
  primarySquadBadgeText: {
    color: 'white',
    ...createTextStyle('xs', 'bold'),
  },
  primaryUnreadBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: 2,
    borderRadius: DesignTokens.radius.md,
  },
  primaryUnreadText: {
    color: 'white',
    ...createTextStyle('xs', 'bold'),
  },
  primarySquadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    marginBottom: DesignTokens.space.lg,
  },
  primarySquadIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySquadEmoji: {
    fontSize: 28,
  },
  primarySquadInfo: {
    flex: 1,
  },
  primarySquadName: {
    color: 'white',
    ...createTextStyle('xl', 'bold'),
    marginBottom: 2,
  },
  primarySquadStats: {
    color: 'rgba(255,255,255,0.8)',
    ...createTextStyle('sm', 'medium'),
  },
  primarySquadActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.space.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.md,
  },
  primaryActionText: {
    color: 'white',
    ...createTextStyle('sm', 'semibold'),
  },

  // Other Squads Section
  squadsScrollContent: {
    paddingBottom: 100,
  },
  otherSquadsSection: {
    paddingHorizontal: DesignTokens.space.lg,
  },
  sectionLabel: {
    ...createTextStyle('xs', 'bold'),
    letterSpacing: 1,
    marginBottom: DesignTokens.space.md,
    marginTop: DesignTokens.space.sm,
  },

  // Squad Card
  squadCard: {
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.md,
    ...DesignTokens.shadow.sm,
  },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    flex: 1,
  },
  squadIcon: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squadEmoji: {
    fontSize: 24,
  },
  squadDetails: {
    flex: 1,
  },
  squadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
  },
  squadName: {
    ...createTextStyle('base', 'bold'),
  },
  ownerBadge: {
    backgroundColor: '#FEF3C7',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squadMeta: {
    ...createTextStyle('sm', 'regular'),
    marginTop: 2,
  },
  squadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.sm,
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DesignTokens.space.xs,
  },
  unreadText: {
    color: 'white',
    ...createTextStyle('xs', 'bold'),
  },

  // Empty State
  emptyStateContainer: {
    paddingHorizontal: DesignTokens.space.lg,
    paddingTop: DesignTokens.space.xl,
  },

  // Feed Styles
  feedList: {
    padding: DesignTokens.space.lg,
  },
  feedCard: {
    backgroundColor: 'white',
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.lg,
    ...DesignTokens.shadow.md,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: DesignTokens.space.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    ...createTextStyle('sm', 'bold'),
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...createTextStyle('base', 'bold'),
    color: '#111827',
  },
  activityText: {
    ...createTextStyle('sm', 'regular'),
    color: '#6B7280',
    marginTop: 2,
  },
  timestamp: {
    ...createTextStyle('xs', 'medium'),
    color: '#9CA3AF',
    marginLeft: DesignTokens.space.md,
  },
  activityCard: {
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.space.md,
    marginBottom: DesignTokens.space.md,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.space.sm,
  },
  activityDetails: {
    ...createTextStyle('sm', 'medium'),
    color: '#374151',
    flex: 1,
  },
  completedBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: 2,
    borderRadius: DesignTokens.radius.sm,
  },
  completedText: {
    ...createTextStyle('xs', 'bold'),
    color: 'white',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
  },
  locationText: {
    ...createTextStyle('sm', 'regular'),
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
  },
  actionText: {
    ...createTextStyle('sm', 'medium'),
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
    marginRight: DesignTokens.space.sm,
  },
  reactionChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: DesignTokens.radius.lg,
    paddingHorizontal: DesignTokens.space.sm,
    paddingVertical: DesignTokens.space.xs,
  },
  reactionText: {
    fontSize: 14,
  },

  // Empty States
  emptyText: {
    ...createTextStyle('base', 'medium'),
    textAlign: 'center',
    padding: DesignTokens.space.xl,
  },
  commentsErrorWrap: {
    padding: DesignTokens.space.lg,
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  commentsErrorText: {
    ...createTextStyle('sm', 'medium'),
    textAlign: 'center',
  },
  commentsRetryButton: {
    paddingVertical: DesignTokens.space.sm,
  },
  commentsRetryText: {
    ...createTextStyle('sm', 'semibold'),
  },

  // Comments Sheet
  commentsSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: DesignTokens.radius.xl,
    borderTopRightRadius: DesignTokens.radius.xl,
    maxHeight: '60%',
    ...DesignTokens.shadow.xl,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  commentsTitle: {
    ...createTextStyle('lg', 'bold'),
  },
  commentsList: {
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
  },
  commentItem: {
    paddingVertical: DesignTokens.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commentAuthor: {
    ...createTextStyle('sm', 'bold'),
  },
  commentContent: {
    ...createTextStyle('base', 'regular'),
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderTopWidth: 1,
    gap: DesignTokens.space.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.xl,
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
    ...createTextStyle('base', 'regular'),
  },
  commentSendButton: {
    padding: DesignTokens.space.sm,
  },

  // Find Squads Modal
  findSquadsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  findSquadsModal: {
    borderTopLeftRadius: DesignTokens.radius.xl,
    borderTopRightRadius: DesignTokens.radius.xl,
    maxHeight: '80%',
    minHeight: '50%',
  },
  findSquadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DesignTokens.space.xl,
    paddingVertical: DesignTokens.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  findSquadsTitle: {
    ...createTextStyle('xl', 'bold'),
  },
  findSquadsSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: DesignTokens.space.lg,
    marginVertical: DesignTokens.space.md,
    paddingHorizontal: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    gap: DesignTokens.space.sm,
  },
  findSquadsSearchInput: {
    flex: 1,
    paddingVertical: DesignTokens.space.md,
    ...createTextStyle('base', 'regular'),
  },
  findSquadsList: {
    flex: 1,
    paddingHorizontal: DesignTokens.space.lg,
  },
  findSquadsLoading: {
    alignItems: 'center',
    paddingVertical: DesignTokens.space['2xl'],
  },
  findSquadsLoadingText: {
    ...createTextStyle('base', 'medium'),
  },
  findSquadsEmpty: {
    alignItems: 'center',
    paddingVertical: DesignTokens.space['3xl'],
    paddingHorizontal: DesignTokens.space.xl,
  },
  findSquadsEmptyTitle: {
    ...createTextStyle('lg', 'semibold'),
    marginTop: DesignTokens.space.md,
  },
  findSquadsEmptyText: {
    ...createTextStyle('base', 'regular'),
    textAlign: 'center',
    marginTop: DesignTokens.space.sm,
  },
  findSquadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    marginBottom: DesignTokens.space.md,
  },
  findSquadInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DesignTokens.space.md,
  },
  findSquadIcon: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findSquadEmoji: {
    fontSize: 24,
  },
  findSquadDetails: {
    flex: 1,
  },
  findSquadName: {
    ...createTextStyle('base', 'bold'),
    marginBottom: 2,
  },
  findSquadMeta: {
    ...createTextStyle('sm', 'regular'),
  },
  findSquadDesc: {
    ...createTextStyle('sm', 'regular'),
    marginTop: DesignTokens.space.xs,
  },
  joinSquadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.xs,
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.md,
  },
  joinSquadButtonText: {
    color: 'white',
    ...createTextStyle('sm', 'semibold'),
  },

  // Friends Tab Styles
  friendsScrollView: {
    flex: 1,
  },
  friendsScrollContent: {
    padding: DesignTokens.space.lg,
  },
  friendSection: {
    marginBottom: DesignTokens.space.xl,
  },
  friendSectionTitle: {
    ...createTextStyle('lg', 'bold'),
    marginBottom: DesignTokens.space.md,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    marginBottom: DesignTokens.space.sm,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: DesignTokens.space.md,
  },
  friendAvatarText: {
    color: 'white',
    ...createTextStyle('base', 'bold'),
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    ...createTextStyle('base', 'semibold'),
    marginBottom: 2,
  },
  friendMeta: {
    ...createTextStyle('sm', 'regular'),
  },
  requestActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addFriendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendSearchRow: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
  },
  friendSearchInput: {
    flex: 1,
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    ...createTextStyle('base', 'regular'),
  },
  friendSearchButton: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultsContainer: {
    marginTop: DesignTokens.space.md,
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    paddingVertical: DesignTokens.space['2xl'],
  },
  emptyFriendsText: {
    ...createTextStyle('base', 'semibold'),
    marginTop: DesignTokens.space.md,
  },
  emptyFriendsSubtext: {
    ...createTextStyle('sm', 'regular'),
    textAlign: 'center',
    marginTop: DesignTokens.space.xs,
  },
  qrCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    gap: DesignTokens.space.md,
  },
  qrCodeText: {
    flex: 1,
    ...createTextStyle('base', 'medium'),
  },
  qrCodeContainer: {
    marginTop: DesignTokens.space.md,
    alignItems: 'center',
  },
});
