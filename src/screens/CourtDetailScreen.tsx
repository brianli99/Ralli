import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LocationService } from '../services/location';
import { PlacesApiService } from '../services/placesApi';
import { CapacityService } from '../services/capacityService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Court, CheckIn, Session, Sport, CheckInRequest } from '../types';
import { SPORTS_CONFIG } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import CapacityReporter from '../components/CapacityReporter';

type CourtDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CourtDetail'>;
type CourtDetailScreenRouteProp = RouteProp<RootStackParamList, 'CourtDetail'>;

export default function CourtDetailScreen() {
  const navigation = useNavigation<CourtDetailScreenNavigationProp>();
  const route = useRoute<CourtDetailScreenRouteProp>();
  const { user } = useAuth();
  const { courtId } = route.params;

  const [court, setCourt] = useState<Court | null>(null);
  const [placeDetails, setPlaceDetails] = useState<any>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [showCapacityReporter, setShowCapacityReporter] = useState(false);
  const [capacityReportSport, setCapacityReportSport] = useState<Sport>('basketball');

  useEffect(() => {
    fetchCourtData();
  }, [courtId]);

  const fetchCourtData = async () => {
    try {
      setLoading(true);
      
      // Fetch real-time facility details from Google Places API
      console.log('Fetching court details for ID:', courtId);
      const placeDetails = await PlacesApiService.getPlaceDetails(courtId);
      
      if (placeDetails) {
        console.log('Found place details:', placeDetails.displayName.text);
        // Store the raw place details for enhanced UI
        setPlaceDetails(placeDetails);
        // Convert Google Places data to Court format
        const detectedSports = PlacesApiService.detectSportsFromPlace(placeDetails);
        const courtFromPlace = PlacesApiService.convertPlaceToCourtFormat(placeDetails, detectedSports);
        setCourt(courtFromPlace);
      } else {
        console.error('No place details found for ID:', courtId);
        throw new Error('Facility not found');
      }

      // Fetch recent check-ins and sessions (these might not exist for Google Places facilities)
      await fetchCheckInsAndSessions();

    } catch (error: any) {
      Alert.alert('Error', 'Failed to load court details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckInsAndSessions = async () => {
    try {
      // Fetch recent check-ins (last 4 hours)
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: checkInData, error: checkInError } = await supabase
        .from('check_ins')
        .select('*')
        .eq('court_id', courtId)
        .gte('created_at', fourHoursAgo)
        .order('created_at', { ascending: false });

      if (!checkInError) {
        setCheckIns(checkInData || []);
      }

      // Fetch upcoming sessions
      const now = new Date().toISOString();
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('court_id', courtId)
        .gte('scheduled_for', now)
        .eq('status', 'upcoming')
        .order('scheduled_for', { ascending: true });

      if (!sessionError) {
        setSessions(sessionData || []);
      }
    } catch (error) {
      console.log('No existing check-ins or sessions found for this facility');
      // This is expected for new Google Places facilities
      setCheckIns([]);
      setSessions([]);
    }
  };

  const handleCheckIn = async (sport: Sport) => {
    if (!court || !user) return;

    try {
      setCheckingIn(true);

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Location Required', 'Unable to get your location for check-in.');
        return;
      }

      // Validate user is within range
      const isInRange = LocationService.isWithinCheckInRange(
        location.coords.latitude,
        location.coords.longitude,
        court.latitude,
        court.longitude,
        100 // 100 meters
      );

      if (!isInRange) {
        Alert.alert(
          'Too Far Away',
          'You need to be within 100 meters of the court to check in.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create check-in record
      const checkInData: CheckInRequest = {
        court_id: courtId,
        sport,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const { error } = await supabase
        .from('check_ins')
        .insert([{ ...checkInData, user_id: user.id }]);

      if (error) throw error;

      Alert.alert('Success', `Checked in for ${SPORTS_CONFIG[sport].name}!`);
      fetchCourtData(); // Refresh data

    } catch (error: any) {
      Alert.alert('Check-in Failed', error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCreateSession = (sport?: Sport) => {
    navigation.navigate('CreateSession', { courtId, sport });
  };

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('SessionDetail', { sessionId });
  };

  const getCheckInCountBySport = (sport: Sport): number => {
    return checkIns.filter(checkIn => checkIn.sport === sport).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (!court) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Court not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{court.name}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.courtInfo}>
          <Text style={styles.courtName}>{court.name}</Text>
          <Text style={styles.courtAddress}>{court.address}</Text>
          
          {/* Enhanced Google Places info */}
          <View style={styles.facilityDetails}>
            {placeDetails?.rating && (
              <View style={styles.detailItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.detailText}>
                  {placeDetails.rating} ({placeDetails.userRatingCount || 0} reviews)
                </Text>
              </View>
            )}
            
            {placeDetails?.currentOpeningHours && (
              <View style={styles.detailItem}>
                <Ionicons 
                  name={placeDetails.currentOpeningHours.openNow ? "time" : "time-outline"} 
                  size={16} 
                  color={placeDetails.currentOpeningHours.openNow ? "#4CAF50" : "#f44336"} 
                />
                <Text style={[
                  styles.detailText,
                  { color: placeDetails.currentOpeningHours.openNow ? "#4CAF50" : "#f44336" }
                ]}>
                  {placeDetails.currentOpeningHours.openNow ? "Open now" : "Closed"}
                </Text>
              </View>
            )}
            
            {placeDetails?.nationalPhoneNumber && (
              <View style={styles.detailItem}>
                <Ionicons name="call" size={16} color="#1a73e8" />
                <Text style={styles.detailText}>{placeDetails.nationalPhoneNumber}</Text>
              </View>
            )}
            
            {placeDetails?.websiteUri && (
              <View style={styles.detailItem}>
                <Ionicons name="globe" size={16} color="#1a73e8" />
                <Text style={[styles.detailText, styles.linkText]} numberOfLines={1}>
                  {placeDetails.websiteUri.replace('https://', '').replace('http://', '')}
                </Text>
              </View>
            )}
          </View>
          
          {court.description && (
            <Text style={styles.courtDescription}>{court.description}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Sports</Text>
          <View style={styles.sportsGrid}>
            {court.sports.map((sport) => (
              <View key={sport} style={styles.sportCard}>
                <View style={styles.sportHeader}>
                  <Text style={styles.sportEmoji}>
                    {SPORTS_CONFIG[sport as Sport]?.icon || '🏀'}
                  </Text>
                  <Text style={styles.sportName}>
                    {SPORTS_CONFIG[sport as Sport]?.name || sport}
                  </Text>
                </View>
                
                <Text style={styles.activeCount}>
                  {getCheckInCountBySport(sport as Sport)} active
                </Text>

                <View style={styles.sportActions}>
                  <TouchableOpacity
                    style={[
                      styles.checkInButton,
                      { backgroundColor: SPORTS_CONFIG[sport as Sport]?.color || '#1a73e8' },
                      checkingIn && styles.buttonDisabled
                    ]}
                    onPress={() => handleCheckIn(sport as Sport)}
                    disabled={checkingIn}
                  >
                    <Ionicons name="location" size={16} color="white" />
                    <Text style={styles.checkInButtonText}>
                      {checkingIn ? 'Checking In...' : 'Check In'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sessionButton}
                    onPress={() => handleCreateSession(sport as Sport)}
                  >
                    <Ionicons name="add" size={16} color="#1a73e8" />
                    <Text style={styles.sessionButtonText}>Schedule</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.capacityButton}
                    onPress={() => {
                      setCapacityReportSport(sport as Sport);
                      setShowCapacityReporter(true);
                    }}
                  >
                    <Ionicons name="people" size={16} color="#FF9800" />
                    <Text style={styles.capacityButtonText}>Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => handleSessionPress(session.id)}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionEmoji}>
                    {SPORTS_CONFIG[session.sport as Sport]?.icon || '🏀'}
                  </Text>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    <Text style={styles.sessionTime}>
                      {new Date(session.scheduled_for).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.sessionPlayers}>
                    {session.current_players}/{session.max_players}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {court.amenities && court.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesList}>
              {court.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Capacity Reporter Modal */}
      {court && (
        <CapacityReporter
          facilityId={court.id}
          facilityName={court.name}
          sport={capacityReportSport}
          visible={showCapacityReporter}
          onClose={() => setShowCapacityReporter(false)}
          onReported={() => {
            // Refresh capacity data after reporting
            fetchCourtData();
          }}
        />
      )}
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  courtInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  courtName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  courtAddress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  courtDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sportsGrid: {
    gap: 16,
  },
  sportCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
  },
  sportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sportEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  sportName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  activeCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  sportActions: {
    flexDirection: 'row',
    gap: 6,
  },
  checkInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  checkInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  sessionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a73e8',
    gap: 4,
  },
  sessionButtonText: {
    color: '#1a73e8',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  sessionCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#666',
  },
  sessionPlayers: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a73e8',
  },
  amenitiesList: {
    gap: 8,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amenityText: {
    fontSize: 16,
    color: '#333',
  },
  // Enhanced facility details styles
  facilityDetails: {
    marginTop: 16,
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  linkText: {
    color: '#1a73e8',
  },
  capacityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 4,
  },
  capacityButtonText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 14,
  },
});
