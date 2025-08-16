import { supabase } from './supabase';
import { useAuth } from '../contexts/AuthContext';

export interface FacilityCapacity {
  id: string;
  facility_id: string;
  occupancy_percentage: number;
  occupancy_level: 'low' | 'medium' | 'high' | 'full';
  reported_at: string;
  user_id: string;
  sport: string;
}

export interface CapacityReport {
  facilityId: string;
  sport: string;
  occupancyLevel: 'low' | 'medium' | 'high' | 'full';
  notes?: string;
}

export class CapacityService {
  // Report current capacity at a facility
  static async reportCapacity(
    facilityId: string,
    sport: string,
    occupancyLevel: 'low' | 'medium' | 'high' | 'full',
    userId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const occupancyMap = { 
        low: 25, 
        medium: 50, 
        high: 75, 
        full: 100 
      };
      
      const { error } = await supabase.from('facility_capacity').insert({
        facility_id: facilityId,
        occupancy_percentage: occupancyMap[occupancyLevel],
        occupancy_level: occupancyLevel,
        sport: sport,
        reported_at: new Date().toISOString(),
        user_id: userId,
        notes: notes
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

  // Get latest capacity report for a facility
  static async getLatestCapacity(facilityId: string, sport?: string): Promise<FacilityCapacity | null> {
    try {
      let query = supabase
        .from('facility_capacity')
        .select('*')
        .eq('facility_id', facilityId)
        .order('reported_at', { ascending: false })
        .limit(1);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting capacity:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error in getLatestCapacity:', error);
      return null;
    }
  }

  // Get capacity reports for multiple facilities
  static async getCapacitiesForFacilities(facilityIds: string[]): Promise<Record<string, FacilityCapacity>> {
    if (facilityIds.length === 0) return {};

    try {
      // Get the most recent capacity report for each facility
      const { data, error } = await supabase
        .from('facility_capacity')
        .select('*')
        .in('facility_id', facilityIds)
        .gte('reported_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
        .order('reported_at', { ascending: false });

      if (error) {
        console.error('Error getting capacities:', error);
        return {};
      }

      // Group by facility_id and take the most recent report for each
      const capacitiesMap: Record<string, FacilityCapacity> = {};
      
      data?.forEach(capacity => {
        if (!capacitiesMap[capacity.facility_id]) {
          capacitiesMap[capacity.facility_id] = capacity;
        }
      });

      return capacitiesMap;
    } catch (error) {
      console.error('Error in getCapacitiesForFacilities:', error);
      return {};
    }
  }

  // Get capacity history for a facility
  static async getCapacityHistory(facilityId: string, hours: number = 24): Promise<FacilityCapacity[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('facility_capacity')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('reported_at', since)
        .order('reported_at', { ascending: true });

      if (error) {
        console.error('Error getting capacity history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCapacityHistory:', error);
      return [];
    }
  }

  // Get average capacity for a facility at specific times
  static async getAverageCapacityByHour(facilityId: string, dayOfWeek: number): Promise<Record<number, number>> {
    try {
      // This would require a more complex query - for now return empty
      // In a real implementation, you'd analyze historical data by hour of day
      return {};
    } catch (error) {
      console.error('Error in getAverageCapacityByHour:', error);
      return {};
    }
  }

  // Check if capacity report is recent (within last 2 hours)
  static isCapacityReportRecent(capacity: FacilityCapacity): boolean {
    const reportTime = new Date(capacity.reported_at).getTime();
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    return reportTime > twoHoursAgo;
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
}
