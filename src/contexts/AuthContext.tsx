import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthService } from '../services/auth';
import { notificationService } from '../services/notificationService';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<User>;
  updateSportPreferences: (preferences: string[], preferenceOrder: string[]) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthService.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const subscription = AuthService.onAuthStateChange(async (authUser) => {
      try {
        if (authUser) {
          const profile = await AuthService.getCurrentUser();
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    void (async () => {
      const token = await notificationService.registerForPushNotifications();
      if (!cancelled && token) {
        await notificationService.savePushToken(user.id, token);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await AuthService.signIn(email, password);
      // Retry briefly in case profile row isn't yet available due to trigger timing
      let profile: User | null = null;
      for (let i = 0; i < 3; i++) {
        profile = await AuthService.getCurrentUser().catch(() => null);
        if (profile) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      setUser(profile);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const data = await AuthService.signUp(email, password, fullName);
      if (data.user) {
        // Retry briefly in case DB trigger hasn't inserted the users row yet
        let profile: User | null = null;
        for (let i = 0; i < 3; i++) {
          profile = await AuthService.getCurrentUser().catch(() => null);
          if (profile) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        setUser(profile);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        await notificationService.removePushToken(user.id);
      }
      await AuthService.signOut();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    const updatedUser = await AuthService.updateProfile(updates);
    setUser(updatedUser);
    return updatedUser;
  };

  const updateSportPreferences = async (preferences: string[], preferenceOrder: string[]) => {
    if (!user) throw new Error('No user logged in');
    
    const updates = {
      preferred_sports: preferences,
      sport_preference_order: preferenceOrder,
      onboarding_completed: true, // Mark onboarding as completed when preferences are set
    };
    
    const updatedUser = await AuthService.updateProfile(updates);
    setUser(updatedUser);
    return updatedUser;
  };

  const refreshUser = async () => {
    try {
      const profile = await AuthService.getCurrentUser();
      setUser(profile);
    } catch (err) {
      console.error('refreshUser failed:', err);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateSportPreferences,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
