import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  Linking,
  Share,
} from 'react-native';
import Slider from '@react-native-community/slider';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationService } from '../services/location';
import { PlacesApiService } from '../services/placesApi';
import { CapacityService } from '../services/capacityService';
import {
  checkInAtCourt,
  countUniquePlayersAtPlace,
  countUniquePlayersBySport,
  fetchCheckInsForPlaceGroup,
  isWithinCheckInRadius,
} from '../services/checkInService';
import { useAuth } from '../contexts/AuthContext';
import { usePresence } from '../contexts/PresenceContext';
import { CHECK_IN_RADIUS_METERS } from '../constants/checkIn';
import { mergeNearbyPlaces, getPlaceIdsForQueries } from '../utils/venueConsolidation';
import { PulsingDot } from '../components/ui';
import { Court, Sport, MapRegion, CheckIn } from '../types';
import { SPORTS_CONFIG, SPORT_GLYPHS, SPORT_GRADIENTS, DEFAULT_MAP_REGION, SPORT_FILTERS, isSport } from '../constants/sports';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/theme';
import { DesignTokens } from '../design/tokens';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCourtFavorites, isCourtFavorited } from '../hooks/useCourtFavorites';
import { isOnline } from '../utils/errorHandling';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** ~18% past visible edges so edge pins are still included when clustering */
const MAP_VIEWPORT_PADDING = 0.18;
const CLUSTER_REGION_DEBOUNCE_MS = 300;
/** After merging "Search this area" results, keep the nearest N to the reference point to bound memory/CPU */
const MAX_MERGED_COURTS = 350;
const MIN_REGION_DELTA = 1e-4;
const MAX_REGION_DELTA = 80;
const DEFAULT_SEARCH_RADIUS_METERS = 3219;

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function clampRegionForClustering(region: Region): Region {
  const latD = Math.min(
    MAX_REGION_DELTA,
    Math.max(MIN_REGION_DELTA, region.latitudeDelta || MIN_REGION_DELTA)
  );
  const lngD = Math.min(
    MAX_REGION_DELTA,
    Math.max(MIN_REGION_DELTA, region.longitudeDelta || MIN_REGION_DELTA)
  );
  return { ...region, latitudeDelta: latD, longitudeDelta: lngD };
}

function filterCourtsInViewport(
  courts: Court[],
  region: Region,
  padding: number
): Court[] {
  if (!courts.length) return [];
  const r = clampRegionForClustering(region);
  const halfLat = (r.latitudeDelta / 2) * (1 + padding);
  const halfLng = (r.longitudeDelta / 2) * (1 + padding);
  const minLat = r.latitude - halfLat;
  const maxLat = r.latitude + halfLat;
  const minLng = r.longitude - halfLng;
  const maxLng = r.longitude + halfLng;
  return courts.filter(c => {
    if (c.latitude == null || c.longitude == null) return false;
    return c.latitude >= minLat && c.latitude <= maxLat && c.longitude >= minLng && c.longitude <= maxLng;
  });
}

function trimCourtsToNearestN(
  courts: Court[],
  ref: { latitude: number; longitude: number },
  max: number
): Court[] {
  if (courts.length <= max) return courts;
  return [...courts]
    .sort((a, b) => distanceMeters(a, ref) - distanceMeters(b, ref))
    .slice(0, max);
}

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList>;

// ============================================
// CLUSTER HELPER - Groups nearby markers
// ============================================

interface ClusterData {
  id: string;
  latitude: number;
  longitude: number;
  courts: Court[];
  displaySport: Sport;
}

const clusterMarkers = (courts: Court[], region: Region, selectedSports: Sport[]): ClusterData[] => {
  if (!courts.length) return [];

  const safe = clampRegionForClustering(region);

  // Calculate clustering distance based on zoom level
  const zoomLevel = Math.log2(360 / safe.longitudeDelta);
  if (!Number.isFinite(zoomLevel)) return [];

  const clusterRadius = zoomLevel < 12 ? 0.008 : zoomLevel < 14 ? 0.004 : 0.001;
  
  const clusters: ClusterData[] = [];
  const processed = new Set<string>();
  
  courts.forEach(court => {
    if (processed.has(court.id)) return;
    
    const nearby = courts.filter(c => {
      if (processed.has(c.id)) return false;
      const latDiff = Math.abs(c.latitude - court.latitude);
      const lngDiff = Math.abs(c.longitude - court.longitude);
      return latDiff < clusterRadius && lngDiff < clusterRadius;
    });
    
    nearby.forEach(c => processed.add(c.id));
    
    // Calculate center of cluster
    const avgLat = nearby.reduce((sum, c) => sum + c.latitude, 0) / nearby.length;
    const avgLng = nearby.reduce((sum, c) => sum + c.longitude, 0) / nearby.length;
    
    // Get primary sport for cluster.
    // We track first-occurrence index so that ties resolve in favor of the
    // sport that was listed first on the court (which is the search-attributed
    // sport thanks to detectSportsFromPlace ordering — e.g. for Stead Park
    // basketball comes before generic park inference).
    const sportCounts: Record<string, number> = {};
    const sportFirstIndex: Record<string, number> = {};
    nearby.forEach(c => {
      c.sports.forEach((s: string, i: number) => {
        if (!selectedSports.length || selectedSports.includes(s as Sport)) {
          sportCounts[s] = (sportCounts[s] || 0) + 1;
          if (sportFirstIndex[s] === undefined) {
            sportFirstIndex[s] = i;
          }
        }
      });
    });
    const primarySport = Object.entries(sportCounts)
      .sort(([sa, a], [sb, b]) => {
        if (b !== a) return b - a;
        return (sportFirstIndex[sa] ?? 99) - (sportFirstIndex[sb] ?? 99);
      })[0]?.[0] as Sport || 'basketball';

    const combined = mergeNearbyPlaces(nearby, { latitude: avgLat, longitude: avgLng });

    clusters.push({
      id: nearby.map(c => c.id).join('-'),
      latitude: avgLat,
      longitude: avgLng,
      courts: [combined],
      displaySport: primarySport,
    });
  });
  
  return clusters;
};

// ============================================
// CUSTOM MARKER COMPONENT
// ============================================

interface MapMarkerProps {
  cluster: ClusterData;
  isSelected: boolean;
  isFavorited?: boolean;
}

const MapMarker = React.memo(({ cluster, isSelected, isFavorited }: MapMarkerProps) => {
  const primaryCourt = cluster.courts[0];
  const sourcePoiCount =
    primaryCourt?.groupPlaceIds?.length ?? cluster.courts.length;
  const gradient = SPORT_GRADIENTS[cluster.displaySport] || ['#FF8A4C', '#F25C1F'];
  const glyphName = SPORT_GLYPHS[cluster.displaySport] || 'basketball';
  const tailColor = gradient[1];
  const showMultiSourceBadge = sourcePoiCount > 1;

  return (
    <View style={[
      markerStyles.container,
      isSelected && markerStyles.containerSelected,
    ]}>
      {/* pinHead wraps gradient + badge: badge must NOT live inside LinearGradient
          (it clips to rounded bounds and cuts off the count pill). */}
      <View style={markerStyles.pinHead}>
        <LinearGradient
          colors={gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            markerStyles.pinBody,
            isSelected && markerStyles.pinBodySelected,
            isFavorited && markerStyles.pinBodyFavorite,
          ]}
        >
          <MaterialCommunityIcons name={glyphName as any} size={20} color="white" />
        </LinearGradient>
        {isFavorited && (
          <View style={markerStyles.favoriteBadge} pointerEvents="none">
            <Ionicons name="heart" size={10} color="#fff" />
          </View>
        )}
        {/* Badge = number of map results merged (nearby POIs), NOT player count — avoid digit-only confusion */}
        {showMultiSourceBadge && (
          <View style={markerStyles.countBadge} pointerEvents="none">
            <MaterialCommunityIcons name="layers" size={12} color="white" style={{ marginRight: 1 }} />
            <Text style={markerStyles.countTextSm}>{sourcePoiCount}</Text>
          </View>
        )}
      </View>
      <View style={[markerStyles.pinTail, { borderTopColor: tailColor }]} />
    </View>
  );
});
MapMarker.displayName = 'MapMarker';

const markerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerSelected: {
    transform: [{ scale: 1.15 }],
  },
  pinHead: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pinBody: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  pinBodySelected: {
    borderWidth: 3,
    shadowOpacity: 0.42,
    shadowRadius: 7,
  },
  pinBodyFavorite: {
    borderColor: '#F472B6',
    borderWidth: 3,
  },
  favoriteBadge: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 3,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 2,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    minWidth: 22,
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  countText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  countTextSm: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});

// ============================================
// FACILITY CALLOUT COMPONENT
// ============================================

// Calculate distance between two coordinates in miles
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface FacilityCalloutProps {
  facility: Court | null;
  facilities: Court[];
  checkIns: CheckIn[];
  selectedSport: Sport | null;
  userLocation: { latitude: number; longitude: number } | null;
  favorites: Set<string>;
  onToggleFavorite: (facility: Court) => void;
  onSelectSport: (sport: Sport) => void;
  onSelectFacility: (facility: Court) => void;
  onCheckIn: (sport: Sport) => void;
  onSchedule: (sport: Sport) => void;
  onViewDetails: () => void;
  onClose: () => void;
  checkingIn: boolean;
  currentUserId?: string;
}

const FacilityCallout = ({
  facility,
  facilities,
  checkIns,
  selectedSport,
  userLocation,
  favorites,
  onToggleFavorite,
  onSelectSport,
  onSelectFacility,
  onCheckIn,
  onSchedule,
  onViewDetails,
  onClose,
  checkingIn,
  currentUserId,
}: FacilityCalloutProps) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  
  const isCluster = facilities.length > 1;
  const activeFacility = facility || facilities[0];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  if (!activeFacility) return null;

  const activeSport = selectedSport || (activeFacility.sports[0] as Sport);
  const sportConfig = SPORTS_CONFIG[activeSport];
  const totalPlayers = countUniquePlayersAtPlace(checkIns);
  const activeCheckIns = countUniquePlayersBySport(checkIns, activeSport);
  const showTotalAtSpotHint =
    totalPlayers > 0 && totalPlayers !== activeCheckIns;
  const myCheckIn = currentUserId
    ? checkIns.find(c => c.user_id === currentUserId)
    : undefined;
  const isCheckedInHereForThisSport = !!(myCheckIn && myCheckIn.sport === activeSport);

  return (
    <Animated.View
      style={[
        styles.calloutContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="light" style={styles.calloutBlur}>
        <View style={styles.callout}>
          {/* Handle bar */}
          <View style={styles.calloutHandle} />

          {/* Cluster selector */}
          {isCluster && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.clusterScroll}
              contentContainerStyle={styles.clusterScrollContent}
            >
              {facilities.map((f, index) => {
                const isActive = f.id === activeFacility.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.clusterItem, isActive && styles.clusterItemActive]}
                    onPress={() => onSelectFacility(f)}
                  >
                    <Text style={styles.clusterItemNumber}>{index + 1}</Text>
                    <Text style={[styles.clusterItemText, isActive && styles.clusterItemTextActive]} numberOfLines={1}>
                      {f.name.length > 18 ? f.name.slice(0, 18) + '...' : f.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Header */}
          <View style={styles.calloutHeader}>
            <View style={styles.calloutTitleContainer}>
              <Text style={styles.calloutTitle} numberOfLines={2}>
                {activeFacility.name}
              </Text>
              <View style={styles.calloutMeta}>
                {userLocation && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="location-outline" size={12} color="#6B7280" />
                    <Text style={styles.distanceText}>
                      {calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        activeFacility.latitude,
                        activeFacility.longitude
                      ).toFixed(1)} mi
                    </Text>
                  </View>
                )}
                <View style={styles.liveMetaColumn}>
                  {activeCheckIns > 0 ? (
                    <View style={styles.liveIndicator}>
                      <PulsingDot color="#22C55E" size={8} />
                      <Text style={styles.liveText}>
                        {activeCheckIns} playing · {sportConfig?.name || activeSport}
                      </Text>
                    </View>
                  ) : totalPlayers > 0 ? (
                    <View style={styles.liveIndicatorMuted}>
                      <View style={styles.liveDotMuted} />
                      <Text style={styles.liveTextMuted}>
                        0 playing · {sportConfig?.name || activeSport}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.emptyIndicatorText}>
                      🎯 Be first{activeFacility.sports.length > 1 ? ` (${sportConfig?.name || activeSport})` : ''}!
                    </Text>
                  )}
                  {showTotalAtSpotHint ? (
                    <Text style={styles.liveTotalHint}>
                      {totalPlayers} total at this spot
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => onToggleFavorite(activeFacility)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isCourtFavorited(activeFacility, favorites) ? 'heart' : 'heart-outline'}
                size={22}
                color={isCourtFavorited(activeFacility, favorites) ? '#EF4444' : '#999'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calloutCloseButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Sports Selector */}
          {activeFacility.sports.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sportsRow}
            >
              {activeFacility.sports.map((sport: string) => {
                const config = SPORTS_CONFIG[sport as Sport];
                const isSelected = activeSport === sport;
                const sportCheckIns = countUniquePlayersBySport(checkIns, sport as Sport);

                return (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles.sportChip,
                      isSelected && { backgroundColor: config?.color, borderColor: config?.color },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelectSport(sport as Sport);
                    }}
                  >
                    <Text style={styles.sportChipEmoji}>{config?.icon}</Text>
                    <Text
                      style={[
                        styles.sportChipText,
                        isSelected && { color: 'white', fontWeight: '700' },
                      ]}
                    >
                      {config?.name}
                    </Text>
                    <View
                      style={[
                        styles.sportChipBadge,
                        sportCheckIns === 0 && styles.sportChipBadgeZero,
                        isSelected &&
                          sportCheckIns > 0 && { backgroundColor: 'white' },
                        isSelected &&
                          sportCheckIns === 0 && styles.sportChipBadgeZeroSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sportChipBadgeText,
                          sportCheckIns === 0 && styles.sportChipBadgeTextZero,
                          isSelected &&
                            sportCheckIns > 0 && { color: config?.color },
                          isSelected &&
                            sportCheckIns === 0 && styles.sportChipBadgeTextZeroSelected,
                        ]}
                      >
                        {sportCheckIns}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Primary CTA - Check In */}
          <TouchableOpacity
            style={[
              styles.checkInCTA,
              (checkingIn || isCheckedInHereForThisSport) && styles.checkInCTADisabled,
            ]}
            onPress={() => {
              if (isCheckedInHereForThisSport) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onCheckIn(activeSport);
            }}
            disabled={checkingIn || isCheckedInHereForThisSport}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                checkingIn || isCheckedInHereForThisSport
                  ? (['#9CA3AF', '#6B7280'] as [string, string])
                  : (theme.gradient.colors as [string, string])
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkInGradient}
            >
              {checkingIn ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={isCheckedInHereForThisSport ? 'checkmark-circle' : 'location'}
                    size={24}
                    color="white"
                  />
                  <View style={styles.checkInTextContainer}>
                    <Text style={styles.checkInMainText}>
                      {isCheckedInHereForThisSport
                        ? "You're in"
                        : activeCheckIns > 0
                          ? `Join ${activeCheckIns} player${activeCheckIns > 1 ? 's' : ''}`
                          : 'Check In Here'}
                    </Text>
                    <Text style={styles.checkInSubText}>
                      {isCheckedInHereForThisSport
                        ? 'Already checked in for this sport'
                        : `for ${sportConfig?.name || activeSport}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                Haptics.selectionAsync();
                onSchedule(activeSport);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              <Text style={[styles.secondaryActionText, { color: '#3B82F6' }]}>Schedule</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                Haptics.selectionAsync();
                onViewDetails();
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.secondaryActionText}>Details</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                Haptics.selectionAsync();
                // Open in Apple/Google Maps
                const { latitude, longitude } = activeFacility;
                const url = Platform.select({
                  ios: `maps:0,0?q=${encodeURIComponent(activeFacility.name)}@${latitude},${longitude}`,
                  android: `geo:${latitude},${longitude}?q=${encodeURIComponent(activeFacility.name)}`,
                }) as string;
                Linking.canOpenURL(url).then((supported) => {
                  if (supported) {
                    Linking.openURL(url);
                  }
                });
              }}
            >
              <Ionicons name="navigate-outline" size={20} color="#6B7280" />
              <Text style={styles.secondaryActionText}>Navigate</Text>
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => {
                Haptics.selectionAsync();
                // Share facility
                Share.share({
                  message: `Check out ${activeFacility.name} on Ralli! Great spot for ${activeFacility.sports.join(', ')}.`,
                  title: activeFacility.name,
                });
              }}
            >
              <Ionicons name="share-outline" size={20} color="#6B7280" />
              <Text style={styles.secondaryActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

// ============================================
// MAIN MAP SCREEN
// ============================================

export default function MapScreen() {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const { user } = useAuth();
  const { setPresenceFromCheckIn, refreshActivePresence } = usePresence();
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const fetchGenerationRef = useRef(0);
  const courtsCountRef = useRef(0);

  // Core map state
  const [region, setRegion] = useState<MapRegion>(DEFAULT_MAP_REGION);
  const [courts, setCourts] = useState<Court[]>([]);
  courtsCountRef.current = courts.length;
  const [selectedSports, setSelectedSports] = useState<Sport[]>(SPORT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_SEARCH_RADIUS_METERS);

  // Search & UI state
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Court | null>(null);
  const [facilityCheckIns, setFacilityCheckIns] = useState<CheckIn[]>([]);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const { favorites, toggleFavorite } = useCourtFavorites();
  const [locationDenied, setLocationDenied] = useState(false);
  const [lastSearchCenter, setLastSearchCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  // Animation values
  const filterPanelAnim = useRef(new Animated.Value(0)).current;

  // Filter courts based on selected sports and search
  const filteredCourts = useMemo(() => {
    let filtered = courts;

    if (selectedSports.length > 0 && selectedSports.length < SPORT_FILTERS.length) {
      filtered = filtered.filter(court =>
        court.sports.some((sport: string) => selectedSports.includes(sport as Sport))
      );
    }

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(court =>
        court.name.toLowerCase().includes(searchLower) ||
        court.address.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [courts, selectedSports, searchText]);

  const regionForClustering = useDebouncedValue(region, CLUSTER_REGION_DEBOUNCE_MS);
  const regionClusterSafe = useMemo(
    () => clampRegionForClustering(regionForClustering),
    [regionForClustering]
  );
  const courtsInView = useMemo(
    () => filterCourtsInViewport(filteredCourts, regionClusterSafe, MAP_VIEWPORT_PADDING),
    [filteredCourts, regionClusterSafe]
  );
  const clusters = useMemo(() => {
    return clusterMarkers(courtsInView, regionClusterSafe, selectedSports);
  }, [courtsInView, regionClusterSafe, selectedSports]);

  const fetchRealTimeFacilities = useCallback(
    async (userLat: number, userLng: number, options: { merge?: boolean; sports?: Sport[] } = {}) => {
      if (!PlacesApiService.isConfigured()) {
        if (courtsCountRef.current === 0) {
          PlacesApiService.showConfigurationAlert();
        }
        return;
      }

      const gen = ++fetchGenerationRef.current;

      try {
        const online = await isOnline();
        if (!online) {
          if (courtsCountRef.current === 0) {
            Alert.alert('Offline', 'Connect to the internet to load nearby courts.');
          }
          return;
        }

        setLoading(true);
        const targetedSports = options.sports && options.sports.length < SPORT_FILTERS.length
          ? options.sports
          : undefined;
        const places = await PlacesApiService.searchNearbySportsFacilities(
          userLat,
          userLng,
          searchRadius,
          targetedSports
        );
        if (gen !== fetchGenerationRef.current) return;

        const realCourts = places.map(place => {
          const detectedSports = PlacesApiService.detectSportsFromPlace(place);
          return PlacesApiService.convertPlaceToCourtFormat(place, detectedSports);
        });

        const refForMerge = userLocation ?? { latitude: userLat, longitude: userLng };

        if (options.merge) {
          setCourts(prev => {
            const byId = new Map<string, Court>();
            for (const c of prev) byId.set(c.id, c);
            for (const c of realCourts) byId.set(c.id, c);
            const merged = Array.from(byId.values());
            return trimCourtsToNearestN(merged, refForMerge, MAX_MERGED_COURTS);
          });
        } else {
          setCourts(
            realCourts.length > MAX_MERGED_COURTS
              ? trimCourtsToNearestN(realCourts, { latitude: userLat, longitude: userLng }, MAX_MERGED_COURTS)
              : realCourts
          );
        }
        setLastSearchCenter({ latitude: userLat, longitude: userLng });
      } catch (error) {
        if (gen === fetchGenerationRef.current) {
          console.error('Error fetching facilities:', error);
          if (courtsCountRef.current === 0) {
            Alert.alert('Courts Unavailable', 'Could not load nearby courts. Check your connection and try again.');
          }
        }
      } finally {
        if (gen === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [searchRadius, userLocation]
  );

  const getCurrentLocation = async () => {
    const location = await LocationService.getCurrentLocation();
    if (location) {
      setLocationDenied(false);
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(newRegion);
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      mapRef.current?.animateToRegion(newRegion, 500);
    } else {
      setLocationDenied(true);
      await fetchRealTimeFacilities(
        DEFAULT_MAP_REGION.latitude,
        DEFAULT_MAP_REGION.longitude
      );
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchRealTimeFacilities(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, searchRadius, fetchRealTimeFacilities]);

  const toggleSportFilter = (sport: Sport) => {
    Haptics.selectionAsync();
    setSelectedSports(prev => {
      if (prev.includes(sport)) {
        // If removing, don't allow empty selection
        if (prev.length === 1) return SPORT_FILTERS;
        return prev.filter(s => s !== sport);
      }
      return [...prev, sport];
    });
  };

  const handleClusterPress = async (cluster: ClusterData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // If it's a single facility, select it directly
    if (cluster.courts.length === 1) {
      const court = cluster.courts[0];
      try {
        const list = await fetchCheckInsForPlaceGroup(getPlaceIdsForQueries(court));
        setFacilityCheckIns(list);
      } catch (error) {
        setFacilityCheckIns([]);
      }
      setSelectedCluster(cluster);
      setSelectedFacility(court);
    } else {
      // For clusters, zoom in or show cluster callout
      if (region.latitudeDelta > 0.02) {
        // Zoom in to cluster
        const newRegion = {
          latitude: cluster.latitude,
          longitude: cluster.longitude,
          latitudeDelta: region.latitudeDelta / 2,
          longitudeDelta: region.longitudeDelta / 2,
        };
        mapRef.current?.animateToRegion(newRegion, 300);
      } else {
        // Show cluster selection callout — always load check-ins for the default selected place
        const defaultCourt = cluster.courts[0];
        setSelectedCluster(cluster);
        setSelectedFacility(defaultCourt);
        try {
          const list = await fetchCheckInsForPlaceGroup(getPlaceIdsForQueries(defaultCourt));
          setFacilityCheckIns(list);
        } catch {
          setFacilityCheckIns([]);
        }
      }
    }
    setSelectedSport(null);
  };

  const handleQuickCheckIn = async (sport: Sport) => {
    if (!selectedFacility || !user) return;

    const placeLat = selectedFacility.latitude;
    const placeLng = selectedFacility.longitude;
    if (placeLat == null || placeLng == null) {
      Alert.alert('Error', 'This place has no coordinates for check-in.');
      return;
    }

    setCheckingIn(true);
    try {
      const loc = await LocationService.getCurrentLocation();
      if (!loc) {
        Alert.alert('Location Required', 'We could not get your location. Try again.');
        return;
      }
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

      if (
        !isWithinCheckInRadius(
          loc.coords.latitude,
          loc.coords.longitude,
          placeLat,
          placeLng
        )
      ) {
        Alert.alert(
          'Too Far Away',
          `You need to be within ${CHECK_IN_RADIUS_METERS} meters of the facility to check in.`
        );
        return;
      }

      const { data, error } = await checkInAtCourt({
        userId: user.id,
        googlePlaceId: selectedFacility.id,
        sport,
        userLatitude: loc.coords.latitude,
        userLongitude: loc.coords.longitude,
        placeLatitude: placeLat,
        placeLongitude: placeLng,
      });

      if (error || !data) {
        throw error || new Error('Check-in failed');
      }

      await CapacityService.updateCapacityOnCheckIn(selectedFacility.id, sport);

      setPresenceFromCheckIn({
        id: data.id,
        googlePlaceId: selectedFacility.id,
        placeLatitude: placeLat,
        placeLongitude: placeLng,
        sport,
      });
      void refreshActivePresence();

      let list = await fetchCheckInsForPlaceGroup(getPlaceIdsForQueries(selectedFacility));
      // If refetch misses the row (timing / filter mismatch), keep the RPC/insert return
      if (!list.some(c => c.id === data.id)) {
        list = [data as CheckIn, ...list.filter(c => c.user_id !== user.id)];
      }
      setFacilityCheckIns(list);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Checked In!',
        `You're now at ${selectedFacility.name} for ${SPORTS_CONFIG[sport]?.name || sport}!`,
        [{ text: 'Awesome!', onPress: () => closeCallout() }]
      );
    } catch (err) {
      console.error('Check-in', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err && typeof err === 'object' && 'message' in (err as any) ? (err as any).message : '';
      Alert.alert('Check-in Failed', msg || 'Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSchedule = (sport: Sport) => {
    if (!selectedFacility) return;
    navigation.navigate('CreateSession', {
      courtId: selectedFacility.id,
      sport,
      facilitySports: selectedFacility.sports.filter(isSport),
    });
    closeCallout();
  };

  const handleViewDetails = () => {
    if (!selectedFacility) return;
    navigation.navigate('CourtDetail', { courtId: selectedFacility.id });
    closeCallout();
  };

  const closeCallout = () => {
    setSelectedCluster(null);
    setSelectedFacility(null);
    setFacilityCheckIns([]);
    setSelectedSport(null);
  };

  /** Switching courts in a multi-court cluster must refetch check-ins for that place_id */
  const handleSelectFacilityForCallout = async (facility: Court) => {
    setSelectedFacility(facility);
    try {
      const list = await fetchCheckInsForPlaceGroup(getPlaceIdsForQueries(facility));
      setFacilityCheckIns(list);
    } catch {
      setFacilityCheckIns([]);
    }
  };

  const toggleFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = showFilters ? 0 : 1;
    Animated.spring(filterPanelAnim, {
      toValue,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
    setShowFilters(!showFilters);
  };

  const handleLocationPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await getCurrentLocation();
  };

  const metersToMiles = (meters: number) => meters / 1609.34;

  const allSportsSelected = selectedSports.length === SPORT_FILTERS.length;

  // "Search this area" button appears once the map center has moved more
  // than ~30% of the current search radius away from the last search.
  // This is the canonical pattern from Google Maps / Yelp and ensures urban
  // POIs that fall outside Google's top-20 distance-ranked results get found
  // when the user pans toward them.
  const showSearchThisArea = useMemo(() => {
    if (!lastSearchCenter || loading) return false;
    const distance = distanceMeters(
      { latitude: region.latitude, longitude: region.longitude },
      lastSearchCenter
    );
    return distance > Math.max(searchRadius * 0.3, 800);
  }, [region.latitude, region.longitude, lastSearchCenter, searchRadius, loading]);

  const handleSearchThisArea = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRealTimeFacilities(region.latitude, region.longitude, {
      merge: true,
      sports: selectedSports,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor={theme.colors.primary}
        loadingBackgroundColor="white"
        moveOnMarkerPress={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        onPress={() => closeCallout()}
      >
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={() => handleClusterPress(cluster)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
            calloutAnchor={{ x: 0.5, y: 0 }}
            stopPropagation={true}
          >
            <MapMarker
              cluster={cluster}
              isSelected={selectedCluster?.id === cluster.id}
              isFavorited={isCourtFavorited(cluster.courts[0], favorites)}
            />
          </Marker>
        ))}
      </MapView>

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search courts..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.locationBtn} onPress={handleLocationPress}>
            <Ionicons name="locate" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Sport Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sportPills}
        >
          {SPORT_FILTERS.map((sport) => {
            const config = SPORTS_CONFIG[sport];
            const isSelected = selectedSports.includes(sport);
            const isOnlyOne = selectedSports.length === 1 && isSelected;
            const glyph = SPORT_GLYPHS[sport];

            return (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportPill,
                  isSelected && { backgroundColor: config.color, borderColor: config.color },
                ]}
                onPress={() => toggleSportFilter(sport)}
                disabled={isOnlyOne}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name={glyph as any}
                  size={16}
                  color={isSelected ? 'white' : config.color}
                  style={styles.sportPillGlyph}
                />
                <Text style={[styles.sportPillText, isSelected && { color: 'white' }]}>
                  {config.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            {loading 
              ? 'Finding courts...' 
              : `${filteredCourts.length} court${filteredCourts.length === 1 ? '' : 's'} • ${metersToMiles(searchRadius).toFixed(1)} mi`}
          </Text>
          <TouchableOpacity onPress={toggleFilters} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.filterBtnText}>Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded Filter Panel */}
      <Animated.View
        style={[
          styles.filterPanel,
          {
            transform: [{
              translateY: filterPanelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-150, 0],
              }),
            }],
            opacity: filterPanelAnim,
          },
        ]}
        pointerEvents={showFilters ? 'auto' : 'none'}
      >
        <View style={styles.filterPanelContent}>
          <View style={styles.radiusSection}>
            <Text style={styles.radiusLabel}>Search Radius</Text>
            <Text style={styles.radiusValue}>{metersToMiles(searchRadius).toFixed(1)} miles</Text>
          </View>
          <Slider
            style={styles.radiusSlider}
            minimumValue={1609}
            maximumValue={16093}
            step={805}
            value={searchRadius}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor={theme.colors.primary}
            onSlidingComplete={(value) => setSearchRadius(Math.round(value))}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={toggleFilters}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Search this area (appears after panning) */}
      {showSearchThisArea && !selectedCluster && (
        <View style={styles.searchAreaWrap} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSearchThisArea}
            style={styles.searchAreaBtn}
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.searchAreaText}>Search this area</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Facility Callout */}
      {selectedCluster && (
        <FacilityCallout
          facility={selectedFacility}
          facilities={selectedCluster.courts}
          checkIns={facilityCheckIns}
          selectedSport={selectedSport}
          userLocation={userLocation}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectSport={setSelectedSport}
          onSelectFacility={handleSelectFacilityForCallout}
          onCheckIn={handleQuickCheckIn}
          onSchedule={handleSchedule}
          onViewDetails={handleViewDetails}
          onClose={closeCallout}
          checkingIn={checkingIn}
          currentUserId={user?.id}
        />
      )}

      {/* Location denied banner */}
      {locationDenied && !userLocation && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={18} color="#92400E" />
          <Text style={styles.locationBannerText}>
            Enable location to find courts near you
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={styles.locationBannerAction}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  map: {
    flex: 1,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...DesignTokens.shadow.md,
    zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportPills: {
    gap: 8,
    paddingRight: 8,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    gap: 6,
  },
  sportPillGlyph: {
    marginLeft: -2,
  },
  sportPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statsText: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },

  // Filter Panel
  filterPanel: {
    position: 'absolute',
    top: 180,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    ...DesignTokens.shadow.lg,
    zIndex: 99,
  },
  filterPanelContent: {
    padding: 16,
  },
  radiusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radiusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  radiusValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
  },
  radiusSlider: {
    width: '100%',
    height: 40,
  },
  applyBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },

  // Callout
  calloutContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
  },
  calloutBlur: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  callout: {
    padding: 20,
    paddingTop: 12,
  },
  calloutHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  clusterScroll: {
    marginBottom: 12,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  clusterScrollContent: {
    gap: 8,
  },
  clusterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    gap: 6,
  },
  clusterItemActive: {
    backgroundColor: '#3B82F6',
  },
  clusterItemNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9CA3AF',
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  clusterItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  clusterItemTextActive: {
    color: 'white',
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  calloutTitleContainer: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  liveMetaColumn: {
    flexShrink: 1,
    gap: 2,
  },
  liveIndicatorMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDotMuted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  liveTextMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  liveTotalHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyIndicatorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  calloutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  favoriteButton: {
    marginLeft: 8,
    padding: 4,
  },
  calloutCloseButton: {
    marginLeft: 4,
  },
  sportsRow: {
    gap: 8,
    marginBottom: 16,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  sportChipEmoji: {
    fontSize: 16,
  },
  sportChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  sportChipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 2,
  },
  sportChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  sportChipBadgeZero: {
    backgroundColor: '#E5E7EB',
  },
  sportChipBadgeZeroSelected: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  sportChipBadgeTextZero: {
    color: '#9CA3AF',
  },
  sportChipBadgeTextZeroSelected: {
    color: 'rgba(255,255,255,0.95)',
  },
  checkInCTA: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    ...DesignTokens.shadow.sm,
  },
  checkInCTADisabled: {
    opacity: 0.7,
  },
  checkInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  checkInTextContainer: {
    flex: 1,
  },
  checkInMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  checkInSubText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },

  // Loading
  loadingIndicator: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    ...DesignTokens.shadow.md,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  locationBanner: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    ...DesignTokens.shadow.md,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
  },
  locationBannerAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  searchAreaWrap: {
    position: 'absolute',
    top: 220,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  searchAreaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
    ...DesignTokens.shadow.lg,
  },
  searchAreaText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
