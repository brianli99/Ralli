import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { CommunityApi } from '../../services/communityApi';
import { SPORTS_CONFIG } from '../../constants/sports';
import { Sport } from '../../types';
import { Gradients } from '../../design/tokens';

type CreateCrewNavProp = StackNavigationProp<RootStackParamList>;
type CreateCrewRouteProp = RouteProp<RootStackParamList, 'CreateCrew'>;

const SPORTS = Object.entries(SPORTS_CONFIG) as [Sport, (typeof SPORTS_CONFIG)[Sport]][];

export default function CreateCrewScreen() {
  const navigation = useNavigation<CreateCrewNavProp>();
  const route = useRoute<CreateCrewRouteProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const { googlePlaceId, facilityName } = route.params;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<Sport | null>(null);
  const [maxMembers, setMaxMembers] = useState('15');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Name Required', 'Give your crew a name.');
      return;
    }
    if (!sport) {
      Alert.alert('Sport Required', 'Pick a sport for your crew.');
      return;
    }

    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const crew = await CommunityApi.createCrew({
      name: name.trim(),
      googlePlaceId,
      sport,
      description: description.trim() || undefined,
      captainId: user.id,
      maxMembers: parseInt(maxMembers, 10) || 15,
    });

    setCreating(false);

    if (crew) {
      Alert.alert('Crew Created!', `${crew.name} is ready. Invite your people.`, [
        { text: 'View Crew', onPress: () => navigation.replace('CrewDetail', { crewId: crew.id }) },
      ]);
    } else {
      Alert.alert('Error', 'Could not create crew. Try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>New Crew</Text>
        <View style={styles.cancelButton} />
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {/* Location */}
        <View style={[styles.locationBanner, { backgroundColor: theme.colors.primary + '10' }]}>
          <Ionicons name="location" size={16} color={theme.colors.primary} />
          <Text style={[styles.locationText, { color: theme.colors.primary }]} numberOfLines={1}>
            {facilityName}
          </Text>
        </View>

        {/* Name */}
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Crew Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
          placeholder="e.g. Monday Night Hoopers"
          placeholderTextColor={theme.colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        {/* Sport */}
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Sport</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportScroll} contentContainerStyle={styles.sportScrollContent}>
          {SPORTS.map(([key, config]) => {
            const selected = sport === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.sportPill,
                  { borderColor: selected ? config.color : theme.colors.border },
                  selected && { backgroundColor: config.color + '15' },
                ]}
                onPress={() => setSport(key)}
              >
                <Text style={styles.sportPillEmoji}>{config.icon}</Text>
                <Text
                  style={[
                    styles.sportPillText,
                    { color: selected ? config.color : theme.colors.textSecondary },
                  ]}
                >
                  {config.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Description */}
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Description (optional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { backgroundColor: theme.colors.surface, color: theme.colors.textPrimary, borderColor: theme.colors.border },
          ]}
          placeholder="What's your crew about?"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        {/* Max Members */}
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Max Members</Text>
        <View style={styles.memberRow}>
          {['5', '10', '15', '20'].map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.memberOption,
                {
                  borderColor: maxMembers === val ? theme.colors.primary : theme.colors.border,
                  backgroundColor: maxMembers === val ? theme.colors.primary + '10' : theme.colors.surface,
                },
              ]}
              onPress={() => setMaxMembers(val)}
            >
              <Text
                style={[
                  styles.memberOptionText,
                  { color: maxMembers === val ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                {val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Create Button */}
        <TouchableOpacity onPress={handleCreate} disabled={creating} style={styles.createWrapper}>
          <LinearGradient
            colors={[...Gradients.ralliPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.createButton, creating && { opacity: 0.7 }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color="white" />
                <Text style={styles.createButtonText}>Create Crew</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cancelButton: {
    width: 60,
  },
  cancelText: {
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sportScroll: {
    marginBottom: 20,
    flexGrow: 0,
  },
  sportScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  sportPillEmoji: {
    fontSize: 16,
  },
  sportPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  memberOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  memberOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  createWrapper: {
    marginTop: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
});
