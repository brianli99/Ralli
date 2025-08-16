import { Alert } from 'react-native';
import { Court, Sport } from '../types';

// Get this from Google Cloud Console - Places API (New)
// Instructions: https://developers.google.com/maps/documentation/places/web-service/get-api-key
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';

// Validate configuration
if (!GOOGLE_PLACES_API_KEY) {
  console.warn('⚠️ Google Places API key missing. Please check your environment variables.');
  console.warn('Required: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
  console.warn('See GOOGLE_PLACES_SETUP.md for setup instructions.');
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
}

export class PlacesApiService {
  // Search for real sports facilities near user's location
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

    try {
      const sportKeywords = this.getSportSearchKeywords(sports);
      const allResults: PlaceResult[] = [];

      // Search for different types of sports facilities
      for (const keyword of sportKeywords.slice(0, 3)) { // Limit to 3 searches to avoid API limits
        const results = await this.searchNearbyPlaces(
          latitude,
          longitude,
          radiusMeters,
          keyword
        );
        allResults.push(...results);
        
        // Small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Remove duplicates based on id
      const uniqueResults = allResults.filter(
        (result, index, self) =>
          index === self.findIndex((r) => r.id === result.id)
      );

      // Filter out closed businesses
      return uniqueResults.filter(result => 
        result.businessStatus !== 'CLOSED_PERMANENTLY' &&
        result.businessStatus !== 'CLOSED_TEMPORARILY'
      );
    } catch (error) {
      console.error('Error searching sports facilities:', error);
      return [];
    }
  }

  // Search for places using Google Places API (New) - searchText
  private static async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    keyword: string
  ): Promise<PlaceResult[]> {
    try {
      const url = `${PLACES_BASE_URL}:searchText`;

      const requestBody = {
        textQuery: `${keyword} near me`,
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: {
              latitude: latitude,
              longitude: longitude
            },
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
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.currentOpeningHours,places.photos,places.businessStatus'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      return data.places || [];
    } catch (error) {
      console.error('Error in searchNearbyPlaces:', error);
      return [];
    }
  }

  // Get detailed information about a specific place
  static async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.isConfigured()) {
      console.warn('Places API not configured');
      return null;
    }

    try {
      const url = `${PLACES_BASE_URL}/${placeId}`;
      console.log('Fetching place details from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,nationalPhoneNumber,websiteUri,currentOpeningHours,rating,userRatingCount,reviews,photos'
        }
      });

      console.log('Place details response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Place Details API error: ${response.status}`, errorData);
        return null;
      }

      const data = await response.json();
      console.log('Place details received:', data.displayName?.text || 'No name');
      return data;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  // Get photo URL from photo name (new API format)
  static getPhotoUrl(photoName: string, maxWidth: number = 400): string {
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
  }

  // Convert Google Places result to our Court format (works with both PlaceResult and PlaceDetails)
  static convertPlaceToCourtFormat(place: PlaceResult | PlaceDetails, sports: Sport[]): Court {
    return {
      id: place.id,
      name: place.displayName.text,
      description: this.generateDescription(place, sports),
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      sports: sports,
      address: place.formattedAddress,
      amenities: this.extractAmenitiesFromTypes(place.types || [], place),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Generate a better description based on place data
  private static generateDescription(place: PlaceResult | PlaceDetails, sports: Sport[]): string {
    let description = `Real ${sports.join(', ')} facility`;
    
    if (place.rating) {
      description += ` • ${place.rating}⭐`;
    }
    
    if (place.currentOpeningHours?.openNow !== undefined) {
      description += place.currentOpeningHours.openNow ? ' • Open now' : ' • Closed';
    }
    
    return description;
  }

  // Get search keywords based on selected sports
  private static getSportSearchKeywords(sports?: Sport[]): string[] {
    const keywordMap: Record<Sport, string[]> = {
      basketball: ['basketball court', 'basketball gym', 'indoor court', 'sports center'],
      tennis: ['tennis court', 'tennis club', 'racquet club', 'country club', 'tennis center', 'racquetball club', 'athletic club', 'tennis facility'],
      pickleball: ['pickleball court', 'paddle court', 'recreation center', 'community center', 'sports complex'],
      volleyball: ['volleyball court', 'beach volleyball', 'sports complex', 'recreation center', 'indoor court'],
      running: ['running track', 'trail', 'track', 'jogging path', 'park', 'fitness trail', 'running path'],
      soccer: ['soccer field', 'football field', 'sports complex', 'park', 'athletic field', 'soccer pitch'],
    };

    if (!sports || sports.length === 0) {
      // Return a mix of popular keywords if no specific sports selected
      return ['recreation center', 'sports complex', 'gym', 'park', 'tennis court', 'basketball court'];
    }

    return sports.flatMap(sport => keywordMap[sport] || []);
  }

  // Extract amenities from Google Places types and data
  private static extractAmenitiesFromTypes(types: string[], place: PlaceResult | PlaceDetails): string[] {
    const amenities: string[] = [];
    
    const amenityMap: Record<string, string> = {
      'gym': 'Fitness facilities',
      'park': 'Outdoor space',
      'establishment': 'Established facility',
      'health': 'Health and wellness',
      'school': 'School facility',
      'university': 'University facility',
      'stadium': 'Large venue',
      'tourist_attraction': 'Popular destination',
    };

    // Add amenities based on types
    types.forEach(type => {
      if (amenityMap[type]) {
        amenities.push(amenityMap[type]);
      }
    });

    // Add amenities based on other data
    if (place.rating && place.rating >= 4.0) {
      amenities.push('Highly rated');
    }
    
    if (place.photos && place.photos.length > 0) {
      amenities.push('Photos available');
    }
    
    if (place.currentOpeningHours) {
      amenities.push('Operating hours available');
    }

    return amenities.length > 0 ? amenities : ['Sports facility'];
  }

  // Detect sports from place data (works with both PlaceResult and PlaceDetails)
  static detectSportsFromPlace(place: PlaceResult | PlaceDetails): Sport[] {
    const name = place.displayName.text.toLowerCase();
    const types = (place.types || []).join(' ').toLowerCase();
    const combined = `${name} ${types}`;
    
    const sports: Sport[] = [];
    
    // Enhanced sport detection with more keywords
    const sportKeywords = {
      basketball: ['basketball', 'hoops', 'indoor court'],
      tennis: ['tennis', 'racquet', 'racket', 'country club', 'athletic club'],
      pickleball: ['pickleball', 'paddle tennis', 'paddle court'],
      volleyball: ['volleyball', 'beach volleyball', 'sand volleyball'],
      soccer: ['soccer', 'football', 'futbol', 'pitch', 'field'],
      running: ['track', 'trail', 'running', 'jogging', 'path', 'marathon']
    };
    
    // Check for specific sport mentions
    Object.entries(sportKeywords).forEach(([sport, keywords]) => {
      if (keywords.some(keyword => combined.includes(keyword))) {
        sports.push(sport as Sport);
      }
    });
    
    // Enhanced facility type detection for multi-sport venues
    const facilityTypes = {
      'recreation center': ['basketball', 'volleyball', 'pickleball'],
      'sports complex': ['basketball', 'volleyball', 'soccer', 'tennis'],
      'community center': ['basketball', 'volleyball', 'pickleball'],
      'athletic club': ['tennis', 'basketball', 'volleyball'],
      'country club': ['tennis', 'running'],
      'ymca': ['basketball', 'volleyball', 'running'],
      'fitness center': ['basketball', 'running'],
      'park': ['running', 'soccer'],
      'stadium': ['soccer', 'running'],
      'school': ['basketball', 'soccer', 'tennis', 'running'],
      'university': ['basketball', 'soccer', 'tennis', 'running', 'volleyball']
    };
    
    // Add sports based on facility types
    Object.entries(facilityTypes).forEach(([facilityType, facilitySports]) => {
      if (combined.includes(facilityType)) {
        facilitySports.forEach(sport => {
          if (!sports.includes(sport as Sport)) {
            sports.push(sport as Sport);
          }
        });
      }
    });
    
    // Default fallbacks for common facility types
    if (sports.length === 0) {
      if (combined.includes('gym') || combined.includes('fitness')) {
        sports.push('basketball');
      } else if (types.includes('park')) {
        sports.push('running');
      } else if (combined.includes('court')) {
        sports.push('basketball', 'tennis'); // Generic court could be either
      } else {
        sports.push('basketball'); // Conservative default
      }
    }
    
    return [...new Set(sports)]; // Remove duplicates
  }

  // Check if API key is configured
  static isConfigured(): boolean {
    return GOOGLE_PLACES_API_KEY.length > 10 && 
           !GOOGLE_PLACES_API_KEY.includes('YOUR_GOOGLE_PLACES_API_KEY');
  }

  // Show configuration alert
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
