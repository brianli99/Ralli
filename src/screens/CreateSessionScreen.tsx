import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { PlacesApiService } from '../services/placesApi';
import { Court, Sport, SessionRequest } from '../types';
import { SPORTS_CONFIG, SPORT_FILTERS } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';

type CreateSessionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateSession'>;
type CreateSessionScreenRouteProp = RouteProp<RootStackParamList, 'CreateSession'>;

export default function CreateSessionScreen() {
  const navigation = useNavigation<CreateSessionScreenNavigationProp>();
  const route = useRoute<CreateSessionScreenRouteProp>();
  const { user } = useAuth();
  const { courtId, sport: initialSport } = route.params;

  const [court, setCourt] = useState<Court | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(initialSport as Sport || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCourt();
  }, [courtId]);

  useEffect(() => {
    if (selectedSport) {
      const sportConfig = SPORTS_CONFIG[selectedSport];
      setTitle(sportConfig.defaultSessionTitle);
      setMaxPlayers(sportConfig.maxPlayers);
    }
  }, [selectedSport]);

  const fetchCourt = async () => {
    try {
      // Try to get place details from Google Places API
      const placeDetails = await PlacesApiService.getPlaceDetails(courtId);
      if (placeDetails) {
        // Convert place details to Court format
        const detectedSports = PlacesApiService.detectSportsFromPlace(placeDetails);
        const courtData = PlacesApiService.convertPlaceToCourtFormat(placeDetails, detectedSports);
        setCourt(courtData);

        // If no initial sport provided, select the first available sport
        if (!initialSport && courtData.sports.length > 0) {
          setSelectedSport(courtData.sports[0] as Sport);
        }
      } else {
        throw new Error('Facility not found');
      }
    } catch (error: any) {
      console.error('Error fetching court details:', error);
      Alert.alert('Error', 'Failed to load facility details. Please try again.');
      navigation.goBack();
    }
  };

  const handleCreateSession = async () => {
    if (!court || !selectedSport || !user) return;

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a session title');
      return;
    }

    if (scheduledDate <= new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    try {
      setLoading(true);

      const sessionData: SessionRequest = {
        court_id: courtId,
        sport: selectedSport,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_for: scheduledDate.toISOString(),
        max_players: maxPlayers,
      };

      const { data, error } = await supabase
        .from('sessions')
        .insert([{ ...sessionData, creator_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Automatically join the creator to the session
      await supabase
        .from('session_participants')
        .insert([{
          session_id: data.id,
          user_id: user.id,
          status: 'in'
        }]);

      // Update session player count
      await supabase
        .from('sessions')
        .update({ current_players: 1 })
        .eq('id', data.id);

      Alert.alert('Success', 'Session created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('SessionDetail', { sessionId: data.id })
        }
      ]);

    } catch (error: any) {
      Alert.alert('Error', 'Failed to create session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const availableSports = court?.sports.filter(sport => 
    SPORT_FILTERS.includes(sport as Sport)
  ) as Sport[] || [];

  if (!court) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Session</Text>
        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateSession}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Court</Text>
          <View style={styles.courtCard}>
            <Text style={styles.courtName}>{court.name}</Text>
            <Text style={styles.courtAddress}>{court.address}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sportsContainer}>
              {availableSports.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[
                    styles.sportButton,
                    selectedSport === sport && styles.sportButtonActive,
                    { borderColor: SPORTS_CONFIG[sport].color }
                  ]}
                  onPress={() => setSelectedSport(sport)}
                >
                  <Text style={styles.sportEmoji}>
                    {SPORTS_CONFIG[sport].icon}
                  </Text>
                  <Text
                    style={[
                      styles.sportText,
                      selectedSport === sport && styles.sportTextActive
                    ]}
                  >
                    {SPORTS_CONFIG[sport].name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter session title"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add any additional details..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date & Time</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#1a73e8" />
              <Text style={styles.dateButtonText}>
                {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Max Players</Text>
            <View style={styles.playerCounter}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => setMaxPlayers(Math.max(2, maxPlayers - 1))}
              >
                <Ionicons name="remove" size={20} color="#1a73e8" />
              </TouchableOpacity>
              <Text style={styles.playerCount}>{maxPlayers}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => setMaxPlayers(Math.min(50, maxPlayers + 1))}
              >
                <Ionicons name="add" size={20} color="#1a73e8" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="datetime"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  courtCard: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  courtAddress: {
    fontSize: 14,
    color: '#666',
  },
  sportsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  sportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
  },
  sportButtonActive: {
    backgroundColor: '#f0f7ff',
  },
  sportEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  sportText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  sportTextActive: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: 'white',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  playerCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  playerCount: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    minWidth: 40,
    textAlign: 'center',
  },
});
