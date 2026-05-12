import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { PlacesApiService } from '../services/placesApi';
import { SmartDefaultsService } from '../services/smartDefaultsService';
import { Court, Sport, SessionRequest } from '../types';
import { SPORTS_CONFIG, SPORT_FILTERS, isSport } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens, createTextStyle } from '../design/tokens';
import Input from '../components/ui/Input';

type CreateSessionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateSession'>;
type CreateSessionScreenRouteProp = RouteProp<RootStackParamList, 'CreateSession'>;

function mergeFacilitySports(
  fromRoute: Sport[] | undefined,
  fromCourt: string[] | undefined,
  selected: Sport | null
): Sport[] {
  const out: Sport[] = [];
  const add = (s: string) => {
    if (!isSport(s)) return;
    if (!out.includes(s)) out.push(s);
  };
  for (const s of fromRoute ?? []) add(s);
  for (const s of fromCourt ?? []) add(s);
  if (selected && isSport(selected) && !out.includes(selected)) out.push(selected);
  return out;
}

export default function CreateSessionScreen() {
  const navigation = useNavigation<CreateSessionScreenNavigationProp>();
  const route = useRoute<CreateSessionScreenRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const courtId = route.params?.courtId;
  const initialSport = route.params?.sport;

  const [court, setCourt] = useState<Court | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(initialSport as Sport || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0, 0, 0);
    return now;
  });
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<string>('all');

  useEffect(() => {
    if (!courtId) {
      Alert.alert('Error', 'No facility selected', [
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    fetchCourt();
  }, [courtId]);

  // Fetch smart defaults based on user history
  useEffect(() => {
    if (user?.id) {
      SmartDefaultsService.getSessionDefaults(user.id).then(defaults => {
        // Apply preferred time
        if (defaults.preferredTime) {
          const [hours, minutes] = defaults.preferredTime.split(':').map(Number);
          const newDate = new Date(scheduledDate);
          newDate.setHours(hours, minutes, 0, 0);
          // Only apply if it's in the future
          if (newDate > new Date()) {
            setScheduledDate(newDate);
          }
        }
        
        // Apply preferred sport if not already set
        if (!initialSport && !selectedSport && defaults.preferredSport) {
          setSelectedSport(defaults.preferredSport);
        }
        
        // Apply suggested max players
        if (defaults.suggestedMaxPlayers) {
          setMaxPlayers(defaults.suggestedMaxPlayers);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedSport) {
      const sportConfig = SPORTS_CONFIG[selectedSport];
      setTitle(sportConfig.defaultSessionTitle);
      // Use smart defaults for max players, but cap it at sport's max
      const sportMaxPlayers = SmartDefaultsService.getMaxPlayersSuggestion(selectedSport);
      setMaxPlayers(Math.min(maxPlayers || sportMaxPlayers, sportConfig.maxPlayers));
    }
  }, [selectedSport]);

  const fetchCourt = async () => {
    if (!courtId) return;
    
    try {
      const placeDetails = await PlacesApiService.getPlaceDetails(courtId);
      if (placeDetails) {
        const detectedSports = PlacesApiService.detectSportsFromPlace(placeDetails);
        const courtData = PlacesApiService.convertPlaceToCourtFormat(placeDetails, detectedSports);
        setCourt(courtData);

        if (!initialSport) {
          const fromMap = route.params?.facilitySports;
          if (fromMap?.length) {
            setSelectedSport(fromMap[0]);
          } else if (courtData.sports.length > 0) {
            setSelectedSport(courtData.sports[0] as Sport);
          }
        }
      } else {
        throw new Error('Facility not found');
      }
    } catch (error: any) {
      console.error('Error fetching court details:', error);
      Alert.alert(
        'Error', 
        'Failed to load facility details.',
        [
          { text: 'Retry', onPress: fetchCourt },
          { text: 'Cancel', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const validateSession = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!title.trim()) {
      newErrors.title = 'Session title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    
    if (!selectedSport) {
      newErrors.sport = 'Please select a sport';
    }
    
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 60 * 1000);
    
    if (scheduledDate <= minDate) {
      newErrors.date = 'Must be at least 15 minutes from now';
    }
    
    if (maxPlayers < 2) {
      newErrors.maxPlayers = 'At least 2 players required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateSession = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!court || !user) {
      Alert.alert('Error', 'Missing required information.');
      return;
    }

    if (!validateSession()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);

      const sessionData: SessionRequest = {
        google_place_id: courtId!,
        sport: selectedSport!,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_for: scheduledDate.toISOString(),
        max_players: maxPlayers,
        location_name: court.name,
        latitude: court.latitude,
        longitude: court.longitude,
      };

      const { data: sessionData2, error: sessionError } = await supabase
        .from('sessions')
        .insert([{
          ...sessionData,
          creator_id: user.id,
          skill_level: skillLevel === 'all' ? null : skillLevel,
          recurrence_rule: recurrenceRule,
        }])
        .select()
        .single();

      if (sessionError) throw new Error(sessionError.message);

      const { error: participantErr } = await supabase
        .from('session_participants')
        .insert([{ session_id: sessionData2.id, user_id: user.id, status: 'in' }]);
      if (participantErr) console.error('Failed to add creator as participant:', participantErr);

      const { error: countErr } = await supabase
        .from('sessions')
        .update({ current_players: 1 })
        .eq('id', sessionData2.id);
      if (countErr) console.error('Failed to update player count:', countErr);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('🎉 Session Created!', 'Your session is live!', [
        { text: 'View Session', onPress: () => navigation.replace('SessionDetail', { sessionId: sessionData2.id }) }
      ]);

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    const isToday = date.toDateString() === new Date().toDateString();
    const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
    
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const mergedSports = mergeFacilitySports(
    route.params?.facilitySports,
    court?.sports,
    selectedSport
  );
  const availableSports = mergedSports.length > 0 ? mergedSports : SPORT_FILTERS;

  const isFormValid = title.trim().length >= 3 && selectedSport && court;

  if (!court) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}>
        <LinearGradient colors={theme.gradient.colors as [string, string]} style={styles.loadingGradient}>
          <Ionicons name="basketball-outline" size={48} color="white" />
          <Text style={styles.loadingText}>Loading facility...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style="light" />
      
      {/* Gradient Header */}
      <LinearGradient colors={theme.gradient.colors as [string, string]} style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Haptics.selectionAsync();
              navigation.goBack();
            }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Create Session</Text>
            <View style={styles.facilityBadge}>
              <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {court.name}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sport Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Sport
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportsScroll}>
              <View style={styles.sportsRow}>
                {availableSports.map((sport) => {
                  const config = SPORTS_CONFIG[sport];
                  if (!config) return null;
                  const isSelected = selectedSport === sport;
                  return (
                    <TouchableOpacity
                      key={sport}
                      style={[
                        styles.sportChip,
                        { borderColor: isSelected ? config.color : theme.colors.border },
                        isSelected && { backgroundColor: config.color + '15' }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSport(sport);
                      }}
                    >
                      <Text style={styles.sportEmoji}>{config.icon}</Text>
                      <Text style={[
                        styles.sportName,
                        { color: isSelected ? config.color : theme.colors.textSecondary }
                      ]}>
                        {config.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={config.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Date & Time - Prominent Card */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              When
            </Text>
            <TouchableOpacity
              style={styles.dateTimeCard}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={theme.gradient.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dateTimeGradient}
              >
                <View style={styles.dateTimeContent}>
                  <View style={styles.dateSection}>
                    <Ionicons name="calendar" size={28} color="white" />
                    <View style={styles.dateTextContainer}>
                      <Text style={styles.dateLabel}>Date</Text>
                      <Text style={styles.dateValue}>{formatDate(scheduledDate)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.dateDivider} />
                  
                  <View style={styles.timeSection}>
                    <Ionicons name="time" size={28} color="white" />
                    <View style={styles.timeTextContainer}>
                      <Text style={styles.timeLabel}>Time</Text>
                      <Text style={styles.timeValue}>{formatTime(scheduledDate)}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.tapHint}>
                  <Text style={styles.tapHintText}>Tap to change</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
          </View>

          {/* Session Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Details
            </Text>
            
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Session Title</Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Pickup Game, Practice"
                  errorText={errors.title}
                  maxLength={50}
                />
                <Text style={[styles.charCount, { color: theme.colors.textMuted }]}>{title.length}/50</Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Description (Optional)</Text>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Any details for players..."
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          </View>

          {/* Players */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Players
            </Text>
            <View style={[styles.playersCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.playersInfo}>
                <Text style={[styles.playersLabel, { color: theme.colors.textPrimary }]}>Max Players</Text>
                <Text style={[styles.playersHint, { color: theme.colors.textMuted }]}>
                  Recommended: {SPORTS_CONFIG[selectedSport || 'basketball']?.maxPlayers || 8}
                </Text>
              </View>
              <View style={styles.playerStepper}>
                <TouchableOpacity
                  style={[styles.stepperButton, maxPlayers <= 2 && styles.stepperButtonDisabled]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMaxPlayers(Math.max(2, maxPlayers - 1));
                  }}
                  disabled={maxPlayers <= 2}
                >
                  <LinearGradient
                    colors={maxPlayers <= 2 ? ['#E5E7EB', '#D1D5DB'] as [string, string] : theme.gradient.colors as [string, string]}
                    style={styles.stepperGradient}
                  >
                    <Ionicons name="remove" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <View style={styles.playerCountBox}>
                  <Text style={[styles.playerCount, { color: theme.colors.textPrimary }]}>{maxPlayers}</Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.stepperButton, maxPlayers >= 50 && styles.stepperButtonDisabled]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMaxPlayers(Math.min(50, maxPlayers + 1));
                  }}
                  disabled={maxPlayers >= 50}
                >
                  <LinearGradient
                    colors={maxPlayers >= 50 ? ['#E5E7EB', '#D1D5DB'] as [string, string] : theme.gradient.colors as [string, string]}
                    style={styles.stepperGradient}
                  >
                    <Ionicons name="add" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Recurring */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Repeat
            </Text>
            <View style={styles.recurrenceOptions}>
              {[
                { value: null, label: 'One-time' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Every 2 weeks' },
              ].map(option => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.recurrenceOption,
                    recurrenceRule === option.value && styles.recurrenceOptionActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRecurrenceRule(option.value);
                  }}
                >
                  <Text style={[
                    styles.recurrenceOptionText,
                    recurrenceRule === option.value && styles.recurrenceOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skill Level */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Skill Level
            </Text>
            <View style={styles.skillOptions}>
              {[
                { value: 'all', label: 'All Levels', icon: '🏅' },
                { value: 'beginner', label: 'Beginner', icon: '🌱' },
                { value: 'intermediate', label: 'Intermediate', icon: '⚡' },
                { value: 'advanced', label: 'Advanced', icon: '🔥' },
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.skillOption,
                    skillLevel === option.value && styles.skillOptionActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSkillLevel(option.value);
                  }}
                >
                  <Text style={styles.skillEmoji}>{option.icon}</Text>
                  <Text style={[
                    styles.skillOptionText,
                    skillLevel === option.value && styles.skillOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Create Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.createButton, !isFormValid && styles.createButtonDisabled]}
            onPress={handleCreateSession}
            disabled={loading || !isFormValid}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={isFormValid ? theme.gradient.colors as [string, string] : ['#9CA3AF', '#6B7280'] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButtonGradient}
            >
              {loading ? (
                <Text style={styles.createButtonText}>Creating...</Text>
              ) : (
                <>
                  <Ionicons name="add-circle" size={24} color="white" />
                  <Text style={styles.createButtonText}>Create Session</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerModal, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.colors.textPrimary }]}>Select Date & Time</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={scheduledDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                textColor={theme.colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
      
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={scheduledDate}
          mode="datetime"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...createTextStyle('sm', 'medium'),
    color: 'white',
    marginTop: 8,
  },
  header: {
    paddingBottom: DesignTokens.space.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.lg,
    paddingTop: DesignTokens.space.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: DesignTokens.space.md,
  },
  headerTitle: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
  },
  facilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  headerSubtitle: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.9)',
  },
  headerSpacer: {
    width: 40,
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
    marginBottom: DesignTokens.space.md,
  },
  sportsScroll: {
    marginHorizontal: -DesignTokens.space.lg,
    paddingHorizontal: DesignTokens.space.lg,
  },
  sportsRow: {
    flexDirection: 'row',
    gap: DesignTokens.space.sm,
    paddingRight: DesignTokens.space.lg,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.space.md,
    paddingVertical: DesignTokens.space.sm,
    borderRadius: DesignTokens.radius.xl,
    borderWidth: 2,
    gap: DesignTokens.space.xs,
  },
  sportEmoji: {
    fontSize: 20,
  },
  sportName: {
    ...createTextStyle('sm', 'semibold'),
  },
  dateTimeCard: {
    borderRadius: DesignTokens.radius.xl,
    overflow: 'hidden',
    ...DesignTokens.shadow.lg,
  },
  dateTimeGradient: {
    padding: DesignTokens.space.xl,
  },
  dateTimeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateLabel: {
    ...createTextStyle('xs', 'medium'),
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
    marginTop: 2,
  },
  dateDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: DesignTokens.space.lg,
  },
  timeSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  timeTextContainer: {
    flex: 1,
  },
  timeLabel: {
    ...createTextStyle('xs', 'medium'),
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    ...createTextStyle('xl', 'bold'),
    color: 'white',
    marginTop: 2,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DesignTokens.space.md,
    paddingTop: DesignTokens.space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: 4,
  },
  tapHintText: {
    ...createTextStyle('sm', 'medium'),
    color: 'rgba(255,255,255,0.7)',
  },
  card: {
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputWrapper: {
    padding: DesignTokens.space.lg,
  },
  inputLabel: {
    ...createTextStyle('sm', 'medium'),
    marginBottom: DesignTokens.space.xs,
  },
  charCount: {
    ...createTextStyle('xs', 'regular'),
    textAlign: 'right',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  playersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DesignTokens.space.lg,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
  },
  playersInfo: {
    flex: 1,
  },
  playersLabel: {
    ...createTextStyle('base', 'semibold'),
  },
  playersHint: {
    ...createTextStyle('xs', 'regular'),
    marginTop: 2,
  },
  playerStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.space.md,
  },
  stepperButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  stepperGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCountBox: {
    minWidth: 50,
    alignItems: 'center',
  },
  playerCount: {
    ...createTextStyle('2xl', 'bold'),
  },
  errorText: {
    ...createTextStyle('sm', 'medium'),
    color: '#EF4444',
    marginTop: DesignTokens.space.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: DesignTokens.space.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  createButton: {
    borderRadius: DesignTokens.radius.xl,
    overflow: 'hidden',
    ...DesignTokens.shadow.lg,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignTokens.space.lg,
    gap: DesignTokens.space.sm,
  },
  createButtonText: {
    ...createTextStyle('lg', 'bold'),
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DesignTokens.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    ...createTextStyle('lg', 'semibold'),
  },
  pickerDone: {
    ...createTextStyle('base', 'semibold'),
    color: '#6759FF',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  recurrenceOptionActive: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255,107,53,0.1)',
  },
  recurrenceOptionText: {
    fontSize: 14,
    color: '#666',
  },
  recurrenceOptionTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  skillOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    gap: 4,
  },
  skillOptionActive: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255,107,53,0.1)',
  },
  skillEmoji: {
    fontSize: 14,
  },
  skillOptionText: {
    fontSize: 13,
    color: '#666',
  },
  skillOptionTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
});
