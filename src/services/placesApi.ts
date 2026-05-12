import { Alert } from 'react-native';
import { Court, Sport } from '../types';
import { isSport } from '../constants/sports';

// Google Places API (New) configuration
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const DETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_RESULT_LIMIT = 12;

const ALL_SPORTS_DISCOVERY_QUERIES = [
  'public sports courts',
  'sports complex',
  'recreation center sports',
  'park sports facilities',
];

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry<PlaceResult[]>>();
const searchInFlight = new Map<string, Promise<PlaceResult[]>>();
const detailsCache = new Map<string, CacheEntry<PlaceDetails | null>>();
const detailsInFlight = new Map<string, Promise<PlaceDetails | null>>();

if (!GOOGLE_PLACES_API_KEY) {
  console.warn('⚠️ Google Places API key missing. See GOOGLE_PLACES_SETUP.md for setup.');
}

export interface PlaceResult {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  types: string[];
  rating?: number;
  priceLevel?: string;
  currentOpeningHours?: {
    openNow: boolean;
  };
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: {
    text: string;
  };
}

export interface PlaceDetails {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: {
    openNow: boolean;
    periods: Array<{
      close: { day: number; hour: number; minute: number };
      open: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions: string[];
  };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    name: string;
    rating: number;
    text: {
      text: string;
      languageCode: string;
    };
    publishTime: string;
  }>;
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
  primaryType?: string;
  primaryTypeDisplayName?: {
    text: string;
  };
}

// ============================================
// SPORT CONFIGURATION - Comprehensive for all 6 sports
// ============================================

interface SportConfig {
  // Search queries to find this sport's facilities
  searchQueries: string[];
  // Keywords that MUST appear in name for high confidence
  strongNameKeywords: string[];
  // Keywords that suggest this sport (medium confidence)
  weakNameKeywords: string[];
  // Google place types that indicate this sport
  validTypes: string[];
  // Types that should exclude this sport (unless name explicitly mentions it)
  excludeTypes: string[];
  // Known chain/brand names for this sport
  knownBrands: string[];
}

const SPORT_CONFIGS: Record<Sport, SportConfig> = {
  // ============================================
  // 🏀 BASKETBALL
  // ============================================
  basketball: {
    searchQueries: [
      'basketball court',
      'basketball gym',
      'recreation center basketball',
      'outdoor basketball',
      'public basketball court',
    ],
    strongNameKeywords: [
      'basketball',
      'hoops',
      'b-ball',
    ],
    weakNameKeywords: [
      'rec center',
      'recreation center',
      'community center',
      'sports center',
      'ymca',
      'y.m.c.a',
      'jcc',
      'boys and girls club',
      'athletic club',
    ],
    validTypes: [
      'basketball_court',
      'sports_complex',
      'recreation_center',
      'community_center',
    ],
    excludeTypes: [
      'gym',
      'fitness_center',
      'health_club',
      'yoga_studio',
      'pilates_studio',
    ],
    knownBrands: [
      'lifetime fitness', // Has basketball courts
      '24 hour fitness', // Some have courts - check name carefully
    ],
  },

  // ============================================
  // 🎾 TENNIS
  // ============================================
  tennis: {
    searchQueries: [
      'tennis court',
      'tennis club',
      'public tennis courts',
      'tennis center',
      'tennis academy',
    ],
    strongNameKeywords: [
      'tennis',
      'racquet club',
      'racket club',
      'paddle tennis',
    ],
    weakNameKeywords: [
      'country club',
      'athletic club',
      'swim and tennis',
      'tennis & swim',
    ],
    validTypes: [
      'tennis_court',
      'tennis_club',
      'sports_club',
      'country_club',
    ],
    excludeTypes: [
      'gym',
      'fitness_center',
    ],
    knownBrands: [
      'usta',
      'head',
      'wilson tennis',
    ],
  },

  // ============================================
  // 🏓 PICKLEBALL
  // ============================================
  pickleball: {
    searchQueries: [
      'pickleball court',
      'pickleball club',
      'public pickleball',
      'pickleball center',
    ],
    strongNameKeywords: [
      'pickleball',
      'pickle ball',
      'pickball',
    ],
    weakNameKeywords: [
      'paddle sports',
      'racquet sports',
    ],
    validTypes: [
      'sports_complex',
      'recreation_center',
      'community_center',
    ],
    excludeTypes: [
      'gym',
      'fitness_center',
    ],
    knownBrands: [
      'pickleballers',
      'dink',
    ],
  },

  // ============================================
  // 🏐 VOLLEYBALL
  // ============================================
  volleyball: {
    searchQueries: [
      'volleyball court',
      'beach volleyball',
      'sand volleyball',
      'indoor volleyball',
      'volleyball club',
    ],
    strongNameKeywords: [
      'volleyball',
      'volley ball',
      'beach volleyball',
      'sand volleyball',
      'vball',
    ],
    weakNameKeywords: [
      'beach club',
      'sand court',
    ],
    validTypes: [
      'volleyball_court',
      'beach',
      'sports_complex',
      'recreation_center',
    ],
    excludeTypes: [
      'gym',
      'fitness_center',
    ],
    knownBrands: [
      'avp',
      'usa volleyball',
    ],
  },

  // ============================================
  // ⚽ SOCCER
  // ============================================
  soccer: {
    searchQueries: [
      'soccer field',
      'soccer complex',
      'futsal court',
      'public soccer field',
      'soccer pitch',
    ],
    strongNameKeywords: [
      'soccer',
      'futsal',
      'fútbol',
      'futbol',
      'football field', // Note: check context - could be American football
      'fc ', // Football club
      ' fc',
      'united fc',
    ],
    weakNameKeywords: [
      'athletic field',
      'sports field',
      'playing field',
      'turf field',
    ],
    validTypes: [
      'soccer_field',
      'sports_complex',
      'athletic_field',
      'stadium',
    ],
    excludeTypes: [
      'gym',
      'fitness_center',
      'american_football_field',
    ],
    knownBrands: [
      'ayso',
      'youth soccer',
      'mls',
    ],
  },

  // ============================================
  // 🏸 BADMINTON
  // ============================================
  badminton: {
    searchQueries: [
      'badminton court',
      'badminton club',
      'badminton center',
    ],
    strongNameKeywords: [
      'badminton',
      'shuttlecock',
    ],
    weakNameKeywords: [
      'racquet',
      'racket club',
    ],
    validTypes: [
      'sports_complex',
      'gym',
      'community_center',
    ],
    excludeTypes: [],
    knownBrands: [],
  },
};

// ============================================
// HARD EXCLUSIONS - These types are NEVER sports facilities
// ============================================

const EXCLUDED_PLACE_TYPES = [
  // Food & Drink
  'restaurant',
  'food',
  'cafe',
  'coffee_shop',
  'bakery',
  'bar',
  'night_club',
  'meal_delivery',
  'meal_takeaway',
  'fast_food_restaurant',
  'fine_dining_restaurant',
  'chinese_restaurant',
  'italian_restaurant',
  'japanese_restaurant',
  'mexican_restaurant',
  'pizza_restaurant',
  'seafood_restaurant',
  'steak_house',
  'sushi_restaurant',
  'vietnamese_restaurant',
  'thai_restaurant',
  'indian_restaurant',
  'american_restaurant',
  'korean_restaurant',
  'ramen_restaurant',
  'brunch_restaurant',
  'hamburger_restaurant',
  'ice_cream_shop',
  'dessert_shop',
  'juice_shop',
  'tea_house',
  
  // Retail & Shopping
  'store',
  'shopping_mall',
  'department_store',
  'clothing_store',
  'shoe_store',
  'jewelry_store',
  'electronics_store',
  'furniture_store',
  'home_goods_store',
  'supermarket',
  'grocery_store',
  'convenience_store',
  'liquor_store',
  'book_store',
  'pet_store',
  'hardware_store',
  'sporting_goods_store',
  
  // Services & Professional
  'hair_salon',
  'beauty_salon',
  'spa',
  'barber_shop',
  'bank',
  'atm',
  'lawyer',
  'accountant',
  'insurance_agency',
  'real_estate_agency',
  'car_dealer',
  'car_rental',
  'car_repair',
  'car_wash',
  'gas_station',
  'laundry',
  'dry_cleaner',
  
  // Medical & Health (non-sports)
  'doctor',
  'dentist',
  'hospital',
  'pharmacy',
  'veterinary_care',
  'physiotherapist',
  
  // Accommodation
  'hotel',
  'motel',
  'lodging',
  'bed_and_breakfast',
  
  // Religious
  'church',
  'mosque',
  'synagogue',
  'hindu_temple',
  'buddhist_temple',
  'place_of_worship',
  
  // Entertainment (non-sports)
  'movie_theater',
  'casino',
  'amusement_park',
  'bowling_alley',
  'art_gallery',
  'museum',
  'library',
  
  // Transportation
  'airport',
  'bus_station',
  'subway_station',
  'train_station',
  'taxi_stand',
  
  // Office & Government
  'local_government_office',
  'post_office',
  'police',
  'fire_station',
  
  // NOTE: Do NOT include 'point_of_interest', 'establishment', 'parking', 
  // 'school', 'university' - these are generic types Google adds to many
  // legitimate sports facilities like athletic fields at schools/parks
];

// ============================================
// GENERIC GYM DETECTION - Exclude these from sports
// ============================================

const GENERIC_GYM_INDICATORS = [
  // Major gym chains
  'planet fitness',
  'gold\'s gym',
  'golds gym',
  'equinox',
  'la fitness',
  'anytime fitness',
  'orangetheory',
  'orange theory',
  'crossfit',
  'f45',
  'barry\'s',
  'barrys',
  'soulcycle',
  'peloton',
  'crunch fitness',
  'crunch gym',
  'snap fitness',
  'fitness 19',
  'chuze fitness',
  'eos fitness',
  'xsport',
  'blink fitness',
  'retro fitness',
  'workout anytime',
  'youfit',
  
  // Generic gym terms (without sport context)
  'personal training',
  'weight room',
  'weightlifting',
  'bodybuilding',
  'powerlifting',
  'spinning',
  'yoga studio',
  'pilates',
  'barre',
  'bootcamp',
  'hiit',
];

export class PlacesApiService {
  private static getSearchCacheKey(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    sports?: Sport[]
  ): string {
    const roundedLat = Math.round(latitude * 200) / 200;
    const roundedLng = Math.round(longitude * 200) / 200;
    const radiusBucket = Math.round(radiusMeters / 1000) * 1000;
    const sportKey = sports?.length ? [...sports].sort().join(',') : 'all';
    return `${roundedLat}:${roundedLng}:${radiusBucket}:${sportKey}`;
  }

  private static getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private static setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  
  // ============================================
  // MAIN SEARCH FUNCTION
  // ============================================
  
  static async searchNearbySportsFacilities(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
    sports?: Sport[]
  ): Promise<PlaceResult[]> {
    if (!this.isConfigured()) {
      console.warn('Google Places API not configured');
      return [];
    }

    const cacheKey = this.getSearchCacheKey(latitude, longitude, radiusMeters, sports);
    const cached = this.getCached(searchCache, cacheKey);
    if (cached) return cached;

    const inFlight = searchInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const searchPromise = this.performSportsFacilitiesSearch(latitude, longitude, radiusMeters, sports);
    searchInFlight.set(cacheKey, searchPromise);

    try {
      const results = await searchPromise;
      this.setCached(searchCache, cacheKey, results, SEARCH_CACHE_TTL_MS);
      return results;
    } finally {
      searchInFlight.delete(cacheKey);
    }
  }

  private static async performSportsFacilitiesSearch(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    sports?: Sport[]
  ): Promise<PlaceResult[]> {
    try {
      // Default to all sports if none specified
      const targetSports: Sport[] = sports && sports.length > 0 
        ? sports 
        : ['basketball', 'tennis', 'pickleball', 'volleyball', 'soccer', 'badminton'];
      
      const allResults: PlaceResult[] = [];
      const seenIds = new Set<string>();

      // Track per-place: which sports it should be tagged with based on which
      // search queries Google returned it for. We trust Google's index here:
      // if Google returns "Stead Park" for the query "basketball court", that
      // park almost certainly has basketball.
      const sportAttributionByPlace = new Map<string, Set<Sport>>();

      // All-sports discovery uses broad queries to keep initial map load cheap.
      // Sport-specific queries are reserved for manual targeted searches.
      if (!sports || sports.length === 0 || sports.length === 6) {
        for (const query of ALL_SPORTS_DISCOVERY_QUERIES) {
          const results = await this.searchNearbyPlaces(latitude, longitude, radiusMeters, query);

          for (const result of results) {
            if (!result.displayName?.text || !result.location?.latitude || !result.location?.longitude) {
              continue;
            }
            if (this.isExcludedPlaceType(result) || this.isGenericGym(result)) {
              continue;
            }

            const detectedSports = this.detectSportsFromPlace(result);
            const sportSet = sportAttributionByPlace.get(result.id) || new Set<Sport>();
            for (const sport of detectedSports.length > 0 ? detectedSports : targetSports.slice(0, 1)) {
              sportSet.add(sport);
            }
            sportAttributionByPlace.set(result.id, sportSet);

            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              allResults.push(result);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 80));
        }
      } else {
        for (const sport of targetSports) {
          const config = SPORT_CONFIGS[sport];
          if (!config) continue;

          const queriesToRun = config.searchQueries.slice(0, targetSports.length === 1 ? 2 : 1);
          for (const query of queriesToRun) {
            const results = await this.searchNearbyPlaces(latitude, longitude, radiusMeters, query);

            for (const result of results) {
              // Skip places missing essential data (bad API responses)
              if (!result.displayName?.text || !result.location?.latitude || !result.location?.longitude) {
                continue;
              }

              // Skip non-sports place types (restaurants, stores, etc.)
              if (this.isExcludedPlaceType(result)) {
                continue;
              }

              // Skip generic gyms
              if (this.isGenericGym(result)) {
                continue;
              }

              // Trust Google's text search: tag this place with the searched sport.
              // Our detection layer can still add other sports on top of this.
              const sportSet = sportAttributionByPlace.get(result.id) || new Set<Sport>();
              sportSet.add(sport);
              sportAttributionByPlace.set(result.id, sportSet);

              if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                allResults.push(result);
              }
            }

            // Rate limit protection between API calls
            await new Promise(resolve => setTimeout(resolve, 80));
          }
        }
      }

      // Stamp the search-attributed sports onto each result so downstream
      // conversion (convertPlaceToCourtFormat) can use them.
      for (const r of allResults) {
        const attributed = sportAttributionByPlace.get(r.id);
        if (attributed && attributed.size > 0) {
          (r as any)._inferredSports = Array.from(attributed);
        }
      }

      // Filter out closed businesses
      return allResults.filter(result => 
        result.businessStatus !== 'CLOSED_PERMANENTLY' &&
        result.businessStatus !== 'CLOSED_TEMPORARILY'
      );
    } catch (error) {
      console.error('Error searching sports facilities:', error);
      return [];
    }
  }

  private static async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    keyword: string
  ): Promise<PlaceResult[]> {
    try {
      const url = `${PLACES_BASE_URL}:searchText`;

      const requestBody = {
        textQuery: keyword,
        maxResultCount: SEARCH_RESULT_LIMIT,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius: radiusMeters
          }
        },
        rankPreference: 'DISTANCE'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.primaryType,places.primaryTypeDisplayName'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Places API error: ${response.status}`, errorData);
        return [];
      }

      const data = await response.json();
      return data.places || [];
    } catch (error) {
      console.error('Error in searchNearbyPlaces:', error);
      return [];
    }
  }

  // ============================================
  // EXCLUDED PLACE TYPE DETECTION
  // ============================================

  private static isExcludedPlaceType(place: PlaceResult | PlaceDetails): boolean {
    const types = (place.types || []).map(t => t.toLowerCase());
    const primaryType = place.primaryType?.toLowerCase() || '';
    const name = (place.displayName?.text || '').toLowerCase();

    // DIRECT-NAME-MATCH GUARANTEE:
    // If a place's name explicitly contains a strong sport keyword
    // (e.g. "Basketball Court", "Tennis Court", "Pickleball Court"),
    // it is by definition a sports facility — never exclude it,
    // regardless of what types Google has tagged it with.
    if (this.hasDirectSportNameMatch(name)) {
      return false;
    }

    // Check if primary type is excluded
    if (EXCLUDED_PLACE_TYPES.includes(primaryType)) {
      return true;
    }

    // Check if any type is excluded
    for (const type of types) {
      if (EXCLUDED_PLACE_TYPES.includes(type)) {
        return true;
      }
    }

    // Also check for restaurant/food indicators in name
    // But be careful - only match if it's clearly a food establishment
    const foodIndicators = [
      'restaurant', 'cafe', 'coffee shop', 'diner', 'bistro',
      'eatery', 'kitchen', 'deli', 'bakery', 'pizzeria', 'taqueria',
      'sushi', 'ramen house', 'noodle house', 'pho', 'steakhouse',
      'buffet', 'food court', 'cantina', 'tavern', 'pub ', 'brewery',
      'winery', 'hookah', 'karaoke', 'nightclub',
    ];

    for (const indicator of foodIndicators) {
      if (name.includes(indicator)) {
        // Exception: sports-related terms take precedence
        const sportsTerms = ['tennis', 'athletic', 'sports', 'swim', 'racquet', 'fitness', 'golf', 'country club', 'basketball', 'soccer', 'volleyball', 'field', 'court', 'gym', 'recreation', 'rec center'];
        const hasSportsTerm = sportsTerms.some(term => name.includes(term));
        if (!hasSportsTerm) {
          return true;
        }
      }
    }

    const storeIndicators = [
      'store', 'shop', 'mart', 'outlet', 'retail', 'mall', 'market',
      'boutique', 'gallery', 'salon', 'spa', 'barber',
    ];

    for (const indicator of storeIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'i');
      if (regex.test(name) && !name.includes('pro shop')) {
        return true;
      }
    }

    return false;
  }

  // ============================================
  // GENERIC GYM DETECTION
  // ============================================

  // Direct-name-match: place name explicitly mentions a sport (e.g. "Basketball Court")
  private static hasDirectSportNameMatch(lowercaseName: string): boolean {
    if (!lowercaseName) return false;
    for (const config of Object.values(SPORT_CONFIGS)) {
      for (const kw of config.strongNameKeywords) {
        if (lowercaseName.includes(kw)) return true;
      }
    }
    return false;
  }

  private static isGenericGym(place: PlaceResult | PlaceDetails): boolean {
    const name = (place.displayName?.text || '').toLowerCase();
    const types = (place.types || []).map(t => t.toLowerCase());
    const primaryType = place.primaryType?.toLowerCase() || '';

    // DIRECT-NAME-MATCH GUARANTEE: if name says "basketball court" / "tennis court"
    // etc., never treat it as a generic gym.
    if (this.hasDirectSportNameMatch(name)) {
      return false;
    }

    // Check if it's a known generic gym chain
    for (const indicator of GENERIC_GYM_INDICATORS) {
      if (name.includes(indicator)) {
        // Exception: if name also includes a sport, it might be valid
        const hasSportKeyword = Object.values(SPORT_CONFIGS).some(config =>
          config.strongNameKeywords.some(kw => name.includes(kw))
        );
        if (!hasSportKeyword) {
          return true;
        }
      }
    }

    // Check Google's type classification
    const gymTypes = ['gym', 'fitness_center', 'health_club'];
    const isTypedAsGym = gymTypes.includes(primaryType) || 
                         types.some(t => gymTypes.includes(t));

    if (isTypedAsGym) {
      // Only exclude if name doesn't mention a specific sport
      const hasSportInName = Object.values(SPORT_CONFIGS).some(config =>
        config.strongNameKeywords.some(kw => name.includes(kw))
      );
      return !hasSportInName;
    }

    return false;
  }

  // ============================================
  // ACCURATE SPORT DETECTION
  // ============================================

  static detectSportsFromPlace(place: PlaceResult | PlaceDetails): Sport[] {
    const detectedSports: Sport[] = [];
    const displayText = place.displayName?.text || '';
    if (!displayText) return [];
    const name = displayText.toLowerCase();
    const types = (place.types || []).map(t => t.toLowerCase());
    const primaryType = place.primaryType?.toLowerCase() || '';

    // Sports already attributed by the search layer (Google text-search trust)
    const inferredFromSearch: Sport[] = (place as any)._inferredSports || [];

    // FIRST: Hard exclusion for non-sports place types (restaurants, stores, etc.)
    if (this.isExcludedPlaceType(place)) {
      return [];
    }

    // Skip generic gyms entirely
    if (this.isGenericGym(place)) {
      return [];
    }

    // Check each sport
    for (const [sport, config] of Object.entries(SPORT_CONFIGS) as [Sport, SportConfig][]) {
      let confidence = 0;

      // HIGH CONFIDENCE: Strong name keyword match
      if (config.strongNameKeywords.some(kw => name.includes(kw))) {
        confidence += 3;
      }

      // MEDIUM CONFIDENCE: Valid Google type match
      if (config.validTypes.some(t => types.includes(t) || primaryType === t)) {
        confidence += 2;
      }

      // LOW CONFIDENCE: Weak name keyword match
      if (config.weakNameKeywords.some(kw => name.includes(kw))) {
        confidence += 1;
      }

      // BONUS: Known brand match
      if (config.knownBrands.some(brand => name.includes(brand))) {
        confidence += 2;
      }

      // PENALTY: Exclude type present (unless strong keyword)
      if (config.excludeTypes.some(t => types.includes(t) || primaryType === t)) {
        if (confidence < 3) {
          confidence = 0;
        }
      }

      // Add sport if confidence threshold met
      if (confidence >= 2) {
        detectedSports.push(sport);
      }
    }

    // ============================================
    // FACILITY TYPE INFERENCE (only if no sports detected)
    // ============================================

    if (detectedSports.length === 0) {
      // Recreation centers typically have basketball
      const isRecCenter = 
        name.includes('recreation center') ||
        name.includes('rec center') ||
        name.includes('community center') ||
        name.includes('ymca') ||
        name.includes('y.m.c.a') ||
        name.includes('jcc') ||
        name.includes('jewish community center') ||
        name.includes('boys and girls club') ||
        primaryType === 'community_center' ||
        primaryType === 'recreation_center';

      if (isRecCenter) {
        detectedSports.push('basketball');
        // Many rec centers also have volleyball
        if (name.includes('gym') || name.includes('gymnasium')) {
          detectedSports.push('volleyball');
        }
      }

      // Parks: infer court/field sports from name signals only (no generic "running" tag).
      const isPark =
        types.includes('park') ||
        primaryType === 'park' ||
        name.includes(' park') ||
        name.endsWith('park');

      if (isPark && !isRecCenter) {
        if (name.includes('field') || name.includes('athletic') || name.includes('sports') || name.includes('soccer')) {
          detectedSports.push('soccer');
        }
        if (name.includes('basketball') || name.includes('court')) {
          detectedSports.push('basketball');
        }
        if (name.includes('tennis')) {
          detectedSports.push('tennis');
        }
        if (name.includes('playground') || name.includes('rec ')) {
          detectedSports.push('basketball');
        }
      }

      // Playgrounds in dense urban areas commonly have basketball half-courts
      const isPlayground =
        types.includes('playground') ||
        primaryType === 'playground' ||
        name.includes('playground');

      if (isPlayground && !isPark) {
        detectedSports.push('basketball');
      }

      // Sports complexes - need to infer from name
      const isSportsComplex = 
        name.includes('sports complex') ||
        name.includes('athletic complex') ||
        name.includes('sportsplex') ||
        name.includes('fieldhouse') ||
        primaryType === 'sports_complex';

      if (isSportsComplex) {
        // Check for specific clues
        if (name.includes('field') || name.includes('pitch') || name.includes('turf')) {
          detectedSports.push('soccer');
        }
        if (name.includes('court')) {
          detectedSports.push('basketball');
          detectedSports.push('tennis');
        }
        // If still empty, default to multi-sport
        if (detectedSports.length === 0) {
          detectedSports.push('basketball', 'soccer');
        }
      }

      // Country clubs - typically tennis
      const isCountryClub = 
        name.includes('country club') ||
        name.includes('swim club') ||
        name.includes('swim & tennis') ||
        name.includes('swim and tennis');

      if (isCountryClub) {
        detectedSports.push('tennis');
      }

      // Athletic fields - soccer (tracks no longer tagged as running)
      const isAthleticField =
        name.includes('athletic field') ||
        name.includes('sports field') ||
        name.includes('playing field') ||
        primaryType === 'athletic_field';

      if (isAthleticField) {
        detectedSports.push('soccer');
      }

      // Beach - volleyball
      const isBeach =
        types.includes('beach') ||
        primaryType === 'beach' ||
        name.includes('beach');

      if (isBeach) {
        detectedSports.push('volleyball');
      }
    }

    // Merge in sports that were attributed by Google's text search layer.
    // This is what makes urban parks like Stead Park show up under basketball/
    // tennis/etc. — Google's index already knows the association.
    // We *prepend* these (rather than append) because Google's text-search
    // attribution is more authoritative than our park / playground fallback
    // inference, so the displaySport for clusters should prefer them.
    const finalOrder: Sport[] = [];
    for (const sport of inferredFromSearch) {
      if (!finalOrder.includes(sport)) finalOrder.push(sport);
    }
    for (const sport of detectedSports) {
      if (!finalOrder.includes(sport)) finalOrder.push(sport);
    }
    return finalOrder.filter(isSport);
  }

  // ============================================
  // PLACE DETAILS
  // ============================================

  static async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.isConfigured()) {
      console.warn('Places API not configured');
      return null;
    }

    const cached = this.getCached(detailsCache, placeId);
    if (cached !== null) return cached;

    const inFlight = detailsInFlight.get(placeId);
    if (inFlight) return inFlight;

    const detailsPromise = this.fetchPlaceDetails(placeId);
    detailsInFlight.set(placeId, detailsPromise);

    try {
      const details = await detailsPromise;
      this.setCached(detailsCache, placeId, details, DETAILS_CACHE_TTL_MS);
      return details;
    } finally {
      detailsInFlight.delete(placeId);
    }
  }

  private static async fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const url = `${PLACES_BASE_URL}/${placeId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,nationalPhoneNumber,websiteUri,currentOpeningHours,rating,userRatingCount,photos,primaryType,primaryTypeDisplayName'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Place Details API error: ${response.status}`, errorData);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  static getPhotoUrl(photoName: string, maxWidth: number = 400): string {
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
  }

  static convertPlaceToCourtFormat(place: PlaceResult | PlaceDetails, sports: Sport[]): Court {
    const raw = sports.length > 0 ? sports : this.detectSportsFromPlace(place);
    const finalSports = raw.filter(isSport);
    const types = (place.types || []).map(t => t.toLowerCase());
    const primaryType = (place.primaryType || types[0] || '')?.toLowerCase();

    return {
      id: place.id,
      name: place.displayName?.text || 'Unnamed facility',
      description: this.generateDescription(place, finalSports),
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
      sports: finalSports.length > 0 ? finalSports : ['basketball'], // Fallback
      address: place.formattedAddress || '',
      amenities: this.extractAmenities(place),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      primaryType: primaryType || undefined,
      types: types.length > 0 ? types : undefined,
    };
  }

  private static generateDescription(place: PlaceResult | PlaceDetails, sports: Sport[]): string {
    const parts: string[] = [];
    
    if (place.primaryTypeDisplayName?.text) {
      parts.push(place.primaryTypeDisplayName.text);
    }
    
    if (place.rating) {
      parts.push(`${place.rating}⭐`);
    }
    
    if (place.currentOpeningHours?.openNow !== undefined) {
      parts.push(place.currentOpeningHours.openNow ? 'Open now' : 'Closed');
    }
    
    return parts.join(' • ') || `${sports.join(', ')} facility`;
  }

  private static extractAmenities(place: PlaceResult | PlaceDetails): string[] {
    const amenities: string[] = [];
    const types = place.types || [];
    
    const typeAmenityMap: Record<string, string> = {
      'parking': 'Parking available',
      'wheelchair_accessible_entrance': 'Wheelchair accessible',
      'restroom': 'Restrooms',
    };

    types.forEach(type => {
      if (typeAmenityMap[type]) {
        amenities.push(typeAmenityMap[type]);
      }
    });

    if (place.rating && place.rating >= 4.0) {
      amenities.push('Highly rated');
    }
    
    if (place.photos && place.photos.length > 0) {
      amenities.push('Photos available');
    }

    return amenities.length > 0 ? amenities : ['Sports facility'];
  }

  static isConfigured(): boolean {
    return GOOGLE_PLACES_API_KEY.length > 10 && 
           !GOOGLE_PLACES_API_KEY.includes('YOUR_GOOGLE_PLACES_API_KEY');
  }

  static showConfigurationAlert(): void {
    Alert.alert(
      'Google Places API Setup Required',
      'To show real sports facilities near you:\n\n' +
      '1. Get a Google Places API key from Google Cloud Console\n' +
      '2. Enable the Places API (New)\n' +
      '3. Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env file\n' +
      '4. Restart the Expo development server\n\n' +
      'See GOOGLE_PLACES_SETUP.md for detailed instructions.',
      [{ text: 'OK' }]
    );
  }
}
