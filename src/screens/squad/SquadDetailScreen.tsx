import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { SPORT_TEMPLATES } from '../../constants/sportTemplates';
import { Squad, SquadMember, SquadRole, SquadWithMembers } from '../../types/squad.types';
import { SquadApi, FriendshipApi } from '../../services/squadApi';
import { RouteProp } from '@react-navigation/native';
import { useTheme, type ThemeContextValue } from '../../theme/theme';
import { EmptyState } from '../../components/ui';

type SquadDetailNavigationProp = StackNavigationProp<RootStackParamList>;
type SquadDetailRouteProp = RouteProp<RootStackParamList, 'SquadDetail'>;

export default function SquadDetailScreen() {
  const navigation = useNavigation<SquadDetailNavigationProp>();
  const route = useRoute<SquadDetailRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  // Safely destructure params with fallback
  const squadId = route.params?.squadId;
  
  const [squad, setSquad] = useState<SquadWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Search users modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Edit squad modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState<'name' | 'description' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!squadId) {
        navigation.goBack();
        return;
      }
      let cancelled = false;
      loadSquadDetails(() => cancelled);
      return () => { cancelled = true; };
    }, [squadId])
  );

  const loadSquadDetails = async (isCancelled?: () => boolean) => {
    const hadSquadBefore = squad !== null;
    try {
      setLoadError(null);
      if (hadSquadBefore) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const { data, error } = await SquadApi.getSquadById(squadId!);
      
      if (isCancelled?.()) return;
      
      if (error) {
        console.error('Error loading squad:', error);
        const msg = typeof error === 'string' ? error : 'Failed to load squad details';
        if (!hadSquadBefore) {
          setLoadError(msg);
        } else {
          Alert.alert('Error', msg);
        }
        return;
      }
      
      if (data) {
        setSquad(data);
        setLoadError(null);
      } else if (!hadSquadBefore) {
        setLoadError('Squad not found');
      }
    } catch (error: any) {
      if (isCancelled?.()) return;
      console.error('Error loading squad details:', error);
      const msg = error?.message || 'Failed to load squad details';
      if (!hadSquadBefore) {
        setLoadError(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSquadDetails();
  };

  const handleAddMember = () => {
    Alert.alert(
      'Add Member',
      'How would you like to add a new member?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share Invite Link', onPress: () => handleShareInvite() },
        { text: 'Search Users', onPress: () => handleSearchUsers() }
      ]
    );
  };

  const handleShareInvite = async () => {
    if (!squad) return;
    
    try {
      Haptics.selectionAsync();
      const { data: inviteLink, error } = await SquadApi.generateInviteCode(squad.id);
      
      if (error || !inviteLink) {
        Alert.alert('Error', 'Failed to generate invite link');
        return;
      }

      const message = `Join my squad "${squad.name}" on Ralli!\n\n${inviteLink}\n\nOpen the link or scan the QR code to join the crew.`;
      
      const result = await Share.share({
        message,
        title: `Join ${squad.name}`,
      });

      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sharing invite:', error);
      Alert.alert('Error', 'Failed to share invite');
    }
  };

  const handleSearchUsers = () => {
    setShowSearchModal(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const performSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const { data, error } = await FriendshipApi.searchUsers(query);
      
      if (error) {
        console.error('Search error:', error);
        return;
      }

      // Filter out users already in the squad
      const squadMemberIds = squad?.members?.map(m => m.user_id) || [];
      const filteredResults = (data || []).filter(u => !squadMemberIds.includes(u.id));
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddUserToSquad = async (userId: string, userName: string) => {
    if (!squad) return;

    try {
      setActionLoading(true);
      Haptics.selectionAsync();
      
      const { error } = await SquadApi.addMember(squad.id, userId);
      
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `${userName} has been added to the squad!`);
      setShowSearchModal(false);
      loadSquadDetails();
    } catch (error) {
      console.error('Error adding user:', error);
      Alert.alert('Error', 'Failed to add user to squad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMemberAction = (member: SquadMember) => {
    const currentUserMember = squad?.members?.find(m => m.user_id === user?.id);
    const isCurrentUser = member.user_id === user?.id;
    
    if (isCurrentUser) {
      Alert.alert(
        'Leave Squad',
        'Are you sure you want to leave this squad? You can rejoin later if invited.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave Squad', style: 'destructive', onPress: () => handleLeaveSquad() }
        ]
      );
      return;
    }

    if (currentUserMember?.role === 'owner') {
      const roleAction = member.role === 'admin'
        ? { text: 'Make Member', onPress: () => handleChangeRole(member, 'member' as SquadRole) }
        : { text: 'Make Admin', onPress: () => handleChangeRole(member, 'admin' as SquadRole) };

      Alert.alert(`Manage ${member.user?.full_name || 'Member'}`, 'What would you like to do?', [
        { text: 'Cancel', style: 'cancel' },
        roleAction,
        { text: 'Remove from Squad', style: 'destructive', onPress: () => handleRemoveMember(member) },
      ]);
      return;
    }

    if (currentUserMember?.role === 'admin' && member.role === 'member') {
      Alert.alert(`Manage ${member.user?.full_name || 'Member'}`, 'What would you like to do?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove from Squad', style: 'destructive', onPress: () => handleRemoveMember(member) },
      ]);
    }
  };

  const handleChangeRole = async (member: SquadMember, newRole: SquadRole) => {
    if (!squad) return;

    try {
      setActionLoading(true);
      Haptics.selectionAsync();
      
      const { error } = await SquadApi.updateMemberRole(squad.id, member.id, newRole);
      
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `${member.user?.full_name} is now ${newRole === 'admin' ? 'an' : 'a'} ${newRole}`);
      loadSquadDetails();
    } catch (error) {
      console.error('Error changing role:', error);
      Alert.alert('Error', 'Failed to change member role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (member: SquadMember) => {
    if (!squad) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.full_name} from the squad?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const { error } = await SquadApi.removeMember(squad.id, member.id);
              
              if (error) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Error', error);
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', `${member.user?.full_name} has been removed from the squad`);
              loadSquadDetails();
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLeaveSquad = async () => {
    if (!squad) return;

    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const { error } = await SquadApi.leaveSquad(squad.id);
      
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'You have left the squad');
      navigation.goBack();
    } catch (error) {
      console.error('Error leaving squad:', error);
      Alert.alert('Error', 'Failed to leave squad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSquadField = (field: 'name' | 'description') => {
    if (!squad) return;
    setEditField(field);
    setEditValue(field === 'name' ? squad.name : squad.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!squad || !editField) return;

    try {
      setActionLoading(true);
      Haptics.selectionAsync();

      const updates = {
        name: editField === 'name' ? editValue.trim() : squad.name,
        description: editField === 'description' ? editValue.trim() : squad.description,
      };

      if (editField === 'name' && !updates.name) {
        Alert.alert('Error', 'Squad name cannot be empty');
        return;
      }

      const { error } = await SquadApi.updateSquad(squad.id, updates);

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      loadSquadDetails();
    } catch (error) {
      console.error('Error updating squad:', error);
      Alert.alert('Error', 'Failed to update squad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!squad) return;

    const newPrivacy = !squad.is_private;
    Alert.alert(
      newPrivacy ? 'Make Squad Private?' : 'Make Squad Public?',
      newPrivacy 
        ? 'Only invited members will be able to join.' 
        : 'Anyone can find and join this squad.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setActionLoading(true);
              const { error } = await SquadApi.updateSquad(squad.id, { is_private: newPrivacy });

              if (error) {
                Alert.alert('Error', error);
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadSquadDetails();
            } catch (error) {
              Alert.alert('Error', 'Failed to update privacy settings');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteSquad = () => {
    Alert.alert(
      'Delete Squad',
      'Are you sure you want to delete this squad? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const { error } = await SquadApi.deleteSquad(squad!.id);
            if (error) {
              Alert.alert('Error', 'Failed to delete squad');
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Squad has been deleted');
            navigation.goBack();
          }
        }
      ]
    );
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getRoleIcon = (role: SquadRole): keyof typeof Ionicons.glyphMap => {
    switch (role) {
      case 'owner':
        return 'star';
      case 'admin':
        return 'shield-checkmark';
      default:
        return 'person';
    }
  };

  const getRoleColor = (role: SquadRole) => {
    switch (role) {
      case 'owner':
        return theme.colors.warning;
      case 'admin':
        return theme.colors.primary;
      default:
        return theme.colors.textMuted;
    }
  };

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (loading && !squad) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Squad Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading squad details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError && !squad) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Squad Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load squad"
            subtitle={loadError}
            actionText="Try Again"
            onAction={() => loadSquadDetails()}
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!squad) {
    return null;
  }

  const sportConfig = SPORT_TEMPLATES[squad.sport_code as keyof typeof SPORT_TEMPLATES];
  const isOwner = squad.owner_id === user?.id;

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
        
        <Text style={styles.headerTitle}>Squad Details</Text>
        
        <TouchableOpacity 
          style={styles.chatButton}
          onPress={() => navigation.navigate('ChatScreen', {
            type: 'squad',
            id: squad.id,
            name: squad.name,
            sport: squad.sport_code
          })}
        >
          <Ionicons name="chatbubbles" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Squad Info */}
        <View style={styles.squadInfo}>
          <View style={styles.squadHeader}>
            <View style={styles.squadIcon}>
              <Text style={styles.squadIconText}>{sportConfig?.icon || '🏃'}</Text>
            </View>
            <View style={styles.squadDetails}>
              <Text style={styles.squadName}>{squad.name}</Text>
              <Text style={styles.squadSport}>{sportConfig?.name || squad.sport_code}</Text>
              <Text style={styles.memberCount}>
                {squad.members?.length || 1} member{(squad.members?.length || 1) !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          
          {squad.description && (
            <Text style={styles.squadDescription}>{squad.description}</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'members' && styles.activeTab]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
              Members
            </Text>
          </TouchableOpacity>
          
          {isOwner && (
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
              onPress={() => setActiveTab('settings')}
            >
              <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
                Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Content */}
        {activeTab === 'members' ? (
          <View style={styles.tabContent}>
            {/* Add Member Button */}
            <TouchableOpacity 
              style={styles.addMemberButton}
              onPress={handleAddMember}
            >
              <Ionicons name="person-add" size={20} color={theme.colors.primary} />
              <Text style={styles.addMemberText}>Add Member</Text>
            </TouchableOpacity>

            {/* Members List */}
            {(squad.members || []).map((member) => (
              <TouchableOpacity 
                key={member.id}
                style={styles.memberCard}
                onPress={() => handleMemberAction(member)}
              >
                <View style={styles.memberAvatar}>
                  {member.user?.avatar_url ? (
                    <Image source={{ uri: member.user.avatar_url }} style={styles.memberAvatarImage} />
                  ) : (
                    <Text style={styles.memberAvatarText}>
                      {member.user?.full_name?.charAt(0) || '?'}
                    </Text>
                  )}
                </View>
                
                <View style={styles.memberInfo}>
                  <View style={styles.memberHeader}>
                    <Text style={styles.memberName}>{member.user?.full_name}</Text>
                    <View style={styles.roleContainer}>
                      <Ionicons 
                        name={getRoleIcon(member.role)} 
                        size={16} 
                        color={getRoleColor(member.role)} 
                      />
                      <Text style={[styles.roleText, { color: getRoleColor(member.role) }]}>
                        {member.role}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.joinDate}>
                    Joined {formatJoinDate(member.joined_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {/* Squad Settings */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Squad Settings</Text>
              
              <TouchableOpacity style={styles.settingItem} onPress={() => handleEditSquadField('name')}>
                <Ionicons name="create" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.settingText}>Edit Squad Name</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem} onPress={() => handleEditSquadField('description')}>
                <Ionicons name="document-text" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.settingText}>Edit Description</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem} onPress={() => handleTogglePrivacy()}>
                <Ionicons name="lock-closed" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.settingText}>Privacy Settings</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              
              <TouchableOpacity 
                style={[styles.settingItem, styles.dangerItem]}
                onPress={handleDeleteSquad}
              >
                <Ionicons name="trash" size={20} color={theme.colors.danger} />
                <Text style={[styles.settingText, styles.dangerText]}>Delete Squad</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Search Users Modal */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.searchModalContent]}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.modalTitle}>Add Member</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  performSearch(text);
                }}
                placeholder="Search by name"
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <ScrollView style={styles.searchResultsList} keyboardShouldPersistTaps="handled">
              {searching && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator />
                </View>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <Text style={styles.searchEmptyText}>No users found</Text>
              )}
              {!searching && searchQuery.length < 2 && (
                <Text style={styles.searchEmptyText}>Type at least 2 characters to search</Text>
              )}
              {searchResults.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.searchResultRow}
                  onPress={() => handleAddUserToSquad(u.id, u.full_name || 'User')}
                  disabled={actionLoading}
                >
                  <View style={styles.searchResultAvatar}>
                    <Text style={styles.searchResultAvatarText}>
                      {(u.full_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{u.full_name || 'User'}</Text>
                    <Text style={styles.searchResultEmail}>
                      {(u.preferred_sports || []).slice(0, 2).join(', ') || 'Ralli player'}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={theme.colors.success} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editField === 'name' ? 'Edit Squad Name' : 'Edit Description'}
            </Text>
            <TextInput
              style={[styles.modalInput, editField === 'description' && styles.modalTextArea]}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editField === 'name' ? 'Squad name' : 'Description'}
              multiline={editField === 'description'}
              numberOfLines={editField === 'description' ? 4 : 1}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveEdit}
                disabled={actionLoading}
              >
                <Text style={styles.modalSaveText}>
                  {actionLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: ThemeContextValue) {
  const { colors: c } = theme;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: c.textSecondary,
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
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: c.textPrimary,
    },
    chatButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    squadInfo: {
      backgroundColor: c.surface,
      padding: 20,
      marginBottom: 16,
    },
    squadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    squadIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    squadIconText: {
      fontSize: 24,
    },
    squadDetails: {
      flex: 1,
    },
    squadName: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 4,
    },
    squadSport: {
      fontSize: 16,
      color: c.textSecondary,
      marginBottom: 2,
    },
    memberCount: {
      fontSize: 14,
      color: c.textMuted,
    },
    squadDescription: {
      fontSize: 16,
      color: c.textSecondary,
      lineHeight: 22,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.surface,
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
      borderBottomColor: c.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
      color: c.textSecondary,
    },
    activeTabText: {
      color: c.primary,
    },
    tabContent: {
      backgroundColor: c.surface,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    addMemberButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      marginVertical: 16,
      borderWidth: 2,
      borderColor: c.primary,
      borderStyle: 'dashed',
      borderRadius: 12,
    },
    addMemberText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.primary,
      marginLeft: 8,
    },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    memberAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    memberAvatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    memberAvatarText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
    },
    memberInfo: {
      flex: 1,
    },
    memberHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    roleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    roleText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 4,
      textTransform: 'capitalize',
    },
    joinDate: {
      fontSize: 14,
      color: c.textMuted,
    },
    settingsSection: {
      marginVertical: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: 12,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    settingText: {
      flex: 1,
      fontSize: 16,
      color: c.textPrimary,
      marginLeft: 12,
    },
    dangerItem: {
      borderBottomColor: c.danger,
      borderBottomWidth: 1,
    },
    dangerText: {
      color: c.danger,
    },
    settingValue: {
      fontSize: 14,
      color: c.textMuted,
      marginRight: 8,
      maxWidth: 100,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: c.bg,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textPrimary,
    },
    modalCancel: {
      fontSize: 16,
      color: c.textSecondary,
      width: 60,
    },
    modalSave: {
      fontSize: 16,
      color: c.primary,
      fontWeight: '600',
      width: 60,
      textAlign: 'right',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      margin: 16,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: c.textPrimary,
    },
    searchResults: {
      flex: 1,
      backgroundColor: c.surface,
    },
    noResults: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 16,
      marginTop: 40,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    searchResultAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    searchResultAvatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    searchResultAvatarText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
    },
    searchResultInfo: {
      flex: 1,
    },
    searchResultName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: 2,
    },
    searchResultEmail: {
      fontSize: 14,
      color: c.textMuted,
    },
    editInputContainer: {
      padding: 16,
    },
    editInput: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      fontSize: 16,
      color: c.textPrimary,
    },
    editTextArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      marginVertical: 16,
      color: c.textPrimary,
    },
    modalTextArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalCancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    modalCancelText: {
      fontSize: 16,
      color: c.textSecondary,
    },
    modalSaveButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: c.primary,
    },
    modalSaveText: {
      fontSize: 16,
      color: 'white',
      fontWeight: '600',
    },
    searchModalContent: {
      maxHeight: '80%',
      minHeight: 420,
    },
    searchModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 12,
      backgroundColor: c.bg,
    },
    searchResultsList: {
      maxHeight: 380,
    },
    searchEmptyText: {
      padding: 16,
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
    },
    searchResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
  });
}
