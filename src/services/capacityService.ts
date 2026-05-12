import { supabase } from './supabase';

export type OccupancyLevel = 'low' | 'medium' | 'high' | 'full';

export interface FacilityCapacity {
  id: string;
  google_place_id: string; // Changed from facility_id to google_place_id
  sport: string;
  current_players: number;
  max_capacity: number;
  last_updated: string;
}

export interface CapacityReport {
  googlePlaceId: string; // Changed from facilityId to googlePlaceId
  sport: string;
  occupancyLevel: 'low' | 'medium' | 'high' | 'full';
  notes?: string;
}

export class CapacityService {
  // Get capacity for a specific facility and sport
  static async getCapacityForFacility(googlePlaceId: string, sport: string): Promise<FacilityCapacity | null> {
    try {
      const { data, error } = await supabase
        .from('facility_capacity')
        .select('*')
        .eq('google_place_id', googlePlaceId)
        .eq('sport', sport)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error getting capacity:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCapacityForFacility:', error);
      return null;
    }
  }

  // Get capacities for multiple facilities
  static async getCapacitiesForFacilities(googlePlaceIds: string[]): Promise<Record<string, FacilityCapacity>> {
    if (googlePlaceIds.length === 0) return {};

    try {
      const { data, error } = await supabase
        .from('facility_capacity')
        .select('*')
        .in('google_place_id', googlePlaceIds);

      if (error) {
        console.error('Error getting capacities:', error);
        return {};
      }

      // Group by google_place_id and sport
      const capacitiesMap: Record<string, FacilityCapacity> = {};
      
      data?.forEach(capacity => {
        const key = `${capacity.google_place_id}_${capacity.sport}`;
        capacitiesMap[key] = capacity;
      });

      return capacitiesMap;
    } catch (error) {
      console.error('Error in getCapacitiesForFacilities:', error);
      return {};
    }
  }

  // Update capacity when someone checks in
  static async updateCapacityOnCheckIn(googlePlaceId: string, sport: string): Promise<boolean> {
    try {
      // First, try to get existing capacity record
      const existing = await this.getCapacityForFacility(googlePlaceId, sport);
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('facility_capacity')
          .update({
            current_players: existing.current_players + 1,
            last_updated: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating capacity:', error);
          return false;
        }
      } else {
        // Create new capacity record
        const { error } = await supabase
          .from('facility_capacity')
          .insert({
            google_place_id: googlePlaceId,
            sport: sport,
            current_players: 1,
            max_capacity: this.getDefaultMaxCapacity(sport),
            last_updated: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating capacity:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in updateCapacityOnCheckIn:', error);
      return false;
    }
  }

  // Update capacity when someone checks out
  static async updateCapacityOnCheckOut(googlePlaceId: string, sport: string): Promise<boolean> {
    try {
      const existing = await this.getCapacityForFacility(googlePlaceId, sport);
      
      if (existing && existing.current_players > 0) {
        const { error } = await supabase
          .from('facility_capacity')
          .update({
            current_players: Math.max(0, existing.current_players - 1),
            last_updated: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating capacity on checkout:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in updateCapacityOnCheckOut:', error);
      return false;
    }
  }

  // Get default max capacity for a sport
  private static getDefaultMaxCapacity(sport: string): number {
    switch (sport) {
      case 'basketball': return 10;
      case 'tennis': return 4;
      case 'pickleball': return 8;
      case 'volleyball': return 12;
      case 'soccer': return 22;
      case 'badminton': return 4;
      default: return 20;
    }
  }

  // Get capacity level based on current vs max players
  static getCapacityLevel(currentPlayers: number, maxCapacity: number): 'low' | 'medium' | 'high' | 'full' {
    if (!maxCapacity || maxCapacity <= 0) return 'low';
    const percentage = (currentPlayers / maxCapacity) * 100;
    
    if (percentage < 25) return 'low';
    if (percentage < 50) return 'medium';
    if (percentage < 75) return 'high';
    return 'full';
  }

  // Check if capacity data is recent (within last 2 hours)
  static isCapacityDataRecent(capacity: FacilityCapacity): boolean {
    const lastUpdated = new Date(capacity.last_updated).getTime();
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    return lastUpdated > twoHoursAgo;
  }

  // Get capacity level color for UI
  static getCapacityColor(occupancyLevel: string): string {
    switch (occupancyLevel) {
      case 'low': return '#4CAF50'; // Green
      case 'medium': return '#FF9800'; // Orange
      case 'high': return '#f44336'; // Red
      case 'full': return '#9C27B0'; // Purple
      default: return '#666';
    }
  }

  // Get capacity level emoji for UI
  static getCapacityEmoji(occupancyLevel: string): string {
    switch (occupancyLevel) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      case 'full': return '🚫';
      default: return '⚪';
    }
  }

  // Get capacity level text
  static getCapacityText(occupancyLevel: string): string {
    switch (occupancyLevel) {
      case 'low': return 'Low activity';
      case 'medium': return 'Moderate activity';
      case 'high': return 'High activity';
      case 'full': return 'Very busy';
      default: return 'Unknown';
    }
  }

  // Get capacity percentage for visualization
  static getCapacityPercentage(currentPlayers: number, maxCapacity: number): number {
    if (!maxCapacity || maxCapacity <= 0) return 0;
    return Math.round((currentPlayers / maxCapacity) * 100);
  }

  // Get capacity label for display
  static getCapacityLabel(level: 'low' | 'medium' | 'high' | 'full'): string {
    switch (level) {
      case 'low': return 'Low activity';
      case 'medium': return 'Moderate';
      case 'high': return 'Busy';
      case 'full': return 'Full';
      default: return 'Unknown';
    }
  }

  // Get capacity description
  static getCapacityDescription(level: 'low' | 'medium' | 'high' | 'full'): string {
    switch (level) {
      case 'low': return 'Plenty of space available';
      case 'medium': return 'Moderately busy, good time to play';
      case 'high': return 'Getting crowded, expect some wait';
      case 'full': return 'Facility at capacity';
      default: return 'Capacity status unknown';
    }
  }

  // Report capacity from user observation
  static async reportCapacity(
    googlePlaceId: string,
    sport: string,
    occupancyLevel: 'low' | 'medium' | 'high' | 'full',
    userId: string
  ): Promise<boolean> {
    try {
      // Convert occupancy level to player count estimate
      const maxCapacity = this.getDefaultMaxCapacity(sport);
      let estimatedPlayers: number;
      
      switch (occupancyLevel) {
        case 'low': estimatedPlayers = Math.floor(maxCapacity * 0.15); break;
        case 'medium': estimatedPlayers = Math.floor(maxCapacity * 0.4); break;
        case 'high': estimatedPlayers = Math.floor(maxCapacity * 0.7); break;
        case 'full': estimatedPlayers = maxCapacity; break;
        default: estimatedPlayers = 0;
      }

      // Upsert capacity record
      const { error } = await supabase
        .from('facility_capacity')
        .upsert({
          google_place_id: googlePlaceId,
          sport: sport,
          current_players: estimatedPlayers,
          max_capacity: maxCapacity,
          reported_by: userId,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'google_place_id,sport',
        });

      if (error) {
        console.error('Error reporting capacity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in reportCapacity:', error);
      return false;
    }
  }

  // Alias for backwards compatibility
  static isCapacityReportRecent(capacity: FacilityCapacity): boolean {
    return this.isCapacityDataRecent(capacity);
  }

  // Get all capacities for a facility (all sports)
  static async getFacilityCapacities(googlePlaceId: string): Promise<FacilityCapacity[]> {
    try {
      const { data, error } = await supabase
        .from('facility_capacity')
        .select('*')
        .eq('google_place_id', googlePlaceId);

      if (error) {
        console.error('Error getting facility capacities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getFacilityCapacities:', error);
      return [];
    }
  }
}
