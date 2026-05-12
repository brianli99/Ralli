import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { LocationService } from '../services/location';
import {
  checkOutCourt,
  shouldCheckOut,
} from '../services/checkInService';
import { CapacityService } from '../services/capacityService';
import { useToast } from '../components/ui';

type ActivePresence = {
  id: string;
  googlePlaceId: string;
  placeLatitude: number;
  placeLongitude: number;
  sport?: string | null;
};

type PresenceContextValue = {
  activePresence: ActivePresence | null;
  isCheckedIn: boolean;
  refreshActivePresence: () => Promise<void>;
  setPresenceFromCheckIn: (p: {
    id: string;
    googlePlaceId: string;
    placeLatitude: number;
    placeLongitude: number;
    sport?: string | null;
  }) => void;
  clearLocalPresence: () => void;
};

const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activePresence, setActivePresence] = useState<ActivePresence | null>(null);
  const presenceRef = useRef<ActivePresence | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    presenceRef.current = activePresence;
  }, [activePresence]);

  const clearLocalPresence = useCallback(() => {
    setActivePresence(null);
  }, []);

  const refreshActivePresence = useCallback(async () => {
    if (!user?.id) {
      setActivePresence(null);
      return;
    }
    let data: {
      id: string;
      google_place_id: string;
      place_latitude: number | null;
      place_longitude: number | null;
      latitude: number;
      longitude: number;
      sport?: string | null;
    } | null = null;

    let res = await supabase
      .from('check_ins')
      .select('id, google_place_id, sport, place_latitude, place_longitude, latitude, longitude, checked_out_at')
      .eq('user_id', user.id)
      .is('checked_out_at', null)
      .maybeSingle();

    if (res.error) {
      res = await supabase
        .from('check_ins')
        .select('id, google_place_id, sport, latitude, longitude')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (res.error) {
      setActivePresence(null);
      return;
    }
    data = res.data as any;

    if (!data) {
      setActivePresence(null);
      return;
    }

    const pl = (data as any).place_latitude;
    const pLng = (data as any).place_longitude;
    const ulat = (data as any).latitude;
    const ulng = (data as any).longitude;

    setActivePresence({
      id: (data as any).id,
      googlePlaceId: (data as any).google_place_id,
      placeLatitude: typeof pl === 'number' ? pl : Number(ulat),
      placeLongitude: typeof pLng === 'number' ? pLng : Number(ulng),
      sport: (data as any).sport,
    });
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void refreshActivePresence();
    } else {
      setActivePresence(null);
    }
  }, [user?.id, refreshActivePresence]);

  const setPresenceFromCheckIn = useCallback(
    (p: {
      id: string;
      googlePlaceId: string;
      placeLatitude: number;
      placeLongitude: number;
      sport?: string | null;
    }) => {
      setActivePresence(p);
    },
    []
  );

  const onLocationUpdate = useCallback(
    (lat: number, lng: number) => {
      const p = presenceRef.current;
      if (!p) return;
      if (shouldCheckOut(lat, lng, p.placeLatitude, p.placeLongitude)) {
        void (async () => {
          const { error } = await checkOutCourt();
          if (error) {
            console.error('check_out_court', error);
            return;
          }
          if (p.sport) {
            await CapacityService.updateCapacityOnCheckOut(p.googlePlaceId, p.sport);
          }
          setActivePresence(null);
          showToast({
            type: 'info',
            message: 'You’ve been checked out (left the area)',
            duration: 3500,
          });
        })();
        if (subRef.current) {
          subRef.current.remove();
          subRef.current = null;
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!user?.id || !activePresence) {
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
      return;
    }

    let mounted = true;
    void (async () => {
      const sub = await LocationService.watchPosition(
        (loc) => {
          if (!mounted) return;
          onLocationUpdate(
            loc.coords.latitude,
            loc.coords.longitude
          );
        },
        (e) => console.warn('presence watch', e)
      );
      if (mounted && sub) {
        if (subRef.current) subRef.current.remove();
        subRef.current = sub;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, activePresence?.id, onLocationUpdate]);

  const onAppState = useCallback(
    (s: AppStateStatus) => {
      if (s === 'active' && user?.id) {
        void refreshActivePresence();
      }
    },
    [user?.id, refreshActivePresence]
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [onAppState]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      activePresence,
      isCheckedIn: !!activePresence,
      refreshActivePresence,
      setPresenceFromCheckIn,
      clearLocalPresence,
    }),
    [activePresence, refreshActivePresence, setPresenceFromCheckIn, clearLocalPresence]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return ctx;
}
