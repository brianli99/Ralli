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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/theme';
import { SPORT_FILTERS, SPORTS_CONFIG } from '../../constants/sports';
import { Sport } from '../../types';
import { SquadApi } from '../../services/squadApi';
import { SportCode } from '../../types/squad.types';

type CreateSquadNavigationProp = StackNavigationProp<RootStackParamList>;

export default function CreateSquadScreen() {
  const navigation = useNavigation<CreateSquadNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();
  
  const [squadName, setSquadName] = useState('');
  const [selectedSport, setSelectedSport] = useState<Sport | ''>('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxMembers, setMaxMembers] = useState('12');
  const [creating, setCreating] = useState(false);

  const handleCreateSquad = async () => {
    if (!squadName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please enter a squad name');
      return;
    }

    if (!selectedSport) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please select a sport');
      return;
    }

    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'You must be logged in to create a squad');
      return;
    }

    try {
      setCreating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Call the actual API to create the squad
      const { data, error } = await SquadApi.createSquad({
        name: squadName.trim(),
        sport_code: selectedSport as SportCode,
        description: description.trim() || undefined,
        max_members: parseInt(maxMembers) || 12,
        is_private: isPrivate,
      }, user.id);

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newSquadId = data?.id;
      Alert.alert(
        '🎉 Squad Created!',
        `"${squadName}" is ready to go! Invite your friends and start playing together.`,
        [
          {
            text: 'View Squad',
            onPress: () => {
              if (newSquadId) {
                navigation.replace('SquadDetail', { squadId: newSquadId });
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating squad:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create squad. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSportSelect = (sport: Sport) => {
    Haptics.selectionAsync();
    setSelectedSport(sport);
  };

  const isValidForm = squadName.trim() && selectedSport;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create Squad</Text>
        
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Squad Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Squad Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter squad name"
            value={squadName}
            onChangeText={setSquadName}
            maxLength={50}
          />
        </View>

        {/* Sport Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sport</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the primary sport for this squad
          </Text>
          <View style={styles.sportsGrid}>
            {SPORT_FILTERS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportButton,
                  selectedSport === sport && styles.sportButtonActive,
                  { borderColor: SPORTS_CONFIG[sport].color }
                ]}
                onPress={() => handleSportSelect(sport)}
              >
                <Text style={styles.sportEmoji}>{SPORTS_CONFIG[sport].icon}</Text>
                <Text
                  style={[
                    styles.sportText,
                    selectedSport === sport && styles.sportTextActive
                  ]}
                >
                  {SPORTS_CONFIG[sport].name}
                </Text>
                {selectedSport === sport && (
                  <Ionicons name="checkmark" size={16} color={SPORTS_CONFIG[sport].color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionSubtitle}>
            Tell others what this squad is about
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Describe your squad's purpose, skill level, or any other details..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Private Squad</Text>
              <Text style={styles.settingDescription}>
                Only invited members can join
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#e0e0e0', true: '#1a73e8' }}
              thumbColor={isPrivate ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Member Limit */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maximum Members</Text>
          <Text style={styles.sectionSubtitle}>
            Set a limit for squad size
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="12"
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreateSquad}
          disabled={!isValidForm || creating}
          activeOpacity={0.8}
          style={styles.createButtonContainer}
        >
          <LinearGradient
            colors={isValidForm ? theme.gradient.colors as [string, string] : ['#9CA3AF', '#6B7280'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButton}
          >
            {creating ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="people" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.createButtonText}>Create Squad</Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
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
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  sportButtonActive: {
    backgroundColor: '#f0f7ff',
  },
  sportEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  sportText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 8,
  },
  sportTextActive: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  createButtonContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
