import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LocationService } from '../services/location';
import { PlacesApiService } from '../services/placesApi';
import { CapacityService } from '../services/capacityService';
import { checkInAtCourt, fetchCheckInsForPlaceDisplay, isWithinCheckInRadius } from '../services/checkInService';
import { CHECK_IN_RADIUS_METERS } from '../constants/checkIn';
import { useAuth } from '../contexts/AuthContext';
import { usePresence } from '../contexts/PresenceContext';
import { supabase } from '../services/supabase';
import { Court, CheckIn, Session, Sport } from '../types';
import { SPORTS_CONFIG, isSport } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import CapacityReporter from '../components/CapacityReporter';
import FacilityPhotoGallery from '../components/FacilityPhotoGallery';
import { useTheme } from '../theme/theme';
import { useCourtFavorites } from '../hooks/useCourtFavorites';

type CourtDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CourtDetail'>;
type CourtDetailScreenRouteProp = RouteProp<RootStackParamList, 'CourtDetail'>;

export default function EnhancedCourtDetailScreen() {
  const navigation = useNavigation<CourtDetailScreenNavigationProp>();
  const route = useRoute<CourtDetailScreenRouteProp>();
  const { user } = useAuth();
  const { setPresenceFromCheckIn, refreshActivePresence } = usePresence();
  const theme = useTheme();
  const { isFavorited, toggleFavorite } = useCourtFavorites();
  
  // Safely destructure params with fallback
  const courtId = route.params?.courtId;
  const initialSport = route.params?.initialSport;

  const [court, setCourt] = useState<Court | null>(null);
  const [placeDetails, setPlaceDetails] = useState<any>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showCapacityReporter, setShowCapacityReporter] = useState(false);
  const [capacityReportSport, setCapacityReportSport] = useState<Sport>('basketball');
  const [availableSports, setAvailableSports] = useState<Sport[]>([]);

  useEffect(() => {
    if (!courtId) {
      Alert.alert('Error', 'No facility ID provided', [
        { text: 'Go Back', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    fetchCourtData();
  }, [courtId]);

  const fetchCourtData = async () => {
    if (!courtId) return;
    
    try {
      setLoading(true);
      console.log('Fetching enhanced court details for ID:', courtId);
      
      // Fetch place details from Google Places API
      const details = await PlacesApiService.getPlaceDetails(courtId);
      setPlaceDetails(details);
      
      if (details) {
        console.log('Found place details:', details.displayName?.text);
        
        // Detect available sports from place data
        const detectedSports = PlacesApiService.detectSportsFromPlace(details);
        setAvailableSports(detectedSports);
        
        // Set initial sport if provided, otherwise use first detected sport
        if (initialSport && detectedSports.includes(initialSport as Sport)) {
          setCapacityReportSport(initialSport as Sport);
        } else {
          setCapacityReportSport(detectedSports[0] || 'basketball');
        }
        
        // Create a court object from place details for compatibility
        const courtData: Court = {
          id: courtId,
          name: details.displayName?.text || 'Unknown Facility',
          description: null,
          address: details.formattedAddress || '',
          latitude: details.location?.latitude || 0,
          longitude: details.location?.longitude || 0,
          sports: detectedSports,
          amenities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setCourt(courtData);
        
        // Fetch additional data in parallel (non-blocking)
        fetchCheckInsAndSessions(courtId);
      }
    } catch (error) {
      console.error('Error fetching court data:', error);
      Alert.alert(
        'Error',
        'Failed to load court details. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckInsAndSessions = async (facilityId: string) => {
    try {
      // Fetch check-ins and sessions in parallel
      const [checkInsList, sessionsResult] = await Promise.all([
        fetchCheckInsForPlaceDisplay(facilityId),
        supabase
          .from('sessions')
          .select('*')
          .eq('google_place_id', facilityId)
          .gte('scheduled_for', new Date().toISOString())
          .order('scheduled_for', { ascending: true })
      ]);

      setCheckIns(checkInsList as CheckIn[]);

      if (sessionsResult.data) {
        setSessions(sessionsResult.data as Session[]);
      }
    } catch (error) {
      console.error('Error fetching check-ins and sessions:', error);
    }
  };

  const handleCheckIn = async (sport: Sport) => {
    if (!user || !court) return;

    try {
      setCheckingIn(true);
      
      // Get current location
      const location = await LocationService.getCurrentLocation();
      
      if (!location) {
        Alert.alert('Location Required', 'Please enable location services to check in.');
        return;
      }
      
      // Validate location (within 200m of court - matches MapScreen check-in radius)
      const distance = LocationService.calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        court.latitude,
        court.longitude
      );

      if (
        !isWithinCheckInRadius(
          location.coords.latitude,
          location.coords.longitude,
          court.latitude,
          court.longitude
        )
      ) {
        Alert.alert(
          'Too Far Away',
          `You need to be within ${CHECK_IN_RADIUS_METERS} meters of the facility to check in.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const { data, error } = await checkInAtCourt({
        userId: user.id,
        googlePlaceId: court.id,
        sport,
        userLatitude: location.coords.latitude,
        userLongitude: location.coords.longitude,
        placeLatitude: court.latitude,
        placeLongitude: court.longitude,
      });

      if (error || !data) throw error || new Error('Check-in failed');

      await CapacityService.updateCapacityOnCheckIn(court.id, sport);
      setPresenceFromCheckIn({
        id: data.id,
        googlePlaceId: court.id,
        placeLatitude: court.latitude,
        placeLongitude: court.longitude,
        sport,
      });
      void refreshActivePresence();

      Alert.alert(
        'Checked In!',
        `You've successfully checked in for ${SPORTS_CONFIG[sport].name} at ${court.name}.`,
        [{ text: 'OK' }]
      );

      // Refresh data
      fetchCheckInsAndSessions(court.id);
    } catch (error) {
      console.error('Error checking in:', error);
      Alert.alert(
        'Check-in Failed',
        'Unable to check in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setCheckingIn(false);
    }
  };

  const handleScheduleSession = (sport: Sport) => {
    if (!court) return;
    navigation.navigate('CreateSession', {
      courtId: court.id,
      sport,
      facilitySports: court.sports.filter(isSport),
    });
  };

  const handleCapacityReport = (sport: Sport) => {
    setCapacityReportSport(sport);
    setShowCapacityReporter(true);
  };

  const handleDirections = () => {
    if (!court) return;
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${court.latitude},${court.longitude}`;
    Linking.openURL(url);
  };

  const handleShare = () => {
    if (!court) return;
    
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.name)}&query_place_id=${court.id}`;
    const message = `Check out ${court.name} on Ralli! ${shareUrl}`;
    
    // For now, just copy to clipboard - in a real app you'd use proper sharing
    Alert.alert('Share Facility', message);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading facility details...</Text>
      </SafeAreaView>
    );
  }

  if (!court || !placeDetails) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load facility details</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchCourtData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.facilityName} numberOfLines={1}>
            {court.name}
          </Text>
          <Text style={styles.facilityAddress} numberOfLines={1}>
            {court.address}
          </Text>
        </View>

        {user ? (
          <TouchableOpacity
            style={styles.favoriteHeaderButton}
            onPress={() => toggleFavorite(court)}
            accessibilityLabel={isFavorited(court) ? 'Remove from saved courts' : 'Save court'}
          >
            <Ionicons
              name={isFavorited(court) ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorited(court) ? theme.colors.danger : theme.colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Photo Gallery */}
        <FacilityPhotoGallery 
          photos={placeDetails.photos || []}
          facilityName={court.name}
        />

        {/* Clean Facility Info */}
        <View style={[styles.facilityInfoSection, { backgroundColor: theme.colors.surface }] }>
          {/* Rating and Status */}
          <View style={styles.ratingStatusRow}>
            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.floor(placeDetails.rating || 0) ? "star" : "star-outline"}
                    size={16}
                    color="#fbbf24"
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {placeDetails.rating?.toFixed(1) || 'N/A'} ({placeDetails.userRatingCount || 0})
              </Text>
            </View>
            
            <View style={[
              styles.statusBadge,
              placeDetails.isOpen ? styles.openBadge : styles.closedBadge
            ]}>
              <Text style={[
                styles.statusText,
                placeDetails.isOpen ? styles.openText : styles.closedText
              ]}>
                {placeDetails.isOpen ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>

          {/* Today's Hours */}
          {placeDetails.currentOpeningHours?.weekdayDescriptions?.[new Date().getDay()] && (
            <View style={styles.hoursContainer}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.hoursText}>
                Today: {placeDetails.currentOpeningHours.weekdayDescriptions[new Date().getDay()].split(': ').slice(1).join(': ') || 'Hours unavailable'}
              </Text>
            </View>
          )}

          {/* Contact Info */}
          <View style={styles.contactSection}>
            {/* Address */}
            <View style={styles.contactItem}>
              <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{court.address}</Text>
            </View>

            {/* Phone */}
            {placeDetails.nationalPhoneNumber && (
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={() => Linking.openURL(`tel:${placeDetails.nationalPhoneNumber}`)}
              >
                <Ionicons name="call-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.contactText, { color: theme.colors.primary }] }>
                  {placeDetails.nationalPhoneNumber}
                </Text>
              </TouchableOpacity>
            )}

            {/* Website */}
            {placeDetails.websiteUri && (
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={() => Linking.openURL(placeDetails.websiteUri)}
              >
                <Ionicons name="globe-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.contactText, { color: theme.colors.primary }] }>
                  Visit website
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Directions Button */}
          <TouchableOpacity style={[styles.directionsButton, { backgroundColor: theme.colors.primary }]} onPress={handleDirections}>
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Community Section */}
        <View style={[styles.communitySection, { backgroundColor: theme.colors.surface }]}>
          <Text style={styles.communitySectionTitle}>Community</Text>
          <Text style={[styles.communitySectionSubtitle, { color: theme.colors.textMuted }]}>
            Connect with regulars at this facility
          </Text>
          <View style={styles.communityButtons}>
            <TouchableOpacity
              style={[styles.communityButton, { borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('CourtChat', {
                googlePlaceId: court.id,
                facilityName: court.name,
              })}
            >
              <View style={[styles.communityIconWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                <Ionicons name="chatbubbles" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.communityBtnInfo}>
                <Text style={[styles.communityBtnTitle, { color: theme.colors.textPrimary }]}>Court Chat</Text>
                <Text style={[styles.communityBtnDesc, { color: theme.colors.textMuted }]}>
                  Talk to people here
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.communityButton, { borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('CourtCrews', {
                googlePlaceId: court.id,
                facilityName: court.name,
              })}
            >
              <View style={[styles.communityIconWrap, { backgroundColor: '#F59E0B12' }]}>
                <Ionicons name="shield" size={22} color="#F59E0B" />
              </View>
              <View style={styles.communityBtnInfo}>
                <Text style={[styles.communityBtnTitle, { color: theme.colors.textPrimary }]}>Crews</Text>
                <Text style={[styles.communityBtnDesc, { color: theme.colors.textMuted }]}>
                  Teams &amp; challenges
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Padding for Floating Check-In */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Bottom Check-In Section */}
      <View style={[styles.floatingCheckInSection, { backgroundColor: theme.colors.surface }]}>
        {/* Sports Activity Display */}
        <View style={styles.sportsActivityContainer}>
          <Text style={styles.sportsActivityTitle}>Current Activity</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.sportsActivityScroll}
            contentContainerStyle={styles.sportsActivityContent}
          >
            {availableSports.map((sport) => {
              const sportConfig = SPORTS_CONFIG[sport];
              const sportCheckIns = checkIns.filter(checkIn => checkIn.sport === sport).length;
              
              return (
                <View key={sport} style={styles.sportActivityItem}>
                  <View style={[styles.sportActivityIcon, { backgroundColor: sportConfig?.color || '#1a73e8' }]}>
                    <Text style={styles.sportActivityEmoji}>
                      {sportConfig?.icon || '🏀'}
                    </Text>
                  </View>
                  <Text style={[styles.sportActivityName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {sportConfig?.name || sport}
                  </Text>
                  <Text style={styles.sportActivityCount}>
                    {sportCheckIns} {sportCheckIns === 1 ? 'person' : 'people'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.checkInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleCheckIn(availableSports[0] || 'basketball')}
            disabled={checkingIn}
          >
            {checkingIn ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="location" size={20} color="white" />
            )}
            <Text style={styles.checkInButtonText}>
              {checkingIn ? 'Checking In...' : 'Check In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.scheduleButton, { borderColor: theme.colors.primary }]}
            onPress={() => handleScheduleSession(availableSports[0] || 'basketball')}
          >
            <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            <Text style={[styles.scheduleButtonText, { color: theme.colors.primary }]}>Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Capacity Reporter Modal */}
      <CapacityReporter
        visible={showCapacityReporter}
        onClose={() => setShowCapacityReporter(false)}
        facilityId={court.id}
        facilityName={court.name}
        sport={capacityReportSport}
        onReported={() => {
          setShowCapacityReporter(false);
          fetchCheckInsAndSessions(court.id);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
  },
  facilityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  facilityAddress: {
    fontSize: 14,
    color: '#666',
  },
  favoriteHeaderButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  sessionsContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionSport: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sessionDateTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  sessionPlayers: {
    fontSize: 12,
    color: '#999',
  },
  bottomPadding: {
    height: 180, // Space for floating check-in section
  },
  
  // Clean Facility Info Styles
  facilityInfoSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ratingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  openBadge: {
    backgroundColor: '#dcfce7',
  },
  closedBadge: {
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  openText: {
    color: '#16a34a',
  },
  closedText: {
    color: '#dc2626',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  hoursText: {
    fontSize: 14,
    color: '#666',
  },
  contactSection: {
    gap: 12,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  phoneText: {
    color: '#1a73e8',
  },
  linkText: {
    color: '#1a73e8',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Floating Check-In Section Styles
  floatingCheckInSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 34, // Safe area padding
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sportsActivityContainer: {
    marginBottom: 16,
  },
  sportsActivityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  sportsActivityScroll: {
    flexDirection: 'row',
  },
  sportsActivityContent: {
    gap: 12,
  },
  sportActivityItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  sportActivityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sportActivityEmoji: {
    fontSize: 20,
  },
  sportActivityName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  sportActivityCount: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  checkInButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  checkInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#1a73e8',
  },
  scheduleButtonText: {
    color: '#1a73e8',
    fontSize: 16,
    fontWeight: '600',
  },
  communitySection: {
    padding: 20,
    marginTop: 10,
  },
  communitySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  communitySectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  communityButtons: {
    gap: 10,
  },
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  communityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  communityBtnInfo: {
    flex: 1,
  },
  communityBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  communityBtnDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
