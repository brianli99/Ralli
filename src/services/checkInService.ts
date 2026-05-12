import { supabase } from './supabase';
import { CheckIn, Sport } from '../types';
import { CHECK_IN_LISTING_WINDOW_MS, CHECK_IN_RADIUS_METERS, CHECK_OUT_RADIUS_METERS } from '../constants/checkIn';
import { LocationService } from './location';
import { isSport } from '../constants/sports';

const listingSinceIso = () =>
  new Date(Date.now() - CHECK_IN_LISTING_WINDOW_MS).toISOString();

/** Rows for supported sports only (excludes legacy codes like removed `running`). */
function checkInsForSupportedSports(checkIns: CheckIn[] | null | undefined): CheckIn[] {
  if (!checkIns?.length) return [];
  return checkIns.filter(c => isSport(c.sport));
}

/** Distinct people at a place (ignores duplicate rows for same user). */
export function countUniquePlayersAtPlace(checkIns: CheckIn[] | null | undefined): number {
  const rows = checkInsForSupportedSports(checkIns);
  if (!rows.length) return 0;
  return new Set(rows.map(c => c.user_id)).size;
}

/** Distinct people playing a specific sport (by check-in row). */
export function countUniquePlayersBySport(
  checkIns: CheckIn[] | null | undefined,
  sport: string
): number {
  const rows = checkInsForSupportedSports(checkIns);
  if (!rows.length) return 0;
  const seen = new Set<string>();
  for (const c of rows) {
    if (c.sport === sport) seen.add(c.user_id);
  }
  return seen.size;
}

/**
 * Load check-ins for "who’s playing": active presence (checked_out_at is null)
 * when the column exists; else last 4h window (pre-migration).
 */
export async function fetchCheckInsForPlaceDisplay(
  googlePlaceId: string
): Promise<CheckIn[]> {
  const since = listingSinceIso();

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('google_place_id', googlePlaceId)
    .is('checked_out_at', null)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return data as CheckIn[];
  }

  // Pre-migration DB: no checked_out_at column
  const { data: legacy, error: legacyErr } = await supabase
    .from('check_ins')
    .select('*')
    .eq('google_place_id', googlePlaceId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (!legacyErr && legacy) {
    return (legacy as CheckIn[]) || [];
  }

  console.error('fetchCheckInsForPlaceDisplay', error || legacyErr);
  return [];
}

function dedupeCheckInsByUser(rows: CheckIn[]): CheckIn[] {
  const byUser = new Map<string, CheckIn>();
  for (const r of rows) {
    const cur = byUser.get(r.user_id);
    if (!cur || new Date(r.created_at) > new Date(cur.created_at)) {
      byUser.set(r.user_id, r);
    }
  }
  return Array.from(byUser.values());
}

/** Active (or legacy window) check-ins for any place id in a merged venue group */
export async function fetchCheckInsForPlaceGroup(googlePlaceIds: string[]): Promise<CheckIn[]> {
  const ids = [...new Set(googlePlaceIds.filter(Boolean))];
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    return fetchCheckInsForPlaceDisplay(ids[0]);
  }

  const since = listingSinceIso();

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .in('google_place_id', ids)
    .is('checked_out_at', null)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return dedupeCheckInsByUser(data as CheckIn[]);
  }

  const { data: legacy, error: legacyErr } = await supabase
    .from('check_ins')
    .select('*')
    .in('google_place_id', ids)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (!legacyErr && legacy) {
    return dedupeCheckInsByUser(legacy as CheckIn[]);
  }

  console.error('fetchCheckInsForPlaceGroup', error || legacyErr);
  return [];
}

export type CheckInRpcResult = CheckIn & {
  checked_out_at?: string | null;
  last_heartbeat_at?: string | null;
  place_latitude?: number | null;
  place_longitude?: number | null;
};

/**
 * Check in (idempotent, one global active presence) via DB RPC, or fall back
 * to a plain insert when the RPC is not installed yet.
 */
export async function checkInAtCourt(params: {
  userId: string;
  googlePlaceId: string;
  sport: Sport;
  userLatitude: number;
  userLongitude: number;
  placeLatitude: number;
  placeLongitude: number;
}): Promise<{ data: CheckIn | null; error: Error | null }> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('check_in_at_court', {
    p_google_place_id: params.googlePlaceId,
    p_sport: params.sport,
    p_user_lat: params.userLatitude,
    p_user_lng: params.userLongitude,
    p_place_lat: params.placeLatitude,
    p_place_lng: params.placeLongitude,
  });

  if (!rpcError && rpcData != null) {
    return { data: rpcData as CheckIn, error: null };
  }

  // PGRST202 = function not found, 42883 in Postgres
  const code = (rpcError as any)?.code;
  const msg = (rpcError as any)?.message || '';
  if (
    code === 'PGRST202' ||
    code === '42883' ||
    /function .* does not exist|schema cache/i.test(msg)
  ) {
    return legacyInsertCheckIn(params);
  }

  return { data: null, error: rpcError as Error | null };
}

async function legacyInsertCheckIn(params: {
  userId: string;
  googlePlaceId: string;
  sport: Sport;
  userLatitude: number;
  userLongitude: number;
  placeLatitude: number;
  placeLongitude: number;
}): Promise<{ data: CheckIn | null; error: Error | null }> {
  const withPlace = {
    user_id: params.userId,
    google_place_id: params.googlePlaceId,
    sport: params.sport,
    latitude: params.userLatitude,
    longitude: params.userLongitude,
    place_latitude: params.placeLatitude,
    place_longitude: params.placeLongitude,
  };
  let { data, error } = await supabase
    .from('check_ins')
    .insert([withPlace as any])
    .select()
    .single();

  if (error && /place_latitude|place_longitude|column|42703/i.test(String((error as any).message || ''))) {
    const r = await supabase
      .from('check_ins')
      .insert([
        {
          user_id: params.userId,
          google_place_id: params.googlePlaceId,
          sport: params.sport,
          latitude: params.userLatitude,
          longitude: params.userLongitude,
        },
      ])
      .select()
      .single();
    data = r.data;
    error = r.error;
  }

  if (error) {
    return { data: null, error: error as Error };
  }
  return { data: data as CheckIn, error: null };
}

export async function checkOutCourt(): Promise<{ error: Error | null }> {
  const { error: rpcError } = await supabase.rpc('check_out_court');
  if (!rpcError) {
    return { error: null };
  }
  const code = (rpcError as any)?.code;
  if (code === 'PGRST202' || (rpcError as any)?.message?.includes('does not exist')) {
    // Legacy: set checked_out_at is not in DB — delete latest row? Skip.
    return { error: null };
  }
  return { error: rpcError as Error };
}

/** Foreground: true if current location is outside check-out buffer around court. */
export function shouldCheckOut(
  currentLat: number,
  currentLng: number,
  placeLat: number,
  placeLng: number
): boolean {
  const m = LocationService.calculateDistance(
    currentLat,
    currentLng,
    placeLat,
    placeLng
  );
  return m > CHECK_OUT_RADIUS_METERS;
}

export function isWithinCheckInRadius(
  userLat: number,
  userLng: number,
  placeLat: number,
  placeLng: number
): boolean {
  return (
    LocationService.calculateDistance(userLat, userLng, placeLat, placeLng) <=
    CHECK_IN_RADIUS_METERS
  );
}

export { CHECK_IN_RADIUS_METERS, CHECK_OUT_RADIUS_METERS, CHECK_IN_LISTING_WINDOW_MS };
