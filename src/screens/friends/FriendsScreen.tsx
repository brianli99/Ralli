import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { FriendRequest, FriendWithStatus } from '../../types/squad.types';
import { FriendshipApi } from '../../services/squadApi';
import QRCodeGenerator from '../../components/QRCodeGenerator';
import { useTheme } from '../../theme/theme';
import { Button, Input } from '../../components/ui';

type FriendsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function FriendsScreen() {
  const navigation = useNavigation<FriendsNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'discover'>('friends');
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) loadFriendsData();
    }, [user])
  );

  const loadFriendsData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // Fetch real friends and requests from the API
      const [friendsResponse, requestsResponse] = await Promise.all([
        FriendshipApi.getFriends(),
        FriendshipApi.getFriendRequests(),
      ]);

      if (friendsResponse.data) {
        setFriends(friendsResponse.data);
      }

      if (requestsResponse.data) {
        setFriendRequests(requestsResponse.data);
      }
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFriendsData();
  };

  const handleFriendAction = (friend: FriendWithStatus, action: 'remove' | 'block') => {
    const actionText = action === 'remove' ? 'remove' : 'block';
    const actionPast = action === 'remove' ? 'removed' : 'blocked';
    
    Alert.alert(
      `${action === 'remove' ? 'Remove' : 'Block'} Friend`,
      `Are you sure you want to ${actionText} ${friend.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action === 'remove' ? 'Remove' : 'Block', 
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            
            const { error } = action === 'block'
              ? await FriendshipApi.blockUser(friend.id)
              : await FriendshipApi.removeFriend(friend.id);
            if (error) {
              Alert.alert('Error', `Failed to ${actionText} friend`);
              return;
            }
            
            setFriends(prev => prev.filter(f => f.id !== friend.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', `${friend.full_name} has been ${actionPast}`);
          }
        }
      ]
    );
  };

  const handleFriendRequest = async (request: FriendRequest, action: 'accept' | 'decline') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (action === 'accept') {
      const { error } = await FriendshipApi.acceptFriendRequest(request.id);
      if (error) {
        Alert.alert('Error', 'Failed to accept friend request');
        return;
      }
      
      // Add to friends list
      const newFriend: FriendWithStatus = {
        ...request.sender,
        status: 'friend',
        friendship_id: request.id,
      };
      setFriends(prev => [...prev, newFriend]);
      setFriendRequests(prev => prev.filter(r => r.id !== request.id));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Friend Added!', `${request.sender.full_name} is now your friend`);
    } else {
      const { error } = await FriendshipApi.declineFriendRequest(request.id);
      if (error) {
        Alert.alert('Error', 'Failed to decline friend request');
        return;
      }
      
      setFriendRequests(prev => prev.filter(r => r.id !== request.id));
      Alert.alert('Request Declined', `Friend request from ${request.sender.full_name} declined`);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a name to search');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);
    
    try {
      const { data, error } = await FriendshipApi.searchUsers(searchQuery.trim());
      
      if (error) {
        Alert.alert('Error', 'Failed to search users');
        return;
      }
      
      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        Alert.alert('No Results', `No users found matching "${searchQuery}"`);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (userId: string, userName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const { data, error } = await FriendshipApi.sendFriendRequest(userId);
    
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Request Sent!', `Friend request sent to ${userName}`);
    
    // Remove from search results
    setSearchResults(prev => prev.filter(u => u.id !== userId));
  };

  const handleScanQR = () => {
    navigation.navigate('QRScanner', { type: 'friend' });
  };

  const renderFriendsList = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {loading && friends.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
          <Text style={styles.emptyStateText}>
            Start building your network by discovering new friends or accepting requests!
          </Text>
        </View>
      ) : (
        friends.map((friend) => (
          <View key={friend.id} style={styles.friendCard}>
            <View style={styles.friendAvatar}>
              {friend.avatar_url ? (
                <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatarImage} />
              ) : (
                <Text style={styles.friendAvatarText}>
                  {friend.full_name?.charAt(0) || '?'}
                </Text>
              )}
            </View>
            
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friend.full_name || 'Unknown'}</Text>
              <Text style={styles.friendUsername}>
                {(friend.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
              </Text>
              <Text style={styles.friendSports}>
                {(friend.preferred_sports || []).slice(0, 2).join(', ')}
              </Text>
            </View>
            
            <View style={styles.friendActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('ChatScreen', {
                  type: 'direct',
                  id: friend.id,
                  name: friend.full_name || friend.username || 'Friend',
                })}
              >
                <Ionicons name="chatbubble" size={20} color="#1a73e8" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert(
                    'Friend Actions',
                    `What would you like to do with ${friend.full_name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove Friend', style: 'destructive', onPress: () => handleFriendAction(friend, 'remove') },
                      { text: 'Block User', style: 'destructive', onPress: () => handleFriendAction(friend, 'block') }
                    ]
                  );
                }}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderRequestsList = () => (
    <View style={styles.tabContent}>
      {friendRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Pending Requests</Text>
          <Text style={styles.emptyStateText}>
            When someone sends you a friend request, it will appear here.
          </Text>
        </View>
      ) : (
        friendRequests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <View style={styles.friendAvatar}>
              {request.sender.avatar_url ? (
                <Image source={{ uri: request.sender.avatar_url }} style={styles.friendAvatarImage} />
              ) : (
                <Text style={styles.friendAvatarText}>
                  {request.sender.full_name?.charAt(0) || '?'}
                </Text>
              )}
            </View>
            
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{request.sender.full_name || 'Unknown'}</Text>
              <Text style={styles.friendUsername}>
                {(request.sender.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
              </Text>
              <Text style={styles.requestDate}>
                {new Date(request.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleFriendRequest(request, 'accept')}
              >
                <Ionicons name="checkmark" size={20} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleFriendRequest(request, 'decline')}
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderDiscoverTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.discoverSection}>
        <Text style={styles.sectionTitle}>Find Friends</Text>
        <Text style={styles.sectionSubtitle}>
          Search for users by name
        </Text>
        
        <View style={styles.searchContainer}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Enter a name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon="search"
            />
          </View>
          <View>
            <Button 
              title={searching ? "..." : "Search"} 
              onPress={handleSearchUsers} 
              disabled={searching}
            />
          </View>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            <Text style={styles.searchResultsTitle}>
              Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
            </Text>
            {searchResults.map((searchUser) => (
              <View key={searchUser.id} style={styles.searchResultCard}>
                <View style={styles.friendAvatar}>
                  {searchUser.avatar_url ? (
                    <Image source={{ uri: searchUser.avatar_url }} style={styles.friendAvatarImage} />
                  ) : (
                    <Text style={styles.friendAvatarText}>
                      {searchUser.full_name?.charAt(0) || '?'}
                    </Text>
                  )}
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{searchUser.full_name}</Text>
                  <Text style={styles.friendUsername}>
                    {(searchUser.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addFriendButton}
                  onPress={() => handleSendFriendRequest(searchUser.id, searchUser.full_name)}
                >
                  <Ionicons name="person-add" size={18} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.discoverSection}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <TouchableOpacity
          style={styles.qrButton}
          onPress={handleScanQR}
        >
          <Ionicons name="qr-code" size={32} color="#1a73e8" />
          <Text style={styles.qrButtonText}>Scan QR Code</Text>
          <Text style={styles.qrButtonSubtext}>
            Scan a friend's QR code to add them instantly
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.discoverSection}>
        <Text style={styles.sectionTitle}>My QR Code</Text>
        <Text style={styles.sectionSubtitle}>
          Share this with friends so they can add you
        </Text>
        <QRCodeGenerator />
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Friends</Text>
        
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, { color: theme.colors.textSecondary }, activeTab === 'friends' && { color: theme.colors.primary }]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, { color: theme.colors.textSecondary }, activeTab === 'requests' && { color: theme.colors.primary }]}>
            Requests ({friendRequests.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'discover' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, { color: theme.colors.textSecondary }, activeTab === 'discover' && { color: theme.colors.primary }]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'friends' && renderFriendsList()}
      {activeTab === 'requests' && renderRequestsList()}
      {activeTab === 'discover' && renderDiscoverTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginBottom: 16,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#1a73e8',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  friendSports: {
    fontSize: 12,
    color: '#999',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#f44336',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discoverSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  qrButton: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a73e8',
    marginTop: 12,
    marginBottom: 4,
  },
  qrButtonSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  searchResults: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 16,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addFriendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
