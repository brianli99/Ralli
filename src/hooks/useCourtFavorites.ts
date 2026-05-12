import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Court } from '../types';
import { getPlaceIdsForQueries } from '../utils/venueConsolidation';

export type FavoriteCourtRow = {
  google_place_id: string;
  facility_name: string | null;
};

/** True if this facility (or any merged group id) is in the user's favorites set. */
export function isCourtFavorited(facility: Court, favorites: Set<string>): boolean {
  if (favorites.has(facility.id)) return true;
  return (facility.groupPlaceIds || []).some(id => favorites.has(id));
}

export function useCourtFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteList, setFavoriteList] = useState<FavoriteCourtRow[]>([]);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites(new Set());
      setFavoriteList([]);
      return;
    }
    const { data, error } = await supabase
      .from('user_favorites')
      .select('google_place_id, facility_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('Error loading favorites:', error);
      }
      return;
    }
    const rows = (data || []) as FavoriteCourtRow[];
    setFavoriteList(rows);
    setFavorites(new Set(rows.map(r => r.google_place_id)));
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorited = useCallback(
    (facility: Court) => isCourtFavorited(facility, favorites),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (facility: Court) => {
      if (!user) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const groupIds = getPlaceIdsForQueries(facility);
      const hasAnyFav = groupIds.some(id => favorites.has(id));
      try {
        if (hasAnyFav) {
          for (const id of groupIds) {
            if (!favorites.has(id)) continue;
            const { error } = await supabase
              .from('user_favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('google_place_id', id);
            if (error) throw error;
          }
          setFavorites(prev => {
            const next = new Set(prev);
            groupIds.forEach(id => next.delete(id));
            return next;
          });
          setFavoriteList(prev => prev.filter(r => !groupIds.includes(r.google_place_id)));
        } else {
          const { error } = await supabase.from('user_favorites').insert({
            user_id: user.id,
            google_place_id: facility.id,
            facility_name: facility.name,
          });
          if (error) throw error;
          setFavorites(prev => new Set(prev).add(facility.id));
          setFavoriteList(prev => [
            { google_place_id: facility.id, facility_name: facility.name },
            ...prev.filter(r => r.google_place_id !== facility.id),
          ]);
        }
      } catch (err: any) {
        console.error('Error toggling favorite:', err);
        if (err?.code === 'PGRST205' || /user_favorites/.test(err?.message || '')) {
          Alert.alert(
            'Favorites unavailable',
            'Run beta-features-schema.sql in your Supabase project to enable favorites.'
          );
        } else {
          Alert.alert('Error', 'Could not update favorite. Try again.');
        }
      }
    },
    [user, favorites]
  );

  return useMemo(
    () => ({
      favorites,
      favoriteList,
      isFavorited,
      toggleFavorite,
      refreshFavorites: loadFavorites,
    }),
    [favorites, favoriteList, isFavorited, toggleFavorite, loadFavorites]
  );
}
