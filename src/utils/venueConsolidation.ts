import { Court, Sport } from '../types';
import { SPORT_FILTERS } from '../constants/sports';

const PRIMARY_TYPE_SCORE: Record<string, number> = {
  park: 100,
  national_park: 95,
  recreation_center: 88,
  sports_complex: 82,
  playground: 78,
  community_center: 72,
  athletic_field: 68,
  stadium: 65,
  gym: 40,
  point_of_interest: 35,
  establishment: 30,
};

function typeScore(primaryType?: string): number {
  if (!primaryType) return 0;
  const k = primaryType.toLowerCase();
  if (PRIMARY_TYPE_SCORE[k] != null) return PRIMARY_TYPE_SCORE[k];
  return 20;
}

function unionSports(courts: Court[]): string[] {
  const set = new Set<string>();
  for (const c of courts) {
    for (const s of c.sports) {
      set.add(s);
    }
  }
  const ordered = SPORT_FILTERS.filter(s => set.has(s));
  const rest = [...set].filter(s => !SPORT_FILTERS.includes(s as Sport));
  return [...ordered, ...rest];
}

/**
 * Collapse several Google Place rows in the same map cluster into one `Court`
 * (one pin, one callout). Representative id/name from park > rec center > etc.
 */
export function mergeNearbyPlaces(
  courts: Court[],
  centroid: { latitude: number; longitude: number }
): Court {
  if (courts.length === 0) {
    throw new Error('mergeNearbyPlaces: empty courts');
  }
  if (courts.length === 1) {
    const c = courts[0];
    return {
      ...c,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      groupPlaceIds: [c.id],
    };
  }

  const groupPlaceIds = courts.map(c => c.id);
  const names = courts.map(c => c.name.toLowerCase());

  let best = courts[0];
  let bestScore = -1;

  for (const c of courts) {
    let s = typeScore(c.primaryType);
    const n = c.name.toLowerCase();
    if (/\bpark\b/.test(n)) s += 25;
    if (/recreation|rec center|community/.test(n)) s += 12;
    if (names.filter(other => n.length >= 6 && other.includes(n.slice(0, 6))).length >= 2) {
      s += 5;
    }
    if (s > bestScore) {
      bestScore = s;
      best = c;
    } else if (s === bestScore && c.name.length < best.name.length) {
      best = c;
    }
  }

  const sports = unionSports(courts);
  const allAmenities = Array.from(
    new Set(courts.flatMap(c => c.amenities || []))
  );

  return {
    id: best.id,
    name: best.name,
    description: best.description,
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    sports: sports.length > 0 ? sports : (best.sports.length ? best.sports : ['basketball']),
    address: best.address || courts.find(c => c.address)?.address || '',
    amenities: allAmenities,
    created_at: best.created_at,
    updated_at: new Date().toISOString(),
    primaryType: best.primaryType,
    types: best.types,
    groupPlaceIds,
  };
}

export function getPlaceIdsForQueries(c: Court | null | undefined): string[] {
  if (!c) return [];
  if (c.groupPlaceIds && c.groupPlaceIds.length > 0) {
    return c.groupPlaceIds;
  }
  return [c.id];
}
