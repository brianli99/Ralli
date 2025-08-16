import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { LocationService } from '../services/location';
import { PlacesApiService, PlaceResult } from '../services/placesApi';
import { CapacityService, FacilityCapacity } from '../services/capacityService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Court, Sport, MapRegion } from '../types';
import { SPORTS_CONFIG, DEFAULT_MAP_REGION, SPORT_FILTERS } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function MapScreen() {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<MapRegion>(DEFAULT_MAP_REGION);
  const [courts, setCourts] = useState<Court[]>([]);
  const [filteredCourts, setFilteredCourts] = useState<Court[]>([]);
  const [selectedSports, setSelectedSports] = useState<Sport[]>(SPORT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(5000); // 5km default
  const [capacities, setCapacities] = useState<Record<string, FacilityCapacity>>({});
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    getCurrentLocation();
    fetchCourts();
  }, []);

  useEffect(() => {
    filterCourts();
  }, [courts, selectedSports, searchText]);

  // Fetch real-time facilities when location or filters change
  useEffect(() => {
    if (userLocation) {
      fetchRealTimeFacilities(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, selectedSports, searchRadius]);

  const getCurrentLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      mapRef.current?.animateToRegion(newRegion);
      
      // Fetch real-time facilities near this location
      await fetchRealTimeFacilities(location.coords.latitude, location.coords.longitude);
    }
  };

  // Remove sample data fetching - we only use real-time data now
  const fetchCourts = async () => {
    // This function is kept for compatibility but does nothing
    // All courts are now fetched from Google Places API in real-time
  };

  // Fetch real-time sports facilities from Google Places API
  const fetchRealTimeFacilities = async (userLat: number, userLng: number) => {
    if (!PlacesApiService.isConfigured()) {
      if (courts.length === 0) {
        // Show configuration alert only once
        PlacesApiService.showConfigurationAlert();
      }
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching real-time facilities for location:', userLat, userLng);
      
      // Search for real sports facilities
      const places = await PlacesApiService.searchNearbySportsFacilities(
        userLat, 
        userLng, 
        searchRadius,
        selectedSports.length > 0 ? selectedSports : undefined
      );

      console.log('Found places:', places.length);

      // Convert to Court format and categorize by sport
      const realCourts = places.map(place => {
        const detectedSports = PlacesApiService.detectSportsFromPlace(place);
        return PlacesApiService.convertPlaceToCourtFormat(place, detectedSports);
      });

      setCourts(realCourts);
      
      // Fetch capacity data for these facilities
      if (realCourts.length > 0) {
        const facilityIds = realCourts.map(court => court.id);
        const capacityData = await CapacityService.getCapacitiesForFacilities(facilityIds);
        setCapacities(capacityData);
      }

    } catch (error) {
      console.error('Error fetching real-time facilities:', error);
      Alert.alert('Error', 'Failed to load nearby facilities');
    } finally {
      setLoading(false);
    }
  };

  const filterCourts = () => {
    let filtered = courts;
    
    // Filter by selected sports
    if (selectedSports.length > 0) {
      filtered = filtered.filter(court =>
        court.sports.some(sport => selectedSports.includes(sport as Sport))
      );
    }
    
    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(court =>
        court.name.toLowerCase().includes(searchLower) ||
        court.address.toLowerCase().includes(searchLower) ||
        court.sports.some(sport => sport.toLowerCase().includes(searchLower)) ||
        court.amenities.some(amenity => amenity.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredCourts(filtered);
  };

  const toggleSportFilter = (sport: Sport) => {
    setSelectedSports(prev =>
      prev.includes(sport)
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const handleMarkerPress = (court: Court) => {
    navigation.navigate('CourtDetail', { courtId: court.id });
  };

  const getMarkerColor = (court: Court): string => {
    // Return color based on the first sport in the court's sports array
    const primarySport = court.sports[0] as Sport;
    return SPORTS_CONFIG[primarySport]?.color || '#1a73e8';
  };

  const renderMultiSportMarker = (court: Court) => {
    const capacity = capacities[court.id];
    const primarySport = court.sports[0] as Sport;
    const hasMultipleSports = court.sports.length > 1;
    
    return (
      <View style={[styles.marker, { backgroundColor: getMarkerColor(court) }]}>
        <Text style={styles.markerEmoji}>
          {SPORTS_CONFIG[primarySport]?.icon || '🏀'}
        </Text>
        {hasMultipleSports && (
          <View style={styles.multiSportIndicator}>
            <Text style={styles.multiSportText}>+{court.sports.length - 1}</Text>
          </View>
        )}
        {capacity && CapacityService.isCapacityReportRecent(capacity) && (
          <View style={[styles.capacityIndicator, { backgroundColor: CapacityService.getCapacityColor(capacity.occupancy_level) }]}>
            <Text style={styles.capacityText}>
              {CapacityService.getCapacityEmoji(capacity.occupancy_level)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filteredCourts.map((court) => (
          <Marker
            key={court.id}
            coordinate={{
              latitude: court.latitude,
              longitude: court.longitude,
            }}
            onPress={() => handleMarkerPress(court)}
          >
            {renderMultiSportMarker(court)}
          </Marker>
        ))}
      </MapView>

      <View style={styles.filterContainer}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search facilities..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#999"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sport Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {SPORT_FILTERS.map((sport) => (
            <TouchableOpacity
              key={sport}
              style={[
                styles.filterButton,
                selectedSports.includes(sport) && styles.filterButtonActive,
                { borderColor: SPORTS_CONFIG[sport].color },
              ]}
              onPress={() => toggleSportFilter(sport)}
            >
              <Text style={styles.filterEmoji}>{SPORTS_CONFIG[sport].icon}</Text>
              <Text
                style={[
                  styles.filterText,
                  selectedSports.includes(sport) && styles.filterTextActive,
                ]}
              >
                {SPORTS_CONFIG[sport].name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search radius controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.radiusControls}>
          <View style={styles.radiusHeader}>
            <Text style={styles.controlLabel}>Search Radius: {(searchRadius/1000).toFixed(1)}km</Text>
            <Text style={styles.facilityCount}>{filteredCourts.length} facilities</Text>
          </View>
          <Slider
            style={styles.radiusSlider}
            minimumValue={1000}
            maximumValue={10000}
            step={500}
            value={searchRadius}
            onValueChange={setSearchRadius}
            minimumTrackTintColor="#1a73e8"
            maximumTrackTintColor="#e0e0e0"
            thumbTintColor="#1a73e8"
          />
          <View style={styles.radiusLabels}>
            <Text style={styles.radiusLabelText}>1km</Text>
            <Text style={styles.radiusLabelText}>10km</Text>
          </View>
        </View>
        
        {loading && (
          <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>Finding nearby facilities...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.locationButton}
        onPress={getCurrentLocation}
      >
        <Ionicons name="locate" size={24} color="#1a73e8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerEmoji: {
    fontSize: 18,
  },
  filterContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonActive: {
    backgroundColor: '#f0f7ff',
  },
  filterEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  locationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 50,
    height: 50,
    backgroundColor: 'white',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  // New styles for real-time features
  controlsContainer: {
    position: 'absolute',
    bottom: 170,
    left: 16,
    right: 16,
  },
  dataToggle: {
    marginBottom: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a73e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButtonActive: {
    backgroundColor: '#1a73e8',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a73e8',
    marginLeft: 4,
  },
  toggleTextActive: {
    color: 'white',
  },
  radiusControls: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  facilityCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  radiusSlider: {
    width: '100%',
    height: 40,
  },
  radiusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  radiusLabelText: {
    fontSize: 10,
    color: '#999',
  },
  multiSportIndicator: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'white',
  },
  multiSportText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingIndicator: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  capacityIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  capacityText: {
    fontSize: 10,
  },
});
