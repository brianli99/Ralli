import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle, Gradients } from '../design/tokens';
import { SPORTS_CONFIG } from '../constants/sports';
import { Sport } from '../types';
import { isOnline } from '../utils/errorHandling';

type EditProfileNavigationProp = StackNavigationProp<RootStackParamList>;

function getAvatarStoragePath(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;

  const cleanUrl = avatarUrl.split('?')[0];
  const marker = '/storage/v1/object/public/avatars/';
  const markerIndex = cleanUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const path = decodeURIComponent(cleanUrl.slice(markerIndex + marker.length));
  if (!path.startsWith('avatars/')) return null;
  return path;
}

export default function EditProfileScreen() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  
  // Form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [selectedSports, setSelectedSports] = useState<Sport[]>(
    (user?.preferred_sports as Sport[]) || []
  );
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>(
    (user as any)?.skill_levels || {}
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Profile picture state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Track changes
  useEffect(() => {
    const nameChanged = fullName !== (user?.full_name || '');
    const sportsChanged = JSON.stringify(selectedSports.sort()) !== 
      JSON.stringify((user?.preferred_sports as Sport[] || []).sort());
    const skillsChanged = JSON.stringify(skillLevels) !==
      JSON.stringify((user as any)?.skill_levels || {});
    setHasChanges(nameChanged || sportsChanged || skillsChanged);
  }, [fullName, selectedSports, skillLevels, user]);

  const handleSportToggle = (sport: Sport) => {
    Haptics.selectionAsync();
    setSelectedSports(prev => {
      if (prev.includes(sport)) {
        return prev.filter(s => s !== sport);
      } else {
        return [...prev, sport];
      }
    });
  };

  const handleSave = async () => {
    if (!user) return;

    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to save profile changes.');
      return;
    }

    if (!fullName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Name Required', 'Please enter your display name');
      return;
    }

    if (selectedSports.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Select Sports', 'Please select at least one sport');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          preferred_sports: selectedSports,
          sport_preference_order: selectedSports,
          skill_levels: skillLevels,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      Alert.alert('Success', 'Your profile has been updated!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    Haptics.selectionAsync();
    
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photo library to set a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show options
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
            if (cameraStatus.status !== 'granted') {
              Alert.alert('Permission Required', 'We need camera access to take photos.');
              return;
            }
            pickImageFromCamera();
          }
        },
        {
          text: 'Choose from Library',
          onPress: pickImageFromLibrary
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const pickImageFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const pickImageFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const guessMimeType = (ext: string): string => {
    const e = ext.toLowerCase();
    if (e === 'png') return 'image/png';
    if (e === 'webp') return 'image/webp';
    if (e === 'heic' || e === 'heif') return 'image/heic';
    if (e === 'gif') return 'image/gif';
    return 'image/jpeg';
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return;

    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to update your profile picture.');
      return;
    }

    setUploadingImage(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { uri } = asset;
      const baseName =
        asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, '') ||
        `${user.id}-${Date.now()}`;
      const rawExt =
        baseName.includes('.') ? baseName.split('.').pop()! : undefined;
      const fromUri = uri.split('?')[0].split('.').pop();
      const fileExt = (rawExt || fromUri || 'jpg').toLowerCase();
      const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${safeExt}`;
      const filePath = `avatars/${fileName}`;
      const contentType = asset.mimeType || guessMimeType(safeExt);

      const arrayBuffer = await new ExpoFile(uri).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      const versionedPublicUrl = `${publicUrl}?v=${Date.now()}`;
      const previousAvatarPath = getAvatarStoragePath(user.avatar_url);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          avatar_url: versionedPublicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      if (previousAvatarPath && previousAvatarPath !== filePath) {
        supabase.storage
          .from('avatars')
          .remove([previousAvatarPath])
          .then(({ error }) => {
            if (error) console.warn('Failed to remove previous avatar:', error.message);
          });
      }

      setAvatarUrl(versionedPublicUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      Alert.alert('Success', 'Profile picture updated!');

    } catch (error: any) {
      console.error('Error uploading image:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Check if it's a storage bucket issue
      if (error.message?.includes('bucket') || error.statusCode === 404) {
        Alert.alert(
          'Storage Not Configured',
          'The avatars storage bucket needs to be created in your Supabase project. Please create a public bucket named "avatars" in your Supabase Storage settings.'
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to upload image');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handlePasswordChange = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChangingPassword(true);

    try {
      if (!(await isOnline())) {
        Alert.alert('Offline', 'Connect to the internet to update your password.');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your password has been updated!');
      
      // Reset and close modal
      setNewPassword('');
      setConfirmPassword('');
      setPasswordModalVisible(false);

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const closePasswordModal = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient colors={[...Gradients.ralliPrimary]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity 
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <Animated.View 
          style={[
            styles.avatarSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={handlePickImage}
            disabled={uploadingImage}
          >
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={styles.avatarImage}
              />
            ) : (
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {fullName ? fullName.slice(0, 2).toUpperCase() : 'U'}
                </Text>
              </LinearGradient>
            )}
            {uploadingImage ? (
              <View style={styles.editAvatarBadge}>
                <ActivityIndicator size="small" color="white" />
              </View>
            ) : (
              <View style={styles.editAvatarBadge}>
                <Ionicons name="camera" size={14} color="white" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            {uploadingImage ? 'Uploading...' : 'Tap to change photo'}
          </Text>
        </Animated.View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Name Input */}
          <Animated.View 
            style={[
              styles.section,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Display Name
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.textPrimary }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {fullName.length > 0 && (
                <TouchableOpacity onPress={() => setFullName('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Email (Read-only) */}
          <Animated.View 
            style={[
              styles.section,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Email
            </Text>
            <View style={[styles.inputContainer, styles.inputReadonly, { backgroundColor: theme.colors.bg }]}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
              <Text style={[styles.inputText, { color: theme.colors.textSecondary }]}>
                {user?.email}
              </Text>
              <Ionicons name="lock-closed" size={14} color={theme.colors.textMuted} />
            </View>
            <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>
              Email cannot be changed
            </Text>
          </Animated.View>

          {/* Sports Selection */}
          <Animated.View 
            style={[
              styles.section,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Favorite Sports
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
              Select the sports you play
            </Text>
            
            <View style={styles.sportsGrid}>
              {Object.entries(SPORTS_CONFIG).map(([sport, config]) => {
                const isSelected = selectedSports.includes(sport as Sport);
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles.sportCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      isSelected && { borderColor: config.color, backgroundColor: config.color + '15' }
                    ]}
                    onPress={() => handleSportToggle(sport as Sport)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.sportIconContainer,
                      { backgroundColor: isSelected ? config.color + '20' : theme.colors.bg }
                    ]}>
                      <Text style={styles.sportEmoji}>{config.icon}</Text>
                    </View>
                    <Text style={[
                      styles.sportName,
                      { color: isSelected ? config.color : theme.colors.textPrimary }
                    ]}>
                      {config.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: config.color }]}>
                        <Ionicons name="checkmark" size={12} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Skill Levels */}
          {selectedSports.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Skill Levels
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                How would you rate yourself?
              </Text>
              {selectedSports.map((sport) => (
                <View key={sport} style={styles.skillRow}>
                  <Text style={[styles.skillSportName, { color: theme.colors.textPrimary }]}>
                    {SPORTS_CONFIG[sport]?.icon} {SPORTS_CONFIG[sport]?.name || sport}
                  </Text>
                  <View style={styles.skillPills}>
                    {['beginner', 'intermediate', 'advanced'].map(level => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.skillPill,
                          skillLevels[sport] === level && styles.skillPillActive
                        ]}
                        onPress={() => {
                          setSkillLevels(prev => ({ ...prev, [sport]: level }));
                          setHasChanges(true);
                        }}
                      >
                        <Text style={[
                          styles.skillPillText,
                          skillLevels[sport] === level && styles.skillPillTextActive
                        ]}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Account Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Haptics.selectionAsync();
                setPasswordModalVisible(true);
              }}
            >
              <Ionicons name="key-outline" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.actionButtonText, { color: theme.colors.textPrimary }]}>
                Change Password
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('NotificationSettings');
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.actionButtonText, { color: theme.colors.textPrimary }]}>
                Notification Settings
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.dangerAction]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert(
                  'Delete Account',
                  'This action cannot be undone. All your data will be permanently deleted.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => {
                      Alert.alert('Contact Support', 'To delete your account, please contact support@ralli.app');
                    }}
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
                Delete Account
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password Change Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.passwordModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.passwordModalHeader}>
              <Text style={[styles.passwordModalTitle, { color: theme.colors.textPrimary }]}>
                Change Password
              </Text>
              <TouchableOpacity onPress={closePasswordModal}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordModalContent}>
              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: theme.colors.textSecondary }]}>
                  New Password
                </Text>
                <View style={[styles.passwordInputWrapper, { borderColor: theme.colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: theme.colors.textPrimary }]}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons 
                      name={showNewPassword ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={theme.colors.textMuted} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: theme.colors.textSecondary }]}>
                  Confirm New Password
                </Text>
                <View style={[styles.passwordInputWrapper, { borderColor: theme.colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: theme.colors.textPrimary }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={[styles.passwordHint, { color: theme.colors.textMuted }]}>
                Password must be at least 6 characters long
              </Text>
            </View>

            <View style={styles.passwordModalActions}>
              <TouchableOpacity 
                style={[styles.passwordCancelButton, { borderColor: theme.colors.border }]}
                onPress={closePasswordModal}
              >
                <Text style={[styles.passwordCancelText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.passwordSaveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handlePasswordChange}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.passwordSaveText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: DesignTokens.space['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DesignTokens.space.lg,
    marginBottom: DesignTokens.space.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
  },
  saveButton: {
    paddingHorizontal: DesignTokens.space.lg,
    paddingVertical: DesignTokens.space.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: DesignTokens.radius.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
  saveButtonTextDisabled: {
    opacity: 0.7,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
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
  avatarText: {
    ...createTextStyle('3xl', 'bold'),
    color: 'white',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'white',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarHint: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.8)',
    marginTop: DesignTokens.space.sm,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: DesignTokens.space.lg,
  },
  section: {
    marginBottom: DesignTokens.space.xl,
  },
  sectionTitle: {
    ...createTextStyle('lg', 'bold'),
    marginBottom: DesignTokens.space.xs,
  },
  sectionSubtitle: {
    ...createTextStyle('sm', 'regular'),
    marginBottom: DesignTokens.space.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    gap: DesignTokens.space.sm,
  },
  inputReadonly: {
    opacity: 0.7,
  },
  inputIcon: {
    marginRight: DesignTokens.space.xs,
  },
  input: {
    flex: 1,
    ...createTextStyle('base', 'regular'),
    paddingVertical: DesignTokens.space.sm,
  },
  inputText: {
    flex: 1,
    ...createTextStyle('base', 'regular'),
    paddingVertical: DesignTokens.space.sm,
  },
  hintText: {
    ...createTextStyle('xs', 'regular'),
    marginTop: DesignTokens.space.xs,
    marginLeft: DesignTokens.space.xs,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.space.md,
  },
  sportCard: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 2,
    position: 'relative',
  },
  sportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.space.sm,
  },
  sportEmoji: {
    fontSize: 24,
  },
  sportName: {
    ...createTextStyle('xs', 'semibold'),
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: DesignTokens.space.xl,
    marginTop: DesignTokens.space.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignTokens.space.lg,
    gap: DesignTokens.space.md,
  },
  actionButtonText: {
    ...createTextStyle('base', 'medium'),
    flex: 1,
  },
  dangerAction: {
    marginTop: DesignTokens.space.md,
    paddingTop: DesignTokens.space.lg,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  skillRow: {
    marginBottom: 16,
  },
  skillSportName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  skillPills: {
    flexDirection: 'row',
    gap: 8,
  },
  skillPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  skillPillActive: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255,107,53,0.1)',
  },
  skillPillText: {
    fontSize: 13,
    color: '#666',
  },
  skillPillTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 50,
  },
  
  // Password Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
  },
  passwordModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: DesignTokens.radius.xl,
    padding: DesignTokens.space.xl,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.space.xl,
  },
  passwordModalTitle: {
    ...createTextStyle('xl', 'bold'),
  },
  passwordModalContent: {
    marginBottom: DesignTokens.space.xl,
  },
  passwordInputContainer: {
    marginBottom: DesignTokens.space.lg,
  },
  passwordLabel: {
    ...createTextStyle('sm', 'medium'),
    marginBottom: DesignTokens.space.sm,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    paddingHorizontal: DesignTokens.space.md,
  },
  passwordInput: {
    flex: 1,
    ...createTextStyle('base', 'regular'),
    paddingVertical: DesignTokens.space.md,
  },
  eyeButton: {
    padding: DesignTokens.space.sm,
  },
  passwordHint: {
    ...createTextStyle('xs', 'regular'),
    marginTop: DesignTokens.space.xs,
  },
  passwordModalActions: {
    flexDirection: 'row',
    gap: DesignTokens.space.md,
  },
  passwordCancelButton: {
    flex: 1,
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  passwordCancelText: {
    ...createTextStyle('base', 'semibold'),
  },
  passwordSaveButton: {
    flex: 1,
    paddingVertical: DesignTokens.space.md,
    borderRadius: DesignTokens.radius.lg,
    alignItems: 'center',
  },
  passwordSaveText: {
    ...createTextStyle('base', 'semibold'),
    color: 'white',
  },
});

